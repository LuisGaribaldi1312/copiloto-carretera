/**
 * Servicio de Reconocimiento y Comandos de Voz Manos Libres para Conducción.
 * Compatible con Web Speech Recognition API en Chrome/Android/Edge/Safari.
 */

export interface VoiceCommandMatch {
  action: 'search_destination' | 'cancel_route' | 'recenter' | 'find_poi' | 'ask_gemini' | 'route_status' | 'toggle_sound';
  param?: string;
  rawTranscript: string;
}

export type VoiceListenerCallback = (match: VoiceCommandMatch) => void;
export type VoiceStatusCallback = (isListening: boolean, transcript: string, error?: string) => void;

export class VoiceNavigationService {
  private static recognition: any = null;
  private static isListening: boolean = false;
  private static onCommandCallback: VoiceListenerCallback | null = null;
  private static onStatusCallback: VoiceStatusCallback | null = null;
  private static autoRestart: boolean = false;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && (
      'SpeechRecognition' in window || 
      'webkitSpeechRecognition' in window
    );
  }

  public static init() {
    if (!this.isSupported() || this.recognition) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-MX';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStatusCallback) this.onStatusCallback(true, '');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStatusCallback) this.onStatusCallback(false, '');
      // Si el conductor tiene activado el modo manos libres continuo, reiniciar automáticamente
      if (this.autoRestart) {
        try {
          this.recognition.start();
        } catch {
          // ignore
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Error en reconocimiento de voz:', event.error);
      if (this.onStatusCallback) this.onStatusCallback(false, '', event.error);
    };

    this.recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim();
      if (this.onStatusCallback) this.onStatusCallback(true, transcript);
      this.processVoiceCommand(transcript);
    };
  }

  public static startListening(onCommand: VoiceListenerCallback, onStatus?: VoiceStatusCallback, continuous: boolean = true) {
    this.init();
    if (!this.recognition) return false;

    this.onCommandCallback = onCommand;
    if (onStatus) this.onStatusCallback = onStatus;
    this.autoRestart = continuous;

    try {
      this.recognition.start();
      return true;
    } catch {
      return false;
    }
  }

  public static stopListening() {
    this.autoRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
  }

  public static toggleListening(onCommand: VoiceListenerCallback, onStatus?: VoiceStatusCallback): boolean {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      return this.startListening(onCommand, onStatus);
    }
  }

  /**
   * Analiza la frase hablada por el conductor y extrae el comando de navegación (estilo Waze / Google Maps).
   * Filtra ruidos de fondo y habla exclusivamente cuando hay comandos explícitos o preguntas.
   */
  public static processVoiceCommand(text: string) {
    if (!this.onCommandCallback || !text.trim()) return;

    const lower = text.toLowerCase().trim();

    // Filtro de ruido ambiental o frases insignificantes
    if (lower.length < 3) return;

    // 1. Monitoreo en vivo de ruta (Solicitado explícitamente por el conductor)
    const statusTriggers = [
      'monitoreo en vivo',
      'monitoreo de ruta',
      'monitorear ruta',
      'monitoreo',
      'cómo va la ruta',
      'como va la ruta',
      'estado de la ruta',
      'estado de ruta',
      'reporte de ruta',
      'reporte de viaje',
      'estado del viaje',
      'cuánto falta',
      'cuanto falta',
      'cuánto tiempo falta',
      'cuanto tiempo falta',
      'distancia restante',
    ];
    if (statusTriggers.some((t) => lower.includes(t))) {
      this.onCommandCallback({ action: 'route_status', rawTranscript: text });
      return;
    }

    // 2. Cancelar ruta / detener navegación
    if (
      lower.includes('cancelar ruta') ||
      lower.includes('detener ruta') ||
      lower.includes('quitar ruta') ||
      lower.includes('borrar ruta') ||
      lower.includes('parar navegación') ||
      lower.includes('terminar ruta')
    ) {
      this.onCommandCallback({ action: 'cancel_route', rawTranscript: text });
      return;
    }

    // 3. Recentrar en GPS
    if (
      lower.includes('recentrar') ||
      lower.includes('dónde estoy') ||
      lower.includes('donde estoy') ||
      lower.includes('mi ubicación') ||
      lower.includes('mi ubicacion') ||
      lower.includes('centrar mapa') ||
      lower.includes('centrar')
    ) {
      this.onCommandCallback({ action: 'recenter', rawTranscript: text });
      return;
    }

    // 4. Buscar POIs específicos (Gasolineras, Vulcanizadoras, Policía, Guardia Nacional, Casetas)
    if (lower.includes('gasolinera') || lower.includes('gas') || lower.includes('pemex') || lower.includes('combustible')) {
      this.onCommandCallback({ action: 'find_poi', param: 'gas_station', rawTranscript: text });
      return;
    }
    if (lower.includes('vulcanizadora') || lower.includes('llanta') || lower.includes('ponchadura') || lower.includes('talacha')) {
      this.onCommandCallback({ action: 'find_poi', param: 'vulcanizadora', rawTranscript: text });
      return;
    }
    if (lower.includes('guardia nacional') || lower.includes('policía') || lower.includes('policia') || lower.includes('patrulla')) {
      this.onCommandCallback({ action: 'find_poi', param: 'police_station', rawTranscript: text });
      return;
    }
    if (lower.includes('ejército') || lower.includes('ejercito') || lower.includes('militar') || lower.includes('sedena')) {
      this.onCommandCallback({ action: 'find_poi', param: 'military_checkpoint', rawTranscript: text });
      return;
    }
    if (lower.includes('caseta') || lower.includes('peaje') || lower.includes('capufe')) {
      this.onCommandCallback({ action: 'find_poi', param: 'toll_booth', rawTranscript: text });
      return;
    }

    // 5. Ir a un destino / Llevarme a (Estilo Google Maps / Waze)
    const navTriggers = [
      'ir a ',
      'llévame a ',
      'llevame a ',
      'cómo llegar a ',
      'como llegar a ',
      'ruta a ',
      'navegar a ',
      'dirección a ',
      'direccion a ',
      'buscar ',
    ];

    for (const trigger of navTriggers) {
      if (lower.includes(trigger)) {
        const dest = text.slice(lower.indexOf(trigger) + trigger.length).trim();
        if (dest.length > 2) {
          this.onCommandCallback({ action: 'search_destination', param: dest, rawTranscript: text });
          return;
        }
      }
    }

    // 6. Preguntas explícitas dirigidas al copiloto / Gemini
    // Solo responde si es claramente una pregunta o consulta al copiloto; NO por ruidos ambientales ni palabras sueltas
    const questionStarters = [
      'oye copiloto',
      'copiloto',
      'gemini',
      '¿',
      'cómo ',
      'como ',
      'cuál ',
      'cual ',
      'qué ',
      'que ',
      'dónde ',
      'donde ',
      'cuándo ',
      'cuando ',
      'por qué ',
      'porque ',
      'hay ',
      'explica',
      'dime ',
      'pregunta',
      'recomienda',
      'consejo',
    ];

    const isExplicitQuestion = questionStarters.some((starter) => lower.startsWith(starter) || lower.includes(starter));

    if (isExplicitQuestion && lower.length > 5) {
      this.onCommandCallback({ action: 'ask_gemini', param: text, rawTranscript: text });
      return;
    }

    // Si no es un comando reconocido ni una pregunta clara, se mantiene en silencio total
  }
}
