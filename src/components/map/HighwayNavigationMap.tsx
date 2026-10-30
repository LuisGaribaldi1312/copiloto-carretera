import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VehicleProfile } from '../../types/vehicle';
import { HIGHWAY_POIS } from '../../services/navigation/mockHighwayData';
import { PoiCategory, PoiItem } from '../../types/navigation';
import { OsrmRoutingService, OsrmRouteResult } from '../../services/routing/osrmService';
import { GeocodingService, GeocodedPlace } from '../../services/routing/geocodingService';
import { NearbyPlacesService, NearbyBusiness } from '../../services/places/nearbyPlacesService';
import { HighwaySecurityModal } from '../security/HighwaySecurityModal';
import { MapOptimizerService } from '../../services/map/mapOptimizer';
import { DeepMindCopilotService, DeepMindAnalysisResult } from '../../services/ai/deepMindCopilotService';
import { DeepMindCopilotBanner } from '../ai/DeepMindCopilotBanner';
import { DeepMindCopilotModal } from '../ai/DeepMindCopilotModal';
import {
  Navigation,
  Fuel,
  Wrench,
  WifiOff,
  AlertTriangle,
  Play,
  Pause,
  Crosshair,
  Phone,
  MapPin,
  Search,
  ShieldCheck,
  Brain,
  X,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  PoliceBadge,
  MilitaryStar,
  TollBoothIcon,
  Mic,
  Volume2,
  VolumeX,
} from '../common/Icons';
import { VoiceNavigationService, VoiceCommandMatch } from '../../services/voice/voiceNavigationService';

// Configurar iconos por defecto de Leaflet para evitar 404
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  profile: VehicleProfile;
  onOpenSos: () => void;
}

interface DestinationPoint {
  lat: number;
  lng: number;
  name: string;
}

export const HighwayNavigationMap: React.FC<Props> = ({ profile, onOpenSos }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const corridorPolylineRef = useRef<any>(null);
  const poiLayerGroupRef = useRef<any>(null);
  const businessesLayerRef = useRef<any>(null);

  // Estilo de mapa (Calles, Satélite real HD, Nocturno)
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('streets');

  // GPS REAL DEL DISPOSITIVO
  const [useRealGps, setUseRealGps] = useState<boolean>(true);
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'active' | 'denied'>('requesting');
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(10);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [realHeading, setRealHeading] = useState<number | null>(null);
  const lastUserPosRef = useRef<[number, number] | null>(null);

  // NEGOCIOS Y PUNTOS EN LA ZONA EN VIVO
  const [nearbyBusinesses, setNearbyBusinesses] = useState<NearbyBusiness[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);

  // DESTINO Y ASIGNACIÓN DE RUTA
  const [destination, setDestination] = useState<DestinationPoint | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // RUTA OSRM
  const [osrmRoute, setOsrmRoute] = useState<OsrmRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // DEEPMIND COPILOT AI
  const [deepMindAnalysis, setDeepMindAnalysis] = useState<DeepMindAnalysisResult | null>(null);
  const [isDeepMindModalOpen, setIsDeepMindModalOpen] = useState<boolean>(false);
  const [isDeepMindAnalyzing, setIsDeepMindAnalyzing] = useState<boolean>(false);

  // COMANDOS DE VOZ Y GUÍA POR VOZ TIPO GOOGLE MAPS / WAZE
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceBannerMessage, setVoiceBannerMessage] = useState<string | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const lastSpokenManeuverRef = useRef<string>('');
  const lastAlertTimesRef = useRef<Record<string, number>>({});
  const [simCoordIdx, setSimCoordIdx] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [speedKmh, setSpeedKmh] = useState<number>(0);

  // Instalación PWA en Celular
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  // Capas activas (Servicios y Cuerpos de Seguridad Federal, Estatal, Municipal y Militar)
  const [activeLayers, setActiveLayers] = useState<Record<PoiCategory, boolean>>({
    gas_station: true,
    vulcanizadora: true,
    dead_zone: true,
    risk_zone: true,
    mechanic: true,
    rest_stop: true,
    police_station: true,
    military_checkpoint: true,
    toll_booth: true,
  });

  const [activeRoadAlert, setActiveRoadAlert] = useState<PoiItem | null>(null);

  // Detección dinámica y adaptación inteligente a orientación (Vertical vs Horizontal / Landscape)
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });
  const [isHudMinimized, setIsHudMinimized] = useState<boolean>(false);

  useEffect(() => {
    const handleOrientationOrResize = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);

      // Auto-minimizar HUD en modo horizontal si la pantalla es de baja altura (celulares) para no tapar la carretera
      if (landscape && window.innerHeight < 550) {
        setIsHudMinimized(true);
      }

      // Reajustar tamaño de Leaflet inmediatamente y con ráfaga suave
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 150);
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 400);
      }
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationOrResize);
    }

    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationOrResize);
      }
    };
  }, []);

  // Verificación reactiva de disponibilidad de Leaflet
  const [isLeafletReady, setIsLeafletReady] = useState<boolean>(
    typeof window !== 'undefined' && typeof (window as any).L !== 'undefined'
  );

  useEffect(() => {
    if (isLeafletReady) return;
    const interval = setInterval(() => {
      if (typeof (window as any).L !== 'undefined') {
        setIsLeafletReady(true);
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isLeafletReady]);

  // Capturar evento de instalación PWA
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // 1. SOLICITAR Y CENTRAR EXACTAMENTE LA UBICACIÓN GPS REAL DEL USUARIO
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('denied');
      return;
    }

    setGpsStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || 10;
        setUserPos([lat, lng]);
        lastUserPosRef.current = [lat, lng];
        setGpsAccuracy(acc);
        setGpsStatus('active');

        // Centrado exacto con recálculo de tamaño de mapa
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
        }

        // Cargar negocios reales de la zona donde se encuentra
        loadZoneBusinesses(lat, lng);
      },
      (err) => {
        console.warn('GPS inicial no disponible:', err);
        setGpsStatus('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );

    // Seguimiento continuo satelital con detección de orientación / heading
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || 10;
        const spd = pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : 0;
        const head = pos.coords.heading;

        // Si el sensor del dispositivo reporta heading directo (>0)
        if (head != null && !isNaN(head) && head >= 0) {
          setRealHeading(Math.round(head));
        } else if (lastUserPosRef.current) {
          // Si no tiene brújula pero se está moviendo, calcular vector direccional
          const [prevLat, prevLng] = lastUserPosRef.current;
          const distMoved = NearbyPlacesService.calculateDistance(prevLat, prevLng, lat, lng);
          if (distMoved >= 3) { // Se movió al menos 3 metros
            const calculated = calculateBearing(prevLat, prevLng, lat, lng);
            setRealHeading(Math.round(calculated));
            lastUserPosRef.current = [lat, lng];
          }
        } else {
          lastUserPosRef.current = [lat, lng];
        }

        setUserPos([lat, lng]);
        setGpsAccuracy(acc);
        setGpsStatus('active');
        if (useRealGps) {
          setSpeedKmh(spd);
        }
      },
      (err) => console.warn('Error en watchPosition:', err),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    // Escuchar también el sensor de orientación / giroscopio del celular si está disponible
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      // event.webkitCompassHeading para iOS Safari, event.alpha para Android
      const compass = (event as any).webkitCompassHeading != null 
        ? (event as any).webkitCompassHeading 
        : event.alpha != null 
        ? (360 - event.alpha) % 360 
        : null;

      if (compass != null && !isNaN(compass) && useRealGps) {
        setRealHeading(Math.round(compass));
      }
    };

    if (window.DeviceOrientationEvent && typeof (window as any).DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, [useRealGps]);

  // Cargar negocios esenciales de la zona
  const loadZoneBusinesses = async (lat: number, lng: number) => {
    setIsLoadingBusinesses(true);
    try {
      const places = await NearbyPlacesService.loadEssentialZoneBusinesses(lat, lng);
      setNearbyBusinesses(places);
    } catch (e) {
      console.warn('Error cargando negocios locales:', e);
    } finally {
      setIsLoadingBusinesses(false);
    }
  };

  // Buscar negocios o destinos específicos cuando el usuario escribe en la barra
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      // 1. Buscar en geocodificador general
      const results = await GeocodingService.searchPlaces(searchQuery);
      setSearchResults(results);
      setShowSearchDropdown(true);

      // 2. Si el usuario tiene GPS, buscar también negocios específicos cercanos
      if (userPos) {
        const localMatches = await NearbyPlacesService.searchNearbyQuery(userPos[0], userPos[1], searchQuery, 10);
        if (localMatches.length > 0) {
          setNearbyBusinesses((prev) => {
            const map = new Map<string, NearbyBusiness>();
            localMatches.forEach((m) => map.set(m.id, m));
            prev.forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      }
      setIsSearching(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery, userPos]);

  // 2. CALCULAR RUTA OSRM HACIA EL DESTINO SELECCIONADO
  const calculateRouteToDestination = async (destLat: number, destLng: number, destName: string) => {
    if (!userPos) {
      alert('Esperando la señal GPS de tu dispositivo para trazar la ruta...');
      return;
    }

    setIsLoadingRoute(true);
    setRouteError(null);
    try {
      const result = await OsrmRoutingService.calculateRoute(
        userPos[0],
        userPos[1],
        destLat,
        destLng,
        'Mi Ubicación Actual',
        destName
      );

      setOsrmRoute(result);
      setDestination({ lat: destLat, lng: destLng, name: destName });
      setSimCoordIdx(0);
      lastSpokenManeuverRef.current = '';

      // Anuncio por voz de inicio de ruta (Tipo Google Maps / Waze)
      if (!isVoiceMuted) {
        const hours = Math.floor(result.durationMinutes / 60);
        const mins = result.durationMinutes % 60;
        const timeStr = hours > 0 ? `${hours} horas y ${mins} minutos` : `${mins} minutos`;
        DeepMindCopilotService.speak(`Ruta trazada hacia ${destName}. Distancia: ${result.distanceKm} kilómetros, tiempo estimado: ${timeStr}. Buen viaje.`);
      }

      // 1. Precarga predictiva de teselas del corredor para regeneración ultrarrápida (0ms)
      MapOptimizerService.prefetchRouteCorridorTiles(result.coordinates, mapStyle);

      // 2. Ejecutar análisis cognitivo de DeepMind Copilot
      setIsDeepMindAnalyzing(true);
      DeepMindCopilotService.analyzeRoute(result, profile, speedKmh)
        .then((analysis) => {
          setDeepMindAnalysis(analysis);
          // Alertar por voz únicamente si se detecta un riesgo real en la ruta analizada
          if (!isVoiceMuted && (analysis.hazardLevel === 'high' || analysis.hazardLevel === 'critical')) {
            DeepMindCopilotService.speak(`Alerta de riesgo en la ruta: ${analysis.title}. ${analysis.summary}`);
          }
        })
        .catch((e) => console.warn('DeepMind analysis error:', e))
        .finally(() => setIsDeepMindAnalyzing(false));

      if (mapInstanceRef.current && result.coordinates.length > 0 && typeof L !== 'undefined') {
        const bounds = L.latLngBounds(result.coordinates);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRouteError(`No se pudo trazar la ruta: ${msg}`);
      console.error(err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleSelectSearchPlace = (place: GeocodedPlace) => {
    setShowSearchDropdown(false);
    setSearchQuery(place.name);
    calculateRouteToDestination(place.lat, place.lng, place.name);
  };

  const handleClearRoute = () => {
    setDestination(null);
    setOsrmRoute(null);
    setDeepMindAnalysis(null);
    setSearchQuery('');
    setRouteError(null);
    lastSpokenManeuverRef.current = '';

    if (!isVoiceMuted) {
      DeepMindCopilotService.speak('Ruta cancelada.');
    }

    if (routePolylineRef.current) routePolylineRef.current.setLatLngs([]);
    if (corridorPolylineRef.current) corridorPolylineRef.current.setLatLngs([]);
    if (destinationMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }

    if (userPos && mapInstanceRef.current) {
      mapInstanceRef.current.setView(userPos, 16, { animate: true });
    }
  };

  // GESTIÓN DE COMANDOS DE VOZ MANOS LIBRES (GOOGLE MAPS / WAZE)
  const handleVoiceCommand = (match: VoiceCommandMatch) => {
    setVoiceBannerMessage(`🎤 "${match.rawTranscript}"`);
    setTimeout(() => setVoiceBannerMessage(null), 5000);

    if (match.action === 'route_status') {
      // Monitoreo en vivo de ruta solicitado por el conductor
      if (!isVoiceMuted) {
        if (destination && osrmRoute) {
          const hours = Math.floor(osrmRoute.durationMinutes / 60);
          const mins = osrmRoute.durationMinutes % 60;
          const timeStr = hours > 0 ? `${hours} horas y ${mins} minutos` : `${mins} minutos`;
          let statusText = `Monitoreo en vivo: Te diriges a ${destination.name}. Distancia aproximada: ${osrmRoute.distanceKm} kilómetros, tiempo estimado: ${timeStr}. Velocidad actual: ${speedKmh} kilómetros por hora.`;
          if (deepMindAnalysis) {
            if (deepMindAnalysis.hazardLevel === 'high' || deepMindAnalysis.hazardLevel === 'critical') {
              statusText += ` Atención: ${deepMindAnalysis.title}. ${deepMindAnalysis.summary}`;
            } else {
              statusText += ` Condiciones de ruta favorables con calificación de seguridad del ${deepMindAnalysis.safetyScore} por ciento.`;
            }
          }
          DeepMindCopilotService.speak(statusText);
        } else {
          DeepMindCopilotService.speak('No hay ninguna ruta activa. Indica un destino por voz o en el buscador para iniciar el monitoreo en vivo.');
        }
      }
    } else if (match.action === 'cancel_route') {
      handleClearRoute();
    } else if (match.action === 'recenter') {
      handleRecenter();
    } else if (match.action === 'find_poi' && match.param) {
      // Activar la capa correspondiente y filtrar
      const category = match.param as PoiCategory;
      setActiveLayers((prev) => ({ ...prev, [category]: true }));
      const catNames: Record<string, string> = {
        gas_station: 'gasolineras',
        vulcanizadora: 'vulcanizadoras',
        police_station: 'bases de policía y guardia nacional',
        military_checkpoint: 'puntos de control militar',
        toll_booth: 'casetas de cobro',
      };
      if (!isVoiceMuted) {
        DeepMindCopilotService.speak(`Mostrando ${catNames[category] || 'puntos de asistencia'} cercanos en el mapa.`);
      }
    } else if (match.action === 'search_destination' && match.param) {
      setSearchQuery(match.param);
      GeocodingService.searchPlaces(match.param).then((places) => {
        if (places && places.length > 0) {
          const top = places[0];
          calculateRouteToDestination(top.lat, top.lng, top.name);
        } else {
          if (!isVoiceMuted) DeepMindCopilotService.speak(`No se encontró el destino ${match.param}.`);
        }
      });
    } else if (match.action === 'ask_gemini' && match.param) {
      if (!isVoiceMuted) {
        const routeContext = destination && osrmRoute
          ? `Ruta activa hacia ${destination.name}, distancia ${osrmRoute.distanceKm} km, velocidad ${speedKmh} km/h.`
          : `Sin ruta fijada, velocidad ${speedKmh} km/h.`;
        DeepMindCopilotService.queryAssistant(match.param, routeContext).then((answer) => {
          DeepMindCopilotService.speak(answer);
        });
      }
    }
  };

  const toggleVoiceAssistant = () => {
    if (isVoiceListening) {
      VoiceNavigationService.stopListening();
      setIsVoiceListening(false);
      // Silencio: no habla al desactivar
    } else {
      const started = VoiceNavigationService.startListening(
        handleVoiceCommand,
        (listening, _transcript, error) => {
          setIsVoiceListening(listening);
          if (error && error !== 'no-speech') {
            console.warn('Reconocimiento de voz:', error);
          }
        },
        true
      );
      if (started) {
        setIsVoiceListening(true);
        // Silencio: no hablar al activar el micrófono; permanece en escucha atenta
      } else {
        alert('El reconocimiento de voz no está disponible en este navegador o requiere permisos de micrófono.');
      }
    }
  };

  // Coordenadas activas de navegación
  const routeCoords = osrmRoute?.coordinates || [];
  const currentPos: [number, number] = useRealGps && userPos
    ? userPos
    : routeCoords.length > 0
    ? routeCoords[simCoordIdx] || userPos || [19.4326, -99.1332]
    : userPos || [19.4326, -99.1332];

  const nextPos: [number, number] = routeCoords.length > 0
    ? routeCoords[Math.min(simCoordIdx + 1, routeCoords.length - 1)]
    : currentPos;

  // Rumbo
  const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat));
    const x =
      Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
      Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  // Rumbo de la flecha de guía GPS:
  // 1. Si está en modo GPS real y el sensor o movimiento da rumbo -> se usa realHeading
  // 2. Si hay ruta activa trazada -> se orienta hacia el siguiente punto de la ruta
  // 3. Si no hay ruta ni movimiento, conserva el último rumbo calculado
  const routeBearing = calculateBearing(currentPos[0], currentPos[1], nextPos[0], nextPos[1]);
  const activeHeading = useRealGps && realHeading != null 
    ? realHeading 
    : (routeCoords.length > 0 ? routeBearing : (realHeading || 0));

  // Proveedores de mosaicos de alta disponibilidad y contraste automotriz
  const getTileLayerConfig = (style: 'streets' | 'satellite' | 'dark') => {
    if (style === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
          attribution: '&copy; Esri World Imagery',
          maxZoom: 19,
        },
      };
    }
    if (style === 'dark') {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; CartoDB, &copy; OpenStreetMap',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      };
    }
    // Calles: OpenStreetMap estándar global
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abc',
        maxZoom: 19,
      },
    };
  };

  // INICIALIZACIÓN DEL MAPA
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter = userPos || [19.4326, -99.1332];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: userPos ? 16 : 14,
      zoomControl: false,
    });

    const initialTileCfg = getTileLayerConfig(mapStyle);
    tileLayerRef.current = L.tileLayer(initialTileCfg.url, initialTileCfg.options).addTo(map);

    // Forzar redibujado inmediato para llenar el 100% de la pantalla
    map.invalidateSize();
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 350);
    setTimeout(() => map.invalidateSize(), 800);

    // Capas vectoriales
    corridorPolylineRef.current = L.polyline([], {
      color: '#0284c7',
      weight: 36,
      opacity: 0.14,
      lineCap: 'round',
    }).addTo(map);

    routePolylineRef.current = L.polyline([], {
      color: '#f59e0b',
      weight: 6,
      opacity: 0.95,
      lineJoin: 'round',
    }).addTo(map);

    accuracyCircleRef.current = L.circle(initialCenter, {
      radius: gpsAccuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);

    poiLayerGroupRef.current = L.layerGroup().addTo(map);
    businessesLayerRef.current = L.layerGroup().addTo(map);

    // Marcador de la flecha de guía GPS del vehículo (orientada a la dirección de marcha)
    const carHtml = `
      <div style="transform: rotate(${activeHeading}deg); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);" class="relative flex items-center justify-center">
        <div class="absolute w-14 h-14 bg-amber-500/25 rounded-full animate-ping"></div>
        <div class="w-10 h-10 bg-slate-950/90 border-2 border-amber-400 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/60 backdrop-blur-sm">
          <svg class="w-6 h-6 text-amber-400 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 20 21 12 17 4 21 12 2"/>
          </svg>
        </div>
      </div>
    `;

    carMarkerRef.current = L.marker(initialCenter, {
      icon: L.divIcon({
        html: carHtml,
        className: 'car-vehicle-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    }).addTo(map);

    // Tocar el mapa para fijar destino
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      calculateRouteToDestination(lat, lng, `Punto en Mapa (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
    });

    mapInstanceRef.current = map;

    // Forzar redibujado de teselas para ocupar el 100% de la pantalla sin huecos
    setTimeout(() => {
      map.invalidateSize();
    }, 120);
    setTimeout(() => {
      map.invalidateSize();
    }, 400);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Cambiar estilo de mapa
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const cfg = getTileLayerConfig(mapStyle);
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(mapInstanceRef.current);
    tileLayerRef.current.bringToBack();
    mapInstanceRef.current.invalidateSize();
  }, [mapStyle]);

  // Actualizar ruta OSRM y bandera de destino
  useEffect(() => {
    if (!mapInstanceRef.current || typeof L === 'undefined') return;

    if (corridorPolylineRef.current && routePolylineRef.current) {
      if (osrmRoute && osrmRoute.coordinates.length > 0) {
        corridorPolylineRef.current.setLatLngs(osrmRoute.coordinates);
        routePolylineRef.current.setLatLngs(osrmRoute.coordinates);
      } else {
        corridorPolylineRef.current.setLatLngs([]);
        routePolylineRef.current.setLatLngs([]);
      }
    }

    if (destination) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      } else {
        const destHtml = `
          <div class="flex flex-col items-center animate-bounce">
            <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-2xl text-white font-bold text-xs">
              🏁
            </div>
            <div class="bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap mt-1 border border-slate-700">
              ${destination.name}
            </div>
          </div>
        `;

        destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
          icon: L.divIcon({
            html: destHtml,
            className: 'destination-marker',
            iconSize: [40, 50],
            iconAnchor: [20, 45],
          }),
        }).addTo(mapInstanceRef.current);
      }
    } else if (destinationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
  }, [osrmRoute, destination]);

  // DIBUJAR NEGOCIOS REALES DE LA ZONA EN EL MAPA
  useEffect(() => {
    if (!mapInstanceRef.current || !businessesLayerRef.current || typeof L === 'undefined') return;

    businessesLayerRef.current.clearLayers();

    nearbyBusinesses.forEach((biz) => {
      let iconColor = 'bg-slate-800 border-slate-600 text-white';
      let iconEmoji = '📍';

      if (biz.category === 'police') {
        if (biz.subType === 'guardia_nacional') {
          iconColor = 'bg-slate-900 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400/50';
          iconEmoji = '🛡️';
        } else if (biz.subType === 'policia_estatal') {
          iconColor = 'bg-blue-700 border-blue-300 text-white';
          iconEmoji = '👮';
        } else {
          iconColor = 'bg-cyan-700 border-cyan-300 text-white';
          iconEmoji = '🚓';
        }
      } else if (biz.category === 'military') {
        iconColor = 'bg-emerald-800 border-emerald-400 text-amber-300 ring-2 ring-emerald-500/50';
        iconEmoji = '🎖️';
      } else if (biz.category === 'toll') {
        iconColor = 'bg-indigo-700 border-indigo-300 text-white';
        iconEmoji = '🛑';
      } else if (biz.category === 'fuel') {
        iconColor = 'bg-amber-500 border-amber-300 text-slate-950';
        iconEmoji = '⛽';
      } else if (biz.category === 'mechanic') {
        iconColor = 'bg-purple-600 border-purple-300 text-white';
        iconEmoji = '🔧';
      } else if (biz.category === 'store') {
        iconColor = 'bg-emerald-600 border-emerald-300 text-white';
        iconEmoji = '🏪';
      } else if (biz.category === 'food') {
        iconColor = 'bg-orange-600 border-orange-300 text-white';
        iconEmoji = '🍽️';
      } else if (biz.category === 'pharmacy') {
        iconColor = 'bg-blue-600 border-blue-300 text-white';
        iconEmoji = '💊';
      }

      const markerHtml = `
        <div class="w-7 h-7 rounded-xl ${iconColor} border-2 flex items-center justify-center font-bold text-xs shadow-lg shadow-black/60 cursor-pointer hover:scale-110 transition-transform">
          ${iconEmoji}
        </div>
      `;

      const marker = L.marker([biz.lat, biz.lng], {
        icon: L.divIcon({
          html: markerHtml,
          className: 'business-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });

      const popupHtml = `
        <div class="p-2 space-y-2 text-xs">
          <div class="font-bold text-sm text-white flex items-center gap-1.5">
            <span>${iconEmoji}</span>
            <span>${biz.name}</span>
          </div>
          <p class="text-slate-300 text-[11px] leading-relaxed">${biz.address}</p>
          <div class="text-amber-400 font-semibold text-[11px]">
            Aprox. a ${biz.distanceMeters ? `${biz.distanceMeters} metros` : 'tu zona'}
          </div>
          ${biz.phone ? `
            <div class="pt-1 flex items-center justify-between border-t border-slate-700/80">
              <span class="text-slate-300 text-[11px]">Línea Directa: <strong>${biz.phone}</strong></span>
              <a href="tel:${biz.phone}" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 rounded text-white font-bold text-[10px]">
                📞 Llamar
              </a>
            </div>
          ` : ''}
          <button
            onclick="window.dispatchEvent(new CustomEvent('route_to_business', { detail: { lat: ${biz.lat}, lng: ${biz.lng}, name: '${biz.name.replace(/'/g, "\\'")}' } }))"
            class="w-full mt-2 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all text-center block"
          >
            🧭 Trazar ruta hacia aquí
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      businessesLayerRef.current.addLayer(marker);
    });
  }, [nearbyBusinesses]);

  // Escuchar evento para trazar ruta hacia un negocio desde el popup
  useEffect(() => {
    const handleRouteToBiz = (e: any) => {
      const { lat, lng, name } = e.detail;
      calculateRouteToDestination(lat, lng, name);
    };
    window.addEventListener('route_to_business', handleRouteToBiz);
    return () => window.removeEventListener('route_to_business', handleRouteToBiz);
  }, [userPos]);

  // Actualizar posición del vehículo y círculo de precisión GPS
  useEffect(() => {
    if (!mapInstanceRef.current || !carMarkerRef.current || typeof L === 'undefined') return;

    carMarkerRef.current.setLatLng(currentPos);

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng(currentPos);
      accuracyCircleRef.current.setRadius(gpsAccuracy);
    }

    const carHtml = `
      <div style="transform: rotate(${activeHeading}deg); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);" class="relative flex items-center justify-center">
        <div class="absolute w-14 h-14 bg-amber-500/25 rounded-full animate-ping"></div>
        <div class="w-10 h-10 bg-slate-950/90 border-2 border-amber-400 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/60 backdrop-blur-sm">
          <svg class="w-6 h-6 text-amber-400 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 20 21 12 17 4 21 12 2"/>
          </svg>
        </div>
      </div>
    `;

    carMarkerRef.current.setIcon(
      L.divIcon({
        html: carHtml,
        className: 'car-vehicle-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
    );

    if (isFollowing) {
      mapInstanceRef.current.panTo(currentPos, { animate: true, duration: 0.8 });
    }
  }, [currentPos, activeHeading, isFollowing, gpsAccuracy]);

  // Actualizar POIs de autopista
  useEffect(() => {
    if (!mapInstanceRef.current || !poiLayerGroupRef.current || typeof L === 'undefined') return;

    poiLayerGroupRef.current.clearLayers();

    HIGHWAY_POIS.forEach((poi) => {
      if (!activeLayers[poi.category]) return;

      let iconColor = 'bg-blue-600 border-blue-400 text-white';
      let iconSvg = '📍';

      if (poi.category === 'police_station') {
        if (poi.securityType === 'guardia_nacional') {
          iconColor = 'bg-slate-900 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400/60 shadow-yellow-500/50';
          iconSvg = '🛡️';
        } else if (poi.securityType === 'policia_estatal') {
          iconColor = 'bg-blue-700 border-blue-300 text-white shadow-blue-500/50';
          iconSvg = '👮';
        } else {
          iconColor = 'bg-cyan-700 border-cyan-300 text-white shadow-cyan-500/50';
          iconSvg = '🚓';
        }
      } else if (poi.category === 'military_checkpoint') {
        iconColor = 'bg-emerald-800 border-emerald-400 text-amber-300 ring-2 ring-emerald-400/60 shadow-emerald-600/50';
        iconSvg = '🎖️';
      } else if (poi.category === 'toll_booth') {
        iconColor = 'bg-indigo-700 border-indigo-300 text-white shadow-indigo-500/50';
        iconSvg = '🛑';
      } else if (poi.category === 'gas_station') {
        iconColor = poi.fuelAdvice?.isRecommended
          ? 'bg-amber-500 border-amber-300 text-slate-950 animate-bounce'
          : 'bg-emerald-600 border-emerald-400 text-white';
        iconSvg = '⛽';
      } else if (poi.category === 'vulcanizadora') {
        iconColor = 'bg-purple-600 border-purple-400 text-white';
        iconSvg = '🔧';
      } else if (poi.category === 'dead_zone') {
        iconColor = 'bg-rose-600 border-rose-400 text-white animate-pulse';
        iconSvg = '📶';
      } else if (poi.category === 'risk_zone') {
        iconColor = 'bg-red-700 border-red-500 text-white';
        iconSvg = '⚠️';
      } else if (poi.category === 'mechanic') {
        iconColor = 'bg-cyan-600 border-cyan-400 text-white';
        iconSvg = '⚙️';
      } else if (poi.category === 'rest_stop') {
        iconColor = 'bg-slate-700 border-slate-500 text-white';
        iconSvg = '☕';
      }

      const marker = L.marker([poi.lat, poi.lng], {
        icon: L.divIcon({
          html: `<div class="w-8 h-8 rounded-xl ${iconColor} border-2 flex items-center justify-center font-bold text-xs shadow-lg shadow-black/60 cursor-pointer">${iconSvg}</div>`,
          className: 'poi-custom-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      });

      marker.bindPopup(`
        <div class="p-2 space-y-2 text-xs">
          <div class="font-bold text-sm text-white flex items-center gap-1.5">
            <span>${iconSvg}</span>
            <span>${poi.name}</span>
          </div>
          <p class="text-slate-300 leading-relaxed">${poi.description}</p>
          ${poi.fuelAdvice ? `<div class="p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold mt-1">⛽ ${poi.fuelAdvice.reason}</div>` : ''}
          ${poi.deadZoneInfo ? `<div class="p-2 rounded bg-red-950/40 border border-red-800 text-red-300 font-semibold mt-1">📶 Tramo sin señal: ${poi.deadZoneInfo.lengthKm} km continuos.</div>` : ''}
          ${poi.phone ? `
            <div class="pt-1 flex items-center justify-between border-t border-slate-700/80">
              <span class="text-slate-300 text-[11px]">Teléfono de Auxilio: <strong class="text-white">${poi.phone}</strong></span>
              <a href="tel:${poi.phone.replace(/\s+/g, '')}" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 rounded text-white font-bold text-[10px]">
                📞 Contactar
              </a>
            </div>
          ` : ''}
          <button
            onclick="window.dispatchEvent(new CustomEvent('route_to_business', { detail: { lat: ${poi.lat}, lng: ${poi.lng}, name: '${poi.name.replace(/'/g, "\\'")}' } }))"
            class="w-full mt-2 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all text-center block"
          >
            🧭 Trazar ruta hacia este punto
          </button>
        </div>
      `);

      marker.on('click', () => setActiveRoadAlert(poi));
      poiLayerGroupRef.current.addLayer(marker);
    });
  }, [activeLayers]);

  // Simulación opcional
  useEffect(() => {
    if (!isSimulating || useRealGps || routeCoords.length === 0) return;

    const interval = window.setInterval(() => {
      setSimCoordIdx((prev) => {
        const next = prev + 2 >= routeCoords.length ? 0 : prev + 2;
        return next;
      });
      setSpeedKmh(Math.round(95 + (Math.random() * 8 - 4)));
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulating, useRealGps, routeCoords.length]);

  // VOZ ACTIVA: INDICACIONES PASO A PASO (TIPO GOOGLE MAPS / WAZE)
  // Solo habla cuando existe una ruta activa definida (por voz o escrita)
  useEffect(() => {
    if (isVoiceMuted || !destination || !osrmRoute || !osrmRoute.steps || osrmRoute.steps.length === 0) return;

    const step = osrmRoute.steps[0];
    const key = `${step.instruction}_${step.roadName}`;

    // Si la instrucción no se ha dicho aún para este tramo
    if (key !== lastSpokenManeuverRef.current) {
      lastSpokenManeuverRef.current = key;
      const distStr = step.distanceMeters > 950 
        ? `En ${Math.round(step.distanceMeters / 1000)} kilómetros` 
        : `En ${step.distanceMeters} metros`;
      const speech = `${distStr}, ${step.instruction} en ${step.roadName || 'la carretera'}.`;
      DeepMindCopilotService.speak(speech);
    }
  }, [destination, osrmRoute, isVoiceMuted]);

  // VOZ ACTIVA: ALERTAS DE RIESGO PREVENTIVAS EN RUTA CON GEMINI AI
  // Solo se evalúan cuando hay una ruta activa trazada y se detecta un riesgo real
  useEffect(() => {
    if (isVoiceMuted || !destination || !osrmRoute) return;

    const now = Date.now();
    const COOLDOWN_MS = 180000; // Cooldown de 3 minutos para evitar repeticiones innecesarias

    // 1. Alerta de exceso de velocidad peligrosa en carretera
    if (speedKmh > 120) {
      const last = lastAlertTimesRef.current['speed'] || 0;
      if (now - last > COOLDOWN_MS) {
        lastAlertTimesRef.current['speed'] = now;
        DeepMindCopilotService.generateSecurityAlertAudio({
          alertType: 'speed_warning',
          currentSpeed: speedKmh,
          speedLimit: 110,
        }).then((text) => DeepMindCopilotService.speak(text));
      }
    }

    // 2. Alerta de combustible crítico en ruta
    if (profile.currentFuelLiters <= profile.tankCapacityLiters * 0.12) {
      const last = lastAlertTimesRef.current['fuel'] || 0;
      if (now - last > COOLDOWN_MS * 2) {
        lastAlertTimesRef.current['fuel'] = now;
        DeepMindCopilotService.generateSecurityAlertAudio({
          alertType: 'low_fuel',
        }).then((text) => DeepMindCopilotService.speak(text));
      }
    }

    // 3. Alerta de horario nocturno en autopista
    const hour = new Date().getHours();
    if ((hour >= 21 || hour < 5) && speedKmh > 50) {
      const last = lastAlertTimesRef.current['night'] || 0;
      if (now - last > COOLDOWN_MS * 3) {
        lastAlertTimesRef.current['night'] = now;
        DeepMindCopilotService.generateSecurityAlertAudio({
          alertType: 'night_risk',
        }).then((text) => DeepMindCopilotService.speak(text));
      }
    }
  }, [destination, osrmRoute, speedKmh, profile.currentFuelLiters, isVoiceMuted]);

  const toggleLayer = (layer: PoiCategory) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  const handleRecenter = () => {
    setIsFollowing(true);
    if (mapInstanceRef.current && userPos) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.setView(userPos, 16, { animate: true });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const toggleGpsMode = () => {
    if (useRealGps) {
      setUseRealGps(false);
      setIsSimulating(true);
    } else {
      setUseRealGps(true);
      setIsSimulating(false);
      if (userPos && mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView(userPos, 16, { animate: true });
      }
    }
  };

  const currentStep = osrmRoute?.steps && osrmRoute.steps.length > 0
    ? osrmRoute.steps[0]
    : null;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 select-none ${isLandscape ? 'orientation-landscape' : 'orientation-portrait'}`}>
      {/* Contenedor del Mapa Leaflet 100% Pantalla Completa Garantizado */}
      <div
        ref={mapContainerRef}
        id="leaflet-highway-map"
        className="w-full h-full cursor-crosshair z-0"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#070b14',
        }}
      />

      {/* ======================================================== */}
      {/* 1. BARRA SUPERIOR FLOTANTE: BUSCADOR & ACCIONES DE IA     */}
      {/* ======================================================== */}
      <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-5 sm:right-5 landscape:top-2 landscape:left-2 landscape:right-auto landscape:max-w-xl z-[1100] flex flex-col gap-1.5 sm:gap-2 pointer-events-none transition-all">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5">
          {/* Buscador Dinámico de Destinos y Negocios */}
          <div className="relative pointer-events-auto flex-1 min-w-[200px] sm:min-w-[240px] max-w-xl">
            <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-1.5 sm:p-2 shadow-2xl backdrop-blur-xl flex items-center gap-1.5 sm:gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busca destino o di 'Ir a...' (ej. Puebla, Pemex, Oxxo)..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none font-medium"
              />
              {(isLoadingRoute || isSearching || isLoadingBusinesses) && (
                <span className="animate-spin text-amber-400 text-xs px-1">⏳</span>
              )}

              {/* Botón Micrófono para Comandos de Voz Manos Libres (Tipo Google Maps / Waze) */}
              <button
                onClick={toggleVoiceAssistant}
                title={isVoiceListening ? 'Desactivar escucha por voz' : 'Activar Comandos de Voz (Manos Libres)'}
                className={`p-1.5 rounded-xl flex items-center justify-center transition-all ${
                  isVoiceListening
                    ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400 shadow-lg shadow-rose-600/40'
                    : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                }`}
              >
                {isVoiceListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Botón Silenciar / Activar Voz del Copiloto */}
              <button
                onClick={() => {
                  const nextMuted = !isVoiceMuted;
                  setIsVoiceMuted(nextMuted);
                  if (nextMuted) {
                    window.speechSynthesis?.cancel();
                  }
                }}
                title={isVoiceMuted ? 'Activar voz de indicaciones' : 'Silenciar voz'}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
              >
                {isVoiceMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
              {destination && (
                <button
                  onClick={handleClearRoute}
                  title="Cancelar ruta"
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            {/* Menú Desplegable de Sugerencias de Búsqueda */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-11 sm:top-14 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[1200] max-h-56 overflow-y-auto">
                {searchResults.map((place) => (
                  <button
                    key={place.placeId}
                    onClick={() => handleSelectSearchPlace(place)}
                    className="w-full text-left px-3 py-2 sm:px-3.5 sm:py-2.5 hover:bg-slate-800 border-b border-slate-800/80 last:border-none flex items-center gap-2 transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{place.name}</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">{place.fullAddress}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grupo de Botones Inteligentes: DeepMind IA + Seguridad + Límite 110 */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
            {/* Botón DeepMind Copilot AI */}
            <button
              onClick={() => setIsDeepMindModalOpen(true)}
              title="Abrir Asistente Cognitivo Google DeepMind"
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-amber-500 hover:from-indigo-500 hover:to-amber-400 text-white font-black rounded-2xl shadow-2xl text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 transition-all border border-indigo-400/50 group"
            >
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline landscape:hidden lg:landscape:inline">DeepMind IA</span>
              {isDeepMindAnalyzing ? (
                <span className="animate-spin text-[10px]">✨</span>
              ) : (
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            {/* Botón Asistente de Seguridad en Carretera */}
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              title="Consultar Horarios Seguros y Tramos Críticos"
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 bg-slate-900/95 hover:bg-slate-800 text-amber-400 font-bold rounded-2xl shadow-2xl text-[11px] sm:text-xs flex items-center gap-1.5 transition-all border border-slate-700/90"
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden md:inline landscape:hidden xl:landscape:inline">Seguridad & Horarios</span>
            </button>

            {/* Placa Límite Oficial MAX 110 */}
            <div className="w-8 h-8 sm:w-11 sm:h-11 p-0.5 sm:p-1 bg-white border-2 sm:border-[3px] border-red-600 rounded-full flex flex-col items-center justify-center shadow-2xl shrink-0">
              <span className="text-[6px] sm:text-[7px] font-black text-slate-800 -mb-0.5 leading-none">MAX</span>
              <span className="text-xs sm:text-base font-black text-slate-950 leading-none">110</span>
            </div>
          </div>
        </div>

        {/* Banner de Comando de Voz Reconocido (Manos Libres) */}
        {voiceBannerMessage && (
          <div className="bg-slate-900/95 border border-rose-500/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 pointer-events-auto max-w-sm sm:max-w-lg animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-xs text-white font-bold truncate">
              {voiceBannerMessage}
            </div>
          </div>
        )}

        {/* Banner de Próxima Maniobra OSRM */}
        {osrmRoute && (
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 sm:p-3 shadow-2xl backdrop-blur-md flex items-center gap-2.5 pointer-events-auto max-w-sm sm:max-w-lg transition-all">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black shrink-0 shadow-lg shadow-amber-500/25">
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5 flex-1 truncate">
              <div className="text-[10px] sm:text-[11px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>{currentStep ? `${currentStep.distanceMeters} m` : 'En ruta'}</span>
                <span>•</span>
                <span className="truncate">{currentStep?.roadName || 'Carretera'}</span>
              </div>
              <div className="text-xs font-extrabold text-white leading-tight truncate">
                {currentStep?.instruction || 'Sigue la ruta marcada'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-semibold block">Hacia</span>
              <strong className="text-xs text-white truncate max-w-[90px] sm:max-w-[110px] block">
                {destination?.name || 'Destino'}
              </strong>
            </div>
          </div>
        )}

        {/* Banner Táctico DeepMind Copilot AI */}
        {deepMindAnalysis && (
          <DeepMindCopilotBanner
            analysis={deepMindAnalysis}
            onOpenDetails={() => setIsDeepMindModalOpen(true)}
          />
        )}

        {/* Mensaje de Ayuda y Negocios Cargados */}
        {!destination && (
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-1 shadow-lg backdrop-blur-md text-[10px] sm:text-[11px] text-slate-300 flex items-center justify-between pointer-events-auto max-w-sm sm:max-w-lg">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span>Ubicación centrada. <strong>Toca el mapa</strong> o busca para trazar ruta.</span>
            </div>
            {nearbyBusinesses.length > 0 && (
              <span className="text-[9px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full ml-1.5 shrink-0 border border-amber-500/30">
                {nearbyBusinesses.length} Negocios
              </span>
            )}
          </div>
        )}

        {routeError && (
          <div className="bg-rose-950/90 border border-rose-700 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-md text-xs text-rose-200 pointer-events-auto max-w-md">
            ⚠️ {routeError}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. MUELLE DERECHO: ACCIONES RÁPIDAS AUTOMOTRICES (DOCK)  */}
      {/* ======================================================== */}
      <div className="absolute right-2 sm:right-5 top-14 sm:top-24 landscape:top-12 landscape:right-2 z-[1100] flex flex-col items-center gap-1.5 sm:gap-2 pointer-events-auto transition-all">
        {/* Recentrar en GPS */}
        <button
          onClick={handleRecenter}
          title="Recentrar en mi Ubicación Actual"
          className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-amber-400 shadow-2xl backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Botón Comandos de Voz Manos Libres en el Dock Derecho */}
        <button
          onClick={toggleVoiceAssistant}
          title={isVoiceListening ? 'Desactivar escucha por voz' : 'Activar Comandos de Voz Manos Libres'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
            isVoiceListening
              ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-rose-600/50'
              : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700/80 text-amber-400'
          }`}
        >
          {isVoiceListening ? <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Alternar Modo GPS (Real / Simulado) */}
        <button
          onClick={toggleGpsMode}
          title="Alternar GPS Real Satelital / Simulado"
          className={`px-2 py-1 sm:px-2.5 sm:py-1.5 border rounded-2xl shadow-xl backdrop-blur-xl text-[8px] sm:text-[9px] font-black flex items-center gap-1 transition-all ${
            useRealGps
              ? 'bg-emerald-600/95 text-white border-emerald-400'
              : 'bg-amber-500/95 text-slate-950 border-amber-400'
          }`}
        >
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${useRealGps ? 'bg-white animate-ping' : 'bg-slate-950'}`}></span>
          {useRealGps ? 'GPS' : 'SIM'}
        </button>

        {/* Control de Simulación (Play / Pause) */}
        {!useRealGps && osrmRoute && (
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            title={isSimulating ? 'Pausar Simulación' : 'Iniciar Simulación'}
            className={`w-9 h-9 sm:w-11 sm:h-11 border rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-center transition-all ${
              isSimulating
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        )}

        {/* Zoom In (+) */}
        <button
          onClick={handleZoomIn}
          title="Acercar mapa (+)"
          className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-white shadow-xl backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-base font-bold"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
        </button>

        {/* Zoom Out (-) */}
        <button
          onClick={handleZoomOut}
          title="Alejar mapa (-)"
          className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-white shadow-xl backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-base font-bold"
        >
          <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
        </button>

        {/* Botón SOS de Carretera de Alta Visibilidad */}
        <button
          onClick={onOpenSos}
          title="Bóveda SOS de Asistencia Inmediata"
          className="w-9 h-9 sm:w-11 sm:h-11 bg-rose-600 hover:bg-rose-500 border border-rose-400 rounded-2xl text-white shadow-2xl shadow-rose-900/60 backdrop-blur-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all animate-pulse"
        >
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Botón Instalar PWA en Celular */}
        {isInstallable && (
          <button
            onClick={handleInstallApp}
            title="Instalar App en Celular"
            className="px-2 py-1 sm:px-2.5 sm:py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold rounded-2xl shadow-2xl text-[8px] sm:text-[9px] flex items-center gap-1 border border-emerald-400 animate-bounce"
          >
            📲 App
          </button>
        )}
      </div>

      {/* Alerta Activa en Carretera */}
      {activeRoadAlert && (
        <div className="absolute top-24 left-2 right-2 sm:left-5 sm:w-96 z-[1150] animate-fade-in pointer-events-auto">
          <div
            className={`p-3 sm:p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-2.5 sm:gap-3 ${
              activeRoadAlert.category === 'gas_station'
                ? 'bg-amber-950/95 border-amber-600/60 text-amber-100'
                : activeRoadAlert.category === 'dead_zone'
                ? 'bg-rose-950/95 border-rose-600/60 text-rose-100'
                : activeRoadAlert.category === 'vulcanizadora'
                ? 'bg-purple-950/95 border-purple-600/60 text-purple-100'
                : 'bg-slate-900/95 border-slate-700 text-white'
            }`}
          >
            <div className="p-1.5 sm:p-2 bg-black/40 rounded-xl mt-0.5 shrink-0">
              {activeRoadAlert.category === 'gas_station' ? (
                <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              ) : activeRoadAlert.category === 'dead_zone' ? (
                <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
              ) : activeRoadAlert.category === 'vulcanizadora' ? (
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              )}
            </div>

            <div className="space-y-1 flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-white">{activeRoadAlert.name}</span>
                <button
                  onClick={() => setActiveRoadAlert(null)}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {activeRoadAlert.fuelAdvice && (
                <p className="text-amber-200 font-semibold leading-relaxed text-[11px] sm:text-xs">
                  👉 {activeRoadAlert.fuelAdvice.reason}
                </p>
              )}

              {activeRoadAlert.deadZoneInfo && (
                <p className="text-rose-200 font-semibold leading-relaxed text-[11px] sm:text-xs">
                  📡 ¡Atención! Próximo tramo de {activeRoadAlert.deadZoneInfo.lengthKm} km sin cobertura telefónica.
                </p>
              )}

              {activeRoadAlert.phone && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-slate-300 text-[10px] sm:text-xs">Asistencia: {activeRoadAlert.phone}</span>
                  <a
                    href={`tel:${activeRoadAlert.phone.replace(/\s+/g, '')}`}
                    className="px-2 py-0.5 sm:py-1 bg-white/20 hover:bg-white/30 rounded font-bold text-white flex items-center gap-1 text-[10px] sm:text-xs"
                  >
                    <Phone className="w-3 h-3" /> Llamar
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DOCK INFERIOR UNIFICADO: CAPAS, POIs, TELEMETRÍA & RUTA */}
      {/* ======================================================== */}
      <div className="absolute bottom-2 sm:bottom-3 left-2 right-2 sm:left-5 sm:right-5 landscape:bottom-2 landscape:left-2 landscape:right-auto landscape:max-w-xl z-[1100] pointer-events-auto transition-all">
        {/* Modo Minifiltro / Cápsula Compacta Automotriz (No obstruye la vista del camino) */}
        {isHudMinimized ? (
          <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl backdrop-blur-2xl flex items-center gap-3 animate-fade-in">
            {/* Velocidad */}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white leading-none">{speedKmh}</span>
              <span className="text-[10px] text-amber-400 font-bold">km/h</span>
            </div>

            <div className="h-4 w-px bg-slate-800"></div>

            {/* Datos Resumidos de Ruta */}
            <div className="flex-1 truncate text-xs font-semibold text-slate-300">
              {osrmRoute ? (
                <span className="flex items-center gap-1.5 truncate">
                  <strong className="text-white">{osrmRoute.distanceKm} km</strong>
                  <span className="text-amber-400 font-bold">({Math.floor(osrmRoute.durationMinutes / 60)}h {osrmRoute.durationMinutes % 60}m)</span>
                  <span className="truncate text-slate-400">• {destination?.name}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  GPS en vivo • Carretera
                </span>
              )}
            </div>

            {/* Botón para Expandir Panel */}
            <button
              onClick={() => setIsHudMinimized(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-[10px] flex items-center gap-1 border border-slate-700 shrink-0 transition-transform active:scale-95"
            >
              <span>Panel</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Panel Completo con Botón para Minimizar */
          <div className="bg-slate-950/95 border border-slate-800/90 rounded-3xl p-2 sm:p-3 landscape:p-2.5 shadow-2xl backdrop-blur-2xl flex flex-col gap-2 max-w-7xl mx-auto transition-all">
            
            {/* Fila A: Selector de Modo de Mapa, Filtros POI y Botón Minimizar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
                {/* Segmented Control para Modo de Mapa */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 border border-slate-700/80 p-0.5 sm:p-1 rounded-xl shrink-0 shadow-lg">
                  <button
                    onClick={() => setMapStyle('streets')}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                      mapStyle === 'streets'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🗺️</span>
                    <span>Calles</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('satellite')}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                      mapStyle === 'satellite'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🛰️</span>
                    <span>Satélite HD</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('dark')}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                      mapStyle === 'dark'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌙</span>
                    <span>Nocturno</span>
                  </button>
                </div>

                <span className="text-slate-700 font-bold hidden sm:inline">|</span>

                {/* Filtros POI Rápidos y Fuerzas de Seguridad */}
                <button
                  onClick={() => toggleLayer('police_station')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.police_station
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <PoliceBadge className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Policía & GN</span>
                </button>

                <button
                  onClick={() => toggleLayer('military_checkpoint')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.military_checkpoint
                      ? 'bg-emerald-700 text-amber-200 border-emerald-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <MilitaryStar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ejército SEDENA</span>
                </button>

                <button
                  onClick={() => toggleLayer('toll_booth')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.toll_booth
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <TollBoothIcon className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Casetas & Auxilio</span>
                </button>

                <button
                  onClick={() => toggleLayer('gas_station')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.gas_station
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <Fuel className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Gasolineras</span>
                </button>

                <button
                  onClick={() => toggleLayer('vulcanizadora')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.vulcanizadora
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Vulcanizadoras</span>
                </button>

                <button
                  onClick={() => toggleLayer('dead_zone')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.dead_zone
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Sin Señal</span>
                </button>

                <button
                  onClick={() => toggleLayer('risk_zone')}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap border flex items-center gap-1 shadow-md transition-all shrink-0 ${
                    activeLayers.risk_zone
                      ? 'bg-red-700 text-white border-red-500'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Tramos Riesgo</span>
                </button>
              </div>

              {/* Botón para Minimizar y despejar la carretera */}
              <button
                onClick={() => setIsHudMinimized(true)}
                title="Minimizar panel para ver carretera despejada"
                className="p-1 sm:px-2 sm:py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold border border-slate-800 flex items-center gap-1 shrink-0"
              >
                <span className="hidden sm:inline">Despejar</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fila B: Velocímetro, Métricas de Viaje y Caché Offline */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-1 border-t border-slate-800/80">
              {/* Velocímetro Digital */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="px-2 py-1 sm:px-2.5 sm:py-1.5 bg-slate-900/95 rounded-2xl border border-slate-800 flex items-baseline gap-1 shadow-inner">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">{speedKmh}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-400">km/h</span>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-bold text-slate-200 truncate max-w-[120px]">
                    {profile.make} {profile.model}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-semibold flex items-center gap-1">
                    {useRealGps && gpsStatus === 'active' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        GPS (±{Math.round(gpsAccuracy)}m)
                      </span>
                    ) : gpsStatus === 'requesting' ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        Buscando satélites...
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        Simulado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Información OSRM de Ruta */}
              <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 flex-1 sm:flex-initial">
                <div className="text-left sm:text-right">
                  <div className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-semibold">Distancia</div>
                  <div className="text-xs sm:text-sm font-black text-white">
                    {osrmRoute ? `${osrmRoute.distanceKm} km` : destination ? 'Calculando...' : '-- km'}
                  </div>
                </div>

                <div className="text-center sm:text-right">
                  <div className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-semibold">Tiempo</div>
                  <div className="text-xs sm:text-sm font-black text-amber-400">
                    {osrmRoute ? `${Math.floor(osrmRoute.durationMinutes / 60)}h ${osrmRoute.durationMinutes % 60}m` : '--'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-semibold">Destino</div>
                  <div className="text-[11px] sm:text-xs font-black text-white truncate max-w-[80px] sm:max-w-[130px]">
                    {destination ? destination.name : 'Sin fijar'}
                  </div>
                </div>

                {destination && (
                  <button
                    onClick={handleClearRoute}
                    title="Cancelar ruta"
                    className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold border border-slate-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Estado de Caché Offline del Corredor */}
              <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 rounded-xl border border-slate-800 text-[10px] shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                <div>
                  <div className="font-bold text-white text-[10px]">Corredor 15 km</div>
                  <div className="text-[8px] text-slate-400 leading-none">Offline</div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Modal Asesor de Seguridad en Carretera */}
      <HighwaySecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      {/* Modal Inteligente Google DeepMind Copilot */}
      <DeepMindCopilotModal
        isOpen={isDeepMindModalOpen}
        onClose={() => setIsDeepMindModalOpen(false)}
        analysis={deepMindAnalysis}
        onRefreshAnalysis={() => {
          if (osrmRoute) {
            setIsDeepMindAnalyzing(true);
            DeepMindCopilotService.analyzeRoute(osrmRoute, profile, speedKmh)
              .then(setDeepMindAnalysis)
              .finally(() => setIsDeepMindAnalyzing(false));
          }
        }}
      />
    </div>
  );
};
