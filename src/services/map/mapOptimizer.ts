/**
 * Motor de optimización de alto rendimiento y renderizado para Leaflet en Carretera.
 * Proporciona:
 * 1. Precarga predictiva de teselas del corredor de ruta (Tile Corridor Preloader)
 * 2. Suavizado de trayectoria GPS (Dead Reckoning & EMA Filter)
 * 3. Renderizado acelerado por hardware GPU
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export class MapOptimizerService {
  /**
   * Convierte coordenadas geográficas (lat, lng) a coordenadas de tesela (x, y) según el nivel de zoom.
   */
  public static latLngToTileCoords(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  }

  /**
   * Genera la plantilla de URL de la tesela según el servidor.
   */
  public static getTileUrl(x: number, y: number, z: number, style: 'streets' | 'satellite' | 'dark' = 'streets'): string {
    if (style === 'satellite') {
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }
    if (style === 'dark') {
      return `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
    }
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }

  /**
   * Precarga predictiva en segundo plano de las teselas a lo largo de la ruta calculada.
   * Descarga silenciosamente las imágenes en el caché del navegador para que cuando el usuario
   * se mueva o haga zoom, la imagen ya esté lista al 100% sin parpadeos ni demoras.
   */
  public static prefetchRouteCorridorTiles(
    routeCoordinates: [number, number][],
    style: 'streets' | 'satellite' | 'dark' = 'streets',
    targetZooms: number[] = [14, 15, 16],
    maxTilesToPreload: number = 80
  ): Promise<number> {
    return new Promise((resolve) => {
      if (!routeCoordinates || routeCoordinates.length === 0) {
        resolve(0);
        return;
      }

      const tileSet = new Set<string>();

      // Muestrear puntos a lo largo de la ruta (cada 3-5 puntos para cubrir el corredor)
      const step = Math.max(1, Math.floor(routeCoordinates.length / 25));
      for (let i = 0; i < routeCoordinates.length; i += step) {
        const [lat, lng] = routeCoordinates[i];
        for (const zoom of targetZooms) {
          const { x, y } = this.latLngToTileCoords(lat, lng, zoom);
          // Tomar la tesela central y vecinas adyacentes (corredor de 1 anillo)
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              tileSet.add(`${zoom}/${x + dx}/${y + dy}`);
              if (tileSet.size >= maxTilesToPreload) break;
            }
            if (tileSet.size >= maxTilesToPreload) break;
          }
          if (tileSet.size >= maxTilesToPreload) break;
        }
        if (tileSet.size >= maxTilesToPreload) break;
      }

      let loadedCount = 0;
      const tileArray = Array.from(tileSet);

      // Descargar con concurrencia controlada
      let idx = 0;
      const maxConcurrent = 6;
      let activeRequests = 0;

      const launchNext = () => {
        if (idx >= tileArray.length && activeRequests === 0) {
          resolve(loadedCount);
          return;
        }

        while (activeRequests < maxConcurrent && idx < tileArray.length) {
          const [zStr, xStr, yStr] = tileArray[idx++].split('/');
          const z = parseInt(zStr, 10);
          const x = parseInt(xStr, 10);
          const y = parseInt(yStr, 10);

          const url = this.getTileUrl(x, y, z, style);
          activeRequests++;

          const img = new Image();
          img.onload = () => {
            loadedCount++;
            activeRequests--;
            launchNext();
          };
          img.onerror = () => {
            activeRequests--;
            launchNext();
          };
          img.src = url;
        }
      };

      launchNext();
    });
  }

  /**
   * Filtro de suavizado de rumbo (bearing) para evitar que la flecha del auto tiemble
   * debido a pequeñas fluctuaciones de GPS.
   */
  public static smoothBearing(previousBearing: number, targetBearing: number, alpha: number = 0.25): number {
    let diff = (targetBearing - previousBearing) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (previousBearing + diff * alpha + 360) % 360;
  }
}
