/**
 * Servicio de Enrutamiento Abierto OSRM (Open Source Routing Machine).
 * Calcula rutas reales de autopista, pasos paso a paso y precarga de corredor offline.
 */

export interface OsrmStep {
  instruction: string;
  roadName: string;
  type: string;
  modifier?: string;
  distanceMeters: number;
  durationSeconds: number;
  lat: number;
  lng: number;
}

export interface OsrmRouteResult {
  coordinates: Array<[number, number]>; // [lat, lng] listo para Leaflet
  distanceKm: number;
  durationMinutes: number;
  steps: OsrmStep[];
  originName: string;
  destName: string;
  cachedAt: number;
}

export interface PresetDestination {
  id: string;
  label: string;
  originName: string;
  destName: string;
  origin: [number, number]; // [lat, lng]
  destination: [number, number]; // [lat, lng]
}

export const PRESET_ROUTES: PresetDestination[] = [
  {
    id: 'gdl-qro',
    label: 'Guadalajara ➜ Querétaro (Autopista 80D/45D)',
    originName: 'Guadalajara, Jalisco',
    destName: 'Santiago de Querétaro',
    origin: [20.6736, -103.3440],
    destination: [20.5888, -100.3899],
  },
  {
    id: 'cdmx-acapulco',
    label: 'CDMX ➜ Acapulco (Autopista del Sol 95D)',
    originName: 'Ciudad de México',
    destName: 'Acapulco, Guerrero',
    origin: [19.4326, -99.1332],
    destination: [16.8531, -99.8237],
  },
  {
    id: 'mty-saltillo',
    label: 'Monterrey ➜ Saltillo (Autopista 40D)',
    originName: 'Monterrey, N.L.',
    destName: 'Saltillo, Coahuila',
    origin: [25.6866, -100.3161],
    destination: [25.4267, -101.0053],
  },
  {
    id: 'puebla-veracruz',
    label: 'Puebla ➜ Veracruz (Autopista 150D)',
    originName: 'Puebla, Pue.',
    destName: 'Veracruz, Ver.',
    origin: [19.0414, -98.2063],
    destination: [19.1738, -96.1342],
  },
];

const OSRM_CACHE_KEY = 'copiloto_osrm_active_route';

export class OsrmRoutingService {
  private static OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

  /**
   * Traduce la maniobra cruda de OSRM a instrucciones legibles en español de carretera.
   */
  private static formatManeuverInstruction(type: string, modifier?: string, name?: string): string {
    const road = name ? ` en "${name}"` : '';

    switch (type) {
      case 'depart':
        return `Inicia tu ruta hacia${road}`;
      case 'arrive':
        return 'Has llegado a tu destino';
      case 'turn':
        if (modifier === 'right') return `Gira a la derecha${road}`;
        if (modifier === 'left') return `Gira a la izquierda${road}`;
        if (modifier === 'slight right') return `Gira levemente a la derecha${road}`;
        if (modifier === 'slight left') return `Gira levemente a la izquierda${road}`;
        if (modifier === 'sharp right') return `Curva cerrada a la derecha${road}`;
        if (modifier === 'sharp left') return `Curva cerrada a la izquierda${road}`;
        return `Gira${road}`;
      case 'new name':
      case 'continue':
        return `Continúa derecho${road}`;
      case 'fork':
        if (modifier === 'left') return `Toma la bifurcación izquierda hacia${road}`;
        return `Toma la bifurcación derecha hacia${road}`;
      case 'merge':
        return `Incorpórate a la autopista${road}`;
      case 'on ramp':
        return `Toma la rampa de acceso a${road}`;
      case 'off ramp':
        return `Toma la salida de la autopista hacia${road}`;
      case 'roundabout':
        return `Entra en la rotonda y toma la salida hacia${road}`;
      default:
        return `Continúa por${road || ' la carretera'}`;
    }
  }

  /**
   * Consulta OSRM para trazar una ruta real con geometría GeoJSON completa y pasos paso a paso.
   */
  public static async calculateRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    originName: string = 'Origen',
    destName: string = 'Destino'
  ): Promise<OsrmRouteResult> {
    const url = `${this.OSRM_BASE_URL}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true&annotations=true`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error en servidor OSRM HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(data.message || 'OSRM no encontró una ruta viable para vehículos.');
      }

      const route = data.routes[0];
      const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
      const durationMinutes = Math.round(route.duration / 60);

      // GeoJSON OSRM entrega [lon, lat]; convertimos a [lat, lng] para Leaflet
      const coordinates: Array<[number, number]> = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );

      // Procesar maniobras paso a paso
      const steps: OsrmStep[] = [];
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach((s: any) => {
          const loc = s.maneuver.location;
          steps.push({
            instruction: this.formatManeuverInstruction(s.maneuver.type, s.maneuver.modifier, s.name),
            roadName: s.name || 'Carretera',
            type: s.maneuver.type,
            modifier: s.maneuver.modifier,
            distanceMeters: Math.round(s.distance),
            durationSeconds: Math.round(s.duration),
            lat: loc[1],
            lng: loc[0],
          });
        });
      }

      const result: OsrmRouteResult = {
        coordinates,
        distanceKm,
        durationMinutes,
        steps,
        originName,
        destName,
        cachedAt: Date.now(),
      };

      // Guardar en almacenamiento offline
      this.cacheRoute(result);
      return result;
    } catch (err) {
      console.warn('Fallo consulta online de OSRM, buscando en caché local...', err);
      const cached = this.getCachedRoute();
      if (cached) {
        return cached;
      }
      throw err;
    }
  }

  /**
   * Guarda la ruta en caché local para navegación sin conexión a internet (Offline-First).
   */
  public static cacheRoute(route: OsrmRouteResult): void {
    try {
      localStorage.setItem(OSRM_CACHE_KEY, JSON.stringify(route));
    } catch (e) {
      console.error('Error al guardar ruta OSRM en caché:', e);
    }
  }

  /**
   * Recupera la última ruta precargada cuando el auto pierde señal en carretera.
   */
  public static getCachedRoute(): OsrmRouteResult | null {
    try {
      const data = localStorage.getItem(OSRM_CACHE_KEY);
      if (data) {
        return JSON.parse(data) as OsrmRouteResult;
      }
    } catch (e) {
      console.error('Error al leer ruta OSRM desde caché:', e);
    }
    return null;
  }
}
