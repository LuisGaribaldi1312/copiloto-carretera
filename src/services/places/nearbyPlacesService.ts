/**
 * Servicio de descubrimiento de negocios reales en la zona del usuario (Nominatim Bounded).
 */

export interface NearbyBusiness {
  id: string;
  name: string;
  category: 'fuel' | 'mechanic' | 'food' | 'store' | 'pharmacy' | 'other';
  lat: number;
  lng: number;
  address: string;
  distanceMeters?: number;
}

export class NearbyPlacesService {
  private static BASE_URL = 'https://nominatim.openstreetmap.org/search';

  /**
   * Calcula la distancia en metros entre dos puntos mediante fórmula Haversine.
   */
  public static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Busca negocios por término específico en el radio de la ubicación del usuario (ej. "Oxxo", "Taller", "Tacos").
   */
  public static async searchNearbyQuery(
    userLat: number,
    userLng: number,
    query: string,
    radiusKm: number = 6
  ): Promise<NearbyBusiness[]> {
    const delta = radiusKm / 111.0;
    const viewbox = `${userLng - delta},${userLat + delta},${userLng + delta},${userLat - delta}`;
    const url = `${this.BASE_URL}?format=json&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&limit=15&addressdetails=1`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'CopilotoGPS/1.0', 'Accept-Language': 'es' },
      });

      if (!response.ok) return [];
      const data = await response.json();

      return data.map((item: any) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const name = item.name || item.display_name.split(',')[0];
        const dist = this.calculateDistance(userLat, userLng, lat, lng);

        let category: NearbyBusiness['category'] = 'other';
        const qLow = query.toLowerCase();
        if (qLow.includes('gas') || qLow.includes('pemex') || qLow.includes('combust')) category = 'fuel';
        else if (qLow.includes('taller') || qLow.includes('vulca') || qLow.includes('llant')) category = 'mechanic';
        else if (qLow.includes('oxxo') || qLow.includes('tienda')) category = 'store';
        else if (qLow.includes('restauran') || qLow.includes('taco') || qLow.includes('comid')) category = 'food';
        else if (qLow.includes('farma')) category = 'pharmacy';

        return {
          id: item.place_id?.toString() || Math.random().toString(),
          name,
          category,
          lat,
          lng,
          address: item.display_name,
          distanceMeters: dist,
        };
      });
    } catch (err) {
      console.warn('Error buscando negocios cercanos:', err);
      return [];
    }
  }

  /**
   * Carga los negocios esenciales de la zona (gasolineras, vulcanizadoras, tiendas y comida).
   */
  public static async loadEssentialZoneBusinesses(userLat: number, userLng: number): Promise<NearbyBusiness[]> {
    const queries = ['gasolinera', 'taller mecanico', 'oxxo', 'restaurante'];
    const allResults: NearbyBusiness[] = [];

    for (const q of queries) {
      const results = await this.searchNearbyQuery(userLat, userLng, q, 5);
      allResults.push(...results);
      // Breve pausa para respetar rate limit de Nominatim
      await new Promise((r) => setTimeout(r, 200));
    }

    // Deduplicar por ID
    const unique = new Map<string, NearbyBusiness>();
    allResults.forEach((b) => unique.set(b.id, b));
    return Array.from(unique.values()).sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
  }
}
