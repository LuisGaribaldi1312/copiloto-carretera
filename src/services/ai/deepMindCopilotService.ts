import { GoogleGenAI } from '@google/genai';
import { VehicleProfile } from '../../types/vehicle';
import { OsrmRouteResult } from '../routing/osrmService';

export interface DeepMindAnalysisResult {
  safetyScore: number; // 0 - 100
  hazardLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  recommendedSpeedKmh: number;
  recommendedFuelStop?: {
    stopAtKm: number;
    reason: string;
  };
  tireAdvice: string;
  nightWarning?: string;
  rawAiAdvice?: string;
  isAiLive: boolean; // true si vino de Gemini 3.8 Flash de Google DeepMind
}

export class DeepMindCopilotService {
  private static STORAGE_KEY = 'deepmind_gemini_api_key';

  public static getApiKey(): string {
    return localStorage.getItem(this.STORAGE_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }

  public static setApiKey(key: string) {
    if (key && key.trim()) {
      localStorage.setItem(this.STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Genera un análisis profundo de la ruta en curso con razonamiento de Google DeepMind.
   */
  public static async analyzeRoute(
    route: OsrmRouteResult,
    profile: VehicleProfile,
    currentSpeedKmh: number = 0,
    ambientTempC: number = 26
  ): Promise<DeepMindAnalysisResult> {
    const apiKey = this.getApiKey();
    const distanceKm = route.distanceKm;
    const durationMin = route.durationMinutes;
    const hour = new Date().getHours();
    const isNight = hour >= 21 || hour < 6;

    // Autonomía matemática estimada
    const remainingKm = Math.round(profile.currentFuelLiters * profile.highwayEfficiencyKmPerL);
    const asphaltTemp = ambientTempC + 18;

    // Si hay API key disponible y hay conexión, invocamos Gemini 3.8 Flash de Google DeepMind
    if (apiKey && navigator.onLine) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
Actúa como el copiloto autónomo vehicular con tecnología de Google DeepMind para seguridad en carreteras de México.
Analiza la siguiente situación del vehículo y genera un reporte breve, táctico y preciso:

- Origen: ${route.originName}
- Destino: ${route.destName}
- Distancia total: ${distanceKm} km
- Tiempo estimado: ${durationMin} minutos
- Velocidad actual: ${currentSpeedKmh} km/h
- Vehículo: ${profile.make} ${profile.model} ${profile.year}
- Capacidad de tanque: ${profile.tankCapacityLiters} L | Gasolina actual: ${profile.currentFuelLiters.toFixed(1)} L
- Autonomía disponible: ${remainingKm} km
- Hora actual: ${hour}:00 hrs (${isNight ? 'NOCHE' : 'DÍA'})
- Temperatura ambiente: ${ambientTempC}°C | Asfalto estimado: ${asphaltTemp}°C

Instrucciones:
Responde en formato JSON estrictamente válido con los siguientes campos:
{
  "safetyScore": number entre 0 y 100,
  "hazardLevel": "low" | "medium" | "high" | "critical",
  "title": "título corto y directo de la situación",
  "summary": "resumen táctico en 2 frases para el conductor",
  "recommendedSpeedKmh": velocidad óptima recomendada en km/h,
  "fuelStopKm": número de km donde se recomienda cargar o null si no se requiere,
  "fuelStopReason": motivo de la parada de gasolina o null,
  "tireAdvice": consejo sobre presión o descanso por temperatura de asfalto,
  "nightWarning": advertencia de horario nocturno o null
}
`;

        const response = await ai.interactions.create({
          model: 'gemini-3.8-flash',
          input: prompt,
        });

        const text = response.output_text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            safetyScore: Number(parsed.safetyScore) || 78,
            hazardLevel: parsed.hazardLevel || (isNight ? 'high' : 'medium'),
            title: parsed.title || 'Análisis DeepMind Copilot',
            summary: parsed.summary || 'Ruta optimizada con predicción de flujo.',
            recommendedSpeedKmh: Number(parsed.recommendedSpeedKmh) || 100,
            recommendedFuelStop: parsed.fuelStopKm ? {
              stopAtKm: parsed.fuelStopKm,
              reason: parsed.fuelStopReason || 'Recarga estratégica recomendada',
            } : undefined,
            tireAdvice: parsed.tireAdvice || `Asfalto a ${asphaltTemp}°C: vigila presión de llantas.`,
            nightWarning: parsed.nightWarning || (isNight ? 'Tránsito nocturno de riesgo elevado.' : undefined),
            rawAiAdvice: text,
            isAiLive: true,
          };
        }
      } catch (err) {
        console.warn('Gemini 3.8 Flash offline/fallback activado:', err);
      }
    }

    // --- MOTOR PREDICTIVO NEURAL DEEP-RESEARCH (OFFLINE HEURISTICS) ---
    // Si no hay API key o no hay señal celular en carretera, se activa el motor heurístico local
    let score = 92;
    let hazard: DeepMindAnalysisResult['hazardLevel'] = 'low';
    let nightWarning: string | undefined = undefined;

    if (isNight) {
      score -= 28;
      hazard = 'high';
      nightWarning = 'Horario nocturno crítico (21:00 a 05:30). Mayor riesgo en tramos no iluminados y curvas serranas.';
    }

    if (remainingKm < distanceKm + 40) {
      score -= 20;
      if (hazard === 'low') hazard = 'medium';
    }

    const fuelDeficit = remainingKm < distanceKm;
    const fuelStop = fuelDeficit
      ? {
          stopAtKm: Math.max(10, Math.round(remainingKm * 0.65)),
          reason: `Autonomía actual (${remainingKm} km) insuficiente para los ${distanceKm} km totales. Carga antes del km ${Math.round(remainingKm * 0.75)}.`,
        }
      : undefined;

    const tireAdvice = asphaltTemp > 42
      ? `Temperatura del asfalto estimada en ${asphaltTemp}°C. El calor expande la presión del aire +3 PSI; no desinfles las llantas en caliente y revisa bandas de rodadura.`
      : 'Temperatura de rodamiento en rangos óptimos de adherencia.';

    return {
      safetyScore: Math.max(15, Math.min(100, score)),
      hazardLevel: hazard,
      title: isNight ? 'Precaución DeepMind: Navegación Nocturna' : 'DeepMind Copilot: Condiciones Favorables',
      summary: fuelDeficit
        ? `Ruta de ${distanceKm} km detectada. DeepMind calcula autonomía ajustada de ${remainingKm} km; se requiere parada de carga obligatoria.`
        : `Trayecto de ${distanceKm} km analizado. Velocidad de crucero recomendada de 95-105 km/h para máxima eficiencia aerodinámica.`,
      recommendedSpeedKmh: isNight ? 90 : 105,
      recommendedFuelStop: fuelStop,
      tireAdvice,
      nightWarning,
      isAiLive: false,
    };
  }

  /**
   * Responde a cualquier pregunta en lenguaje natural sobre la carretera (ej. por voz o chat)
   */
  public static async queryAssistant(question: string, context?: string): Promise<string> {
    const apiKey = this.getApiKey();

    if (apiKey && navigator.onLine) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.interactions.create({
          model: 'gemini-3.8-flash',
          input: `Eres el copiloto inteligente de seguridad carretera desarrollado con tecnología DeepMind.
Contexto vehicular y de ruta: ${context || 'Conduciendo en autopista en México.'}
Pregunta del conductor: "${question}"
Responde en 2 a 3 oraciones claras, directas y seguras para un conductor al volante:`,
        });

        return response.output_text || 'Entendido. Conduce con precaución y mantén ambas manos en el volante.';
      } catch (e) {
        console.warn('Fallo consulta Gemini API:', e);
      }
    }

    // Heurísticas sin conexión
    const q = question.toLowerCase();
    if (q.includes('gasolina') || q.includes('combustible')) {
      return 'DeepMind recomienda mantener al menos 1/4 de tanque siempre en carretera y recargar en paradores formales antes de tramos de 70 km sin poblados.';
    }
    if (q.includes('horario') || q.includes('noche') || q.includes('peligro')) {
      return 'Los horarios con mayor índice de incidentes son de 21:00 a 05:30 hrs. Si viajas de noche, circula exclusivamente por autopistas de cuota y no te detengas en acotamientos oscuros.';
    }
    if (q.includes('llanta') || q.includes('calor') || q.includes('presion')) {
      return 'Con asfalto caliente la presión aumenta naturalmente por dilatación térmica. Revisa la presión siempre antes de iniciar el viaje con neumáticos en frío.';
    }

    return 'DeepMind Copilot monitorea tu telemetría y ruta en tiempo real. Mantén velocidad constante y distancia de frenado segura.';
  }

  /**
   * Genera una advertencia de seguridad o recordatorio preventivo con Gemini o motor heurístico.
   */
  public static async generateSecurityAlertAudio(context: {
    alertType: 'speed_warning' | 'night_risk' | 'low_fuel' | 'tire_heat' | 'fatigue_warning' | 'police_nearby';
    currentSpeed?: number;
    speedLimit?: number;
    hoursDriving?: number;
    poiName?: string;
  }): Promise<string> {
    const apiKey = this.getApiKey();
    let message = '';

    if (context.alertType === 'speed_warning') {
      message = `Atención: Vas a ${context.currentSpeed || 120} kilómetros por hora. El límite oficial en este tramo es de ${context.speedLimit || 110} kilómetros por hora. Reduce tu velocidad.`;
    } else if (context.alertType === 'night_risk') {
      message = 'Alerta de horario nocturno: Mayor índice de riesgo por baja visibilidad. Mantén las luces altas y conserva distancia segura.';
    } else if (context.alertType === 'low_fuel') {
      message = 'Aviso de combustible: Nivel de gasolina bajo. Te sugerimos recargar en la próxima estación de servicio.';
    } else if (context.alertType === 'tire_heat') {
      message = 'Alerta de neumáticos: Asfalto a alta temperatura. Evita frenadas bruscas para prevenir sobrepresión en llantas.';
    } else if (context.alertType === 'fatigue_warning') {
      message = `Llevas más de ${context.hoursDriving || 2} horas continuas al volante. Se recomienda tomar un descanso de 15 minutos en el próximo paradero.`;
    } else if (context.alertType === 'police_nearby') {
      message = `Punto de auxilio próximo: ${context.poiName || 'Base de Guardia Nacional y Policía'}. Conduce a velocidad preventiva.`;
    }

    if (apiKey && navigator.onLine) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.interactions.create({
          model: 'gemini-3.8-flash',
          input: `Redacta una alerta de seguridad automotriz directa, profesional y en tono de copiloto para un conductor de carretera:
Evento: ${context.alertType}.
Datos: ${JSON.stringify(context)}.
Mensaje base: "${message}".
Devuelve ÚNICAMENTE la frase de alerta (máximo 1 o 2 oraciones concisas y fáciles de escuchar mientras se conduce):`,
        });

        const refined = response.output_text?.trim();
        if (refined && refined.length > 5) {
          return refined;
        }
      } catch (e) {
        console.warn('Fallback a texto predeterminado de alerta:', e);
      }
    }

    return message;
  }

  /**
   * Reproduce una instrucción por voz sintetizada en el altavoz del celular o coche (manos libres).
   */
  public static speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-MX';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Error en síntesis de voz:', e);
    }
  }
}
