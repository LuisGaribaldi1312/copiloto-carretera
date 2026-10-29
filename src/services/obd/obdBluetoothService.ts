import { ObdTelemetry } from '../../types/vehicle';
import { Elm327Parser } from './elm327Parser';

// Lista de UUIDs de servicios comunes en adaptadores ELM327 BLE (v4.0 / v5.0)
const KNOWN_BLE_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb', // Chip genérico BLE V-Gate / iCar
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (muy común)
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Serial BLE estándar
  '000018f0-0000-1000-8000-00805f9b34fb',
];

const KNOWN_BLE_CHARS_NOTIFY = [
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

const KNOWN_BLE_CHARS_WRITE = [
  '0000fff2-0000-1000-8000-00805f9b34fb',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

export type ObdConnectionState = 'disconnected' | 'connecting' | 'initializing' | 'connected' | 'error';

export class ObdBluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private receiveBuffer: string = '';
  private currentResolver: ((val: string) => void) | null = null;
  private pollingTimer: number | null = null;
  private isSimulation: boolean = false;
  private simInterval: number | null = null;

  public state: ObdConnectionState = 'disconnected';
  public telemetry: ObdTelemetry = {
    isConnected: false,
    speedKmh: 0,
    rpm: 0,
    fuelLevelPct: null,
    coolantTempC: null,
    throttlePct: null,
    batteryVoltage: null,
    dtcCodes: [],
    lastPingMs: 0,
  };

  private telemetryListeners: Array<(data: ObdTelemetry) => void> = [];
  private stateListeners: Array<(state: ObdConnectionState, msg?: string) => void> = [];

  constructor() {
    this.handleCharacteristicValueChanged = this.handleCharacteristicValueChanged.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
  }

  public onTelemetry(callback: (data: ObdTelemetry) => void): () => void {
    this.telemetryListeners.push(callback);
    return () => {
      this.telemetryListeners = this.telemetryListeners.filter((cb) => cb !== callback);
    };
  }

  public onStateChange(callback: (state: ObdConnectionState, msg?: string) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyState(state: ObdConnectionState, msg?: string) {
    this.state = state;
    this.telemetry.isConnected = state === 'connected';
    this.stateListeners.forEach((cb) => cb(state, msg));
  }

  private emitTelemetry() {
    this.telemetryListeners.forEach((cb) => cb({ ...this.telemetry }));
  }

  /**
   * Comprueba si el navegador actual soporta Web Bluetooth API.
   */
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Inicia el proceso de emparejamiento y conexión con el escáner ELM327 BLE.
   */
  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error(
        'Web Bluetooth no está soportado en este navegador. En Android usa Google Chrome; en iOS la app empaquetada con Capacitor soportará BLE nativo.'
      );
    }

    try {
      this.notifyState('connecting', 'Buscando escáner ELM327 Bluetooth...');

      // Filtros para encontrar dispositivos OBD-II comunes
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'OBD' },
          { namePrefix: 'ELM' },
          { namePrefix: 'V-LINK' },
          { namePrefix: 'Viecar' },
          { namePrefix: 'IOS-Vlink' },
          { namePrefix: 'Auto' }
        ],
        optionalServices: KNOWN_BLE_SERVICES,
      });

      if (!this.device) {
        throw new Error('No se seleccionó ningún dispositivo.');
      }

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);

      this.notifyState('connecting', `Conectando con ${this.device.name || 'Escáner'}...`);
      this.server = await this.device.gatt?.connect() || null;

      if (!this.server) {
        throw new Error('Fallo al conectar con el servidor GATT.');
      }

      // Buscar el servicio UART / Serial compatible
      await this.discoverCharacteristics();

      this.notifyState('initializing', 'Configurando protocolo ELM327...');
      await this.initializeElm327();

      this.notifyState('connected', `Conectado a ${this.device.name || 'OBD-II'}`);
      this.telemetry.deviceName = this.device.name;

      // Iniciar bucle de lectura periódica
      this.startPollingLoop();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyState('error', message);
      await this.disconnect();
      throw err;
    }
  }

  /**
   * Descubre y enlaza las características de lectura y escritura del servicio BLE.
   */
  private async discoverCharacteristics(): Promise<void> {
    if (!this.server) return;

    for (const serviceUuid of KNOWN_BLE_SERVICES) {
      try {
        const service = await this.server.getPrimaryService(serviceUuid);
        if (!service) continue;

        // Intentar obtener características de notificación y escritura
        for (const notifyUuid of KNOWN_BLE_CHARS_NOTIFY) {
          try {
            const char = await service.getCharacteristic(notifyUuid);
            if (char.properties.notify || char.properties.indicate) {
              this.notifyCharacteristic = char;
              await this.notifyCharacteristic.startNotifications();
              this.notifyCharacteristic.addEventListener(
                'characteristicvaluechanged',
                this.handleCharacteristicValueChanged
              );
              break;
            }
          } catch {
            // Siguiente candidato
          }
        }

        for (const writeUuid of KNOWN_BLE_CHARS_WRITE) {
          try {
            const char = await service.getCharacteristic(writeUuid);
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.writeCharacteristic = char;
              break;
            }
          } catch {
            // Siguiente candidato
          }
        }

        if (this.writeCharacteristic && this.notifyCharacteristic) {
          return;
        }
      } catch {
        // Continuar con el siguiente UUID
      }
    }

    throw new Error('No se encontró el canal de comunicación serial/UART del adaptador OBD.');
  }

  /**
   * Secuencia de inicialización AT para preparar el chip ELM327.
   */
  private async initializeElm327(): Promise<void> {
    await this.delay(300);
    await this.sendCommand('ATZ');   // Reset
    await this.delay(500);
    await this.sendCommand('ATE0');  // Echo Off
    await this.sendCommand('ATL0');  // Linefeed Off
    await this.sendCommand('ATS0');  // Spaces Off
    await this.sendCommand('ATH0');  // Headers Off
    await this.sendCommand('ATSP0'); // Protocol Auto
    
    // Leer voltaje
    const voltageResp = await this.sendCommand('ATRV');
    const volts = Elm327Parser.parseVoltage(voltageResp);
    if (volts) {
      this.telemetry.batteryVoltage = volts;
    }
  }

  /**
   * Envía un comando AT o PID OBD al ELM327 y espera la respuesta con prompt '>'.
   */
  public async sendCommand(command: string, timeoutMs: number = 3000): Promise<string> {
    if (!this.writeCharacteristic) {
      throw new Error('No hay canal de escritura disponible.');
    }

    this.receiveBuffer = '';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.currentResolver = null;
        reject(new Error(`Timeout esperando respuesta del comando '${command}'`));
      }, timeoutMs);

      this.currentResolver = (response: string) => {
        clearTimeout(timeout);
        this.currentResolver = null;
        resolve(response);
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(command + '\r');
      this.writeCharacteristic!.writeValue(data).catch((err) => {
        clearTimeout(timeout);
        this.currentResolver = null;
        reject(err);
      });
    });
  }

  private handleCharacteristicValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const decoder = new TextDecoder();
    const chunk = decoder.decode(value);
    this.receiveBuffer += chunk;

    // Si encontramos el prompt '>', el comando completó
    if (this.receiveBuffer.includes('>')) {
      if (this.currentResolver) {
        const fullResponse = this.receiveBuffer;
        this.receiveBuffer = '';
        this.currentResolver(fullResponse);
      }
    }
  }

  /**
   * Bucle periódico para consultar PIDs críticos sin saturar la ECU del auto.
   */
  private startPollingLoop() {
    let tickCount = 0;

    const poll = async () => {
      if (this.state !== 'connected') return;

      try {
        // 1. Velocidad (010D)
        const speedRes = await this.sendCommand('010D', 1500);
        const parsedSpeed = Elm327Parser.parseMode01('0D', speedRes);
        if (typeof parsedSpeed.value === 'number') {
          this.telemetry.speedKmh = parsedSpeed.value;
        }

        // 2. RPM (010C)
        const rpmRes = await this.sendCommand('010C', 1500);
        const parsedRpm = Elm327Parser.parseMode01('0C', rpmRes);
        if (typeof parsedRpm.value === 'number') {
          this.telemetry.rpm = parsedRpm.value;
        }

        // 3. Combustible (012F) - cada 5 iteraciones
        if (tickCount % 5 === 0) {
          const fuelRes = await this.sendCommand('012F', 1500);
          const parsedFuel = Elm327Parser.parseMode01('2F', fuelRes);
          if (typeof parsedFuel.value === 'number') {
            this.telemetry.fuelLevelPct = parsedFuel.value;
          }
        }

        // 4. Temp Refrigerante (0105) - cada 5 iteraciones
        if (tickCount % 5 === 2) {
          const tempRes = await this.sendCommand('0105', 1500);
          const parsedTemp = Elm327Parser.parseMode01('05', tempRes);
          if (typeof parsedTemp.value === 'number') {
            this.telemetry.coolantTempC = parsedTemp.value;
          }
        }

        // 5. DTC Codes (Modo 03) - cada 30 iteraciones (~30 segundos)
        if (tickCount % 30 === 0) {
          const dtcRes = await this.sendCommand('03', 2500);
          this.telemetry.dtcCodes = Elm327Parser.parseDtc(dtcRes);
        }

        this.telemetry.lastPingMs = Date.now();
        this.emitTelemetry();
      } catch (err) {
        console.warn('Error en ciclo de lectura OBD:', err);
      } finally {
        tickCount++;
        if (this.state === 'connected') {
          this.pollingTimer = window.setTimeout(poll, 750);
        }
      }
    };

    poll();
  }

  /**
   * MODO SIMULADOR: Permite probar toda la app, pantallas y alertas sin necesitar un coche real.
   */
  public startSimulation() {
    this.isSimulation = true;
    this.notifyState('connected', 'Modo Simulación Activo (ELM327 Virtual)');
    this.telemetry.deviceName = 'ELM327-Simulador';
    this.telemetry.fuelLevelPct = 78;
    this.telemetry.coolantTempC = 88;
    this.telemetry.batteryVoltage = 13.8;
    this.telemetry.dtcCodes = [];

    let speed = 95;
    let rpm = 2200;
    let fuel = 78;

    this.simInterval = window.setInterval(() => {
      // Simular ligeras variaciones de crucero en autopista
      speed = Math.max(70, Math.min(130, speed + (Math.random() * 6 - 3)));
      rpm = Math.round(speed * 23.5 + (Math.random() * 80 - 40));
      fuel = Math.max(5, fuel - 0.01); // Lento descenso de combustible

      this.telemetry.speedKmh = Math.round(speed);
      this.telemetry.rpm = Math.round(rpm);
      this.telemetry.fuelLevelPct = Math.round(fuel);
      this.telemetry.coolantTempC = Math.round(88 + (Math.random() * 4 - 2));
      this.telemetry.lastPingMs = Date.now();

      this.emitTelemetry();
    }, 1000);
  }

  public stopSimulation() {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    this.isSimulation = false;
    this.notifyState('disconnected', 'Simulación detenida');
  }

  private handleDisconnected() {
    this.notifyState('disconnected', 'Escáner desconectado');
    this.cleanup();
  }

  public async disconnect(): Promise<void> {
    if (this.isSimulation) {
      this.stopSimulation();
      return;
    }

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.cleanup();
    this.notifyState('disconnected');
  }

  private cleanup() {
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    this.pollingTimer = null;
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.receiveBuffer = '';
    this.currentResolver = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Instancia singleton para acceso global en la aplicación
export const obdService = new ObdBluetoothService();
