/**
 * Servicio de búsqueda y geocodificación de destinos libre (OpenStreetMap / Nominatim).
 */

export interface GeocodedPlace {
  placeId: string;
  name: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

export class GeocodingService {
  private static NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

  public static async searchPlaces(query: string): Promise<GeocodedPlace[]> {
    if (!query || query.trim().length < 2) return [];

    const url = `${this.NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es',
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.map((item: any) => ({
        placeId: item.place_id?.toString() || Math.random().toString(),
        name: item.name || item.display_name.split(',')[0],
        fullAddress: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    } catch (err) {
      console.warn('Error en búsqueda de lugares con Nominatim:', err);
      return [];
    }
  }
}
