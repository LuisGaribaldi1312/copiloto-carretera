/**
 * Servicio de Reconocimiento y Comandos de Voz Manos Libres para Conducción.
 * Compatible con Web Speech Recognition API en Chrome/Android/Edge/Safari.
 */

export interface VoiceCommandMatch {
  action: 'search_destination' | 'cancel_route' | 'recenter' | 'find_poi' | 'ask_gemini' | 'toggle_sound';
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
   */
  public static processVoiceCommand(text: string) {
    if (!this.onCommandCallback || !text.trim()) return;

    const lower = text.toLowerCase();

    // 1. Cancelar ruta / detener navegación
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

    // 2. Recentrar en GPS
    if (
      lower.includes('recentrar') ||
      lower.includes('dónde estoy') ||
      lower.includes('mi ubicación') ||
      lower.includes('centrar mapa') ||
      lower.includes('centrar')
    ) {
      this.onCommandCallback({ action: 'recenter', rawTranscript: text });
      return;
    }

    // 3. Buscar POIs específicos (Gasolineras, Vulcanizadoras, Policía, Guardia Nacional, Casetas)
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

    // 4. Ir a un destino / Llevarme a (Estilo Google Maps / Waze)
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

    // 5. Preguntas abiertas a Gemini AI (Seguridad, Horarios, Carretera)
    this.onCommandCallback({ action: 'ask_gemini', param: text, rawTranscript: text });
  }
}
