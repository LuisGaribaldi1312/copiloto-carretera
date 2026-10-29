/**
 * Asesor de Seguridad en Carretera e Inteligencia Vial.
 * Base de conocimiento para horarios de riesgo, tramos peligrosos y protocolos de prevención.
 */

export interface SecurityAdviceResponse {
  title: string;
  category: 'horarios' | 'tramos_riesgo' | 'falla_mecanica' | 'combustible' | 'general';
  warningLevel: 'high' | 'medium' | 'info';
  summary: string;
  recommendations: string[];
  safeHours?: string;
  dangerHours?: string;
}

export class HighwaySecurityAdvisor {
  /**
   * Responde preguntas sobre seguridad carretera, horarios de riesgo y tramos peligrosos.
   */
  public static askQuestion(query: string): SecurityAdviceResponse {
    const q = query.toLowerCase().trim();

    // 1. Preguntas sobre horarios peligrosos o nocturnos
    if (q.includes('horario') || q.includes('hora') || q.includes('noche') || q.includes('nocturno') || q.includes('madrugada')) {
      return {
        title: 'Horarios de Circulación Segura en Carretera',
        category: 'horarios',
        warningLevel: 'high',
        summary: 'El 78% de los percances graves y asaltos en autopistas foráneas ocurren entre las 22:00 y las 05:30 horas.',
        safeHours: '06:00 a 18:30 (Horario Diurno Recomendado)',
        dangerHours: '21:00 a 05:30 (Horario de Alto Riesgo)',
        recommendations: [
          'Inicia tus traslados al amanecer (06:00 - 07:00 am) para llegar a tu destino con luz natural.',
          'Evita a toda costa circular después de las 22:00 hrs en tramos desérticos o autopistas de circunvalación (ej. Arco Norte, libramientos sin casetas).',
          'Si la noche te alcanza en carretera, NO te orilles en acotamiento desolado: busca una caseta de cobro (CAPUFE) o un paradero grande con restaurante iluminado y vigilancia de Guardia Nacional.',
          'Durante la noche la fatiga visual se duplica: el asfalto frío y los faros contrarios reducen el tiempo de reacción en un 40%.',
        ],
      };
    }

    // 2. Preguntas sobre tramos peligrosos, delincuencia o asaltos
    if (q.includes('peligros') || q.includes('riesgo') || q.includes('tramo') || q.includes('asalto') || q.includes('insegur') || q.includes('zona')) {
      return {
        title: 'Tramos Carreteros de Atención Prioritaria y Precaución',
        category: 'tramos_riesgo',
        warningLevel: 'high',
        summary: 'En carreteras federales, los puntos de mayor riesgo combinan curvas ciegas con barrancas, zonas de niebla densa o aislamiento geográfico.',
        recommendations: [
          'Tramo Cumbres de Maltrata (Puebla - Orizaba 150D): Descenso pronunciado con niebla densa constante. Manejar con luces intermitentes, motor engranado en 3ra marcha y reducir a 60 km/h.',
          'Arco Norte y Libramientos Periféricos: Frecuentes obstáculos en el asfalto de madrugada. Mantén siempre autopista de cuota en lugar de carretera libre.',
          'Carretera 57 (Matehuala - San Luis Potosí): Rectas extremadamente largas donde la monotonía causa dormitadas al volante y hay tramos de más de 80 km sin cobertura celular.',
          'Tramos Serranos / Cañones: Baja velocidad ante la posibilidad de deslaves de roca tras lluvias o piso con gravilla suelta.',
        ],
      };
    }

    // 3. Preguntas sobre falla mecánica o vulcanizadoras
    if (q.includes('falla') || q.includes('ponch') || q.includes('llanta') || q.includes('descomp') || q.includes('mecanic') || q.includes('calent')) {
      return {
        title: 'Protocolo de Seguridad ante Falla Mecánica en Carretera',
        category: 'falla_mecanica',
        warningLevel: 'high',
        summary: 'Quedar varado en carretera es la situación más vulnerable para el conductor. La visibilidad de tu auto es lo que salva tu vida.',
        recommendations: [
          'Banderolas y Triángulos: Si el coche se apaga, enciende intermitentes de inmediato y coloca los triángulos reflejantes a 50 y 100 metros detrás del auto.',
          'Bajo ninguna circunstancia te quedes sentado dentro del coche si estás detenido sobre el asfalto. Desciende por la puerta del copiloto y resguárdate detrás de la barrera de contención de concreto o metal.',
          'Usa el botón de la Bóveda SOS de esta app: genera un SMS directo con tus coordenadas satelitales GPS para tu aseguradora o familiares aunque no haya señal de internet 4G/5G.',
          'Llama al 074 (Ángeles Verdes / CAPUFE) para asistencia mecánica gratuita en autopistas federales de México.',
        ],
      };
    }

    // 4. Preguntas sobre gasolina o autonomía
    if (q.includes('gasolina') || q.includes('combustible') || q.includes('tanque') || q.includes('autonomia') || q.includes('cargar')) {
      return {
        title: 'Estrategia de Combustible en Carretera',
        category: 'combustible',
        warningLevel: 'medium',
        summary: 'En carretera la regla de oro es: NUNCA dejes bajar el tanque a menos de 1/4.',
        recommendations: [
          'Las gasolineras en tramos interurbanos pueden estar distanciadas entre 70 y 110 km.',
          'A 120-130 km/h el auto consume hasta un 25% más combustible que en ciudad debido a la resistencia aerodinámica.',
          'Carga siempre en estaciones de marcas reconocidas con alto flujo vehicular para evitar combustible con agua o impurezas.',
          'Aprovecha cada parada de combustible para revisar la presión de tus 4 llantas y el neumático de refacción.',
        ],
      };
    }

    // 5. Respuesta general inteligente
    return {
      title: 'Copiloto de Carretera: Consejos Clave de Navegación',
      category: 'general',
      warningLevel: 'info',
      summary: 'Tu seguridad en carretera depende de tres factores: luz natural, estado preventivo del auto y anticipación a zonas sin señal.',
      recommendations: [
        'Circula siempre con luz de día (06:00 a 18:00) y por autopistas de cobro (cuota).',
        'Revisa la presión de inflado en frío recomendada en el perfil del auto de esta app antes de salir.',
        'Esta aplicación precarga 15 km de corredor en la memoria de tu teléfono para que no te quedes sin mapa en zonas montañosas.',
        'Ante cualquier percance, presiona el botón "Bóveda SOS" en la barra superior.',
      ],
    };
  }
}
