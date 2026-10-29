/**
 * Parser y decodificador para comandos OBD-II / ELM327.
 * Soporta PIDs estándar SAE J1979 y comandos AT de configuración.
 */

export interface DecodedPid {
  pid: string;
  name: string;
  raw: string;
  value: number | string | string[] | null;
  unit?: string;
}

export class Elm327Parser {
  /**
   * Limpia y normaliza la respuesta cruda de un comando ELM327.
   */
  public static cleanResponse(rawText: string): string {
    return rawText
      .replace(/[\r\n\t>]/g, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  /**
   * Determina si la respuesta contiene errores comunes de OBD o bus no conectado.
   */
  public static isErrorOrNoData(cleaned: string): boolean {
    const errorKeywords = ['NODATA', 'ERROR', 'UNABLETOCONNECT', 'BUSINIT', 'SEARCHING', 'STOPPED', '?'];
    return errorKeywords.some((kw) => cleaned.includes(kw));
  }

  /**
   * Decodifica la respuesta de voltaje de batería (comando ATRV).
   * Ejemplo: "12.6V" -> 12.6
   */
  public static parseVoltage(rawText: string): number | null {
    const match = rawText.match(/(\d+\.\d+)\s*V?/i);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Decodifica respuestas de PIDs estándar de modo 01 (Current Data).
   * En modo 01, la respuesta positiva comienza con "41" seguido del PID.
   */
  public static parseMode01(pid: string, rawText: string): DecodedPid {
    const cleaned = this.cleanResponse(rawText);

    if (this.isErrorOrNoData(cleaned)) {
      return { pid, name: 'Unknown', raw: rawText, value: null };
    }

    const expectedHeader = `41${pid.toUpperCase()}`;
    const headerIndex = cleaned.indexOf(expectedHeader);

    if (headerIndex === -1) {
      return { pid, name: 'Unknown', raw: rawText, value: null };
    }

    const payload = cleaned.substring(headerIndex + expectedHeader.length);

    switch (pid.toUpperCase()) {
      // 010C: RPM del motor (2 bytes A y B) -> ((A * 256) + B) / 4
      case '0C': {
        if (payload.length < 4) return { pid, name: 'RPM', raw: rawText, value: null };
        const a = parseInt(payload.substring(0, 2), 16);
        const b = parseInt(payload.substring(2, 4), 16);
        const rpm = Math.round(((a * 256) + b) / 4);
        return { pid, name: 'Engine RPM', raw: rawText, value: rpm, unit: 'RPM' };
      }

      // 010D: Velocidad del vehículo (1 byte A) -> A km/h
      case '0D': {
        if (payload.length < 2) return { pid, name: 'Speed', raw: rawText, value: null };
        const speed = parseInt(payload.substring(0, 2), 16);
        return { pid, name: 'Vehicle Speed', raw: rawText, value: speed, unit: 'km/h' };
      }

      // 012F: Nivel del tanque de combustible (1 byte A) -> (100 * A) / 255 (%)
      case '2F': {
        if (payload.length < 2) return { pid, name: 'Fuel Level', raw: rawText, value: null };
        const a = parseInt(payload.substring(0, 2), 16);
        const pct = Math.round((a * 100) / 255);
        return { pid, name: 'Fuel Tank Level', raw: rawText, value: pct, unit: '%' };
      }

      // 0105: Temperatura de refrigerante de motor (1 byte A) -> A - 40 (°C)
      case '05': {
        if (payload.length < 2) return { pid, name: 'Coolant Temp', raw: rawText, value: null };
        const a = parseInt(payload.substring(0, 2), 16);
        const temp = a - 40;
        return { pid, name: 'Coolant Temperature', raw: rawText, value: temp, unit: '°C' };
      }

      // 0111: Posición del acelerador / Throttle (1 byte A) -> (100 * A) / 255 (%)
      case '11': {
        if (payload.length < 2) return { pid, name: 'Throttle', raw: rawText, value: null };
        const a = parseInt(payload.substring(0, 2), 16);
        const pct = Math.round((a * 100) / 255);
        return { pid, name: 'Throttle Position', raw: rawText, value: pct, unit: '%' };
      }

      default:
        return { pid, name: `PID ${pid}`, raw: rawText, value: payload };
    }
  }

  /**
   * Decodifica Códigos de Diagnóstico de Falla (DTC - Check Engine) mediante comando Modo 03.
   * La respuesta positiva inicia con "43", seguido de pares de bytes que codifican los códigos DTC.
   */
  public static parseDtc(rawText: string): string[] {
    const cleaned = this.cleanResponse(rawText);
    if (this.isErrorOrNoData(cleaned) || !cleaned.includes('43')) {
      return [];
    }

    const dtcList: string[] = [];
    const index43 = cleaned.indexOf('43');
    const data = cleaned.substring(index43 + 2);

    // Cada código DTC ocupa 4 caracteres hex (2 bytes)
    for (let i = 0; i < data.length - 3; i += 4) {
      const hexChunk = data.substring(i, i + 4);
      if (hexChunk === '0000') continue; // Código nulo / padding

      const b1 = parseInt(hexChunk.substring(0, 2), 16);
      const b2 = hexChunk.substring(2, 4);

      // Primeros 2 bits indican categoría: P, C, B, U
      const typeBit = (b1 & 0xc0) >> 6;
      let category = 'P';
      if (typeBit === 1) category = 'C';
      if (typeBit === 2) category = 'B';
      if (typeBit === 3) category = 'U';

      // Siguientes 2 bits (0-3)
      const secondDigit = (b1 & 0x30) >> 4;
      // Últimos 4 bits del primer byte
      const thirdDigit = (b1 & 0x0f).toString(16).toUpperCase();

      const dtcCode = `${category}${secondDigit}${thirdDigit}${b2}`;
      if (!dtcList.includes(dtcCode)) {
        dtcList.push(dtcCode);
      }
    }

    return dtcList;
  }
}
