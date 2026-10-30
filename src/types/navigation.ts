export type PoiCategory = 
  | 'gas_station' 
  | 'vulcanizadora' 
  | 'rest_stop' 
  | 'dead_zone' 
  | 'risk_zone' 
  | 'mechanic'
  | 'police_station'
  | 'military_checkpoint'
  | 'toll_booth';

export type SecurityForceType = 
  | 'guardia_nacional'
  | 'ejercito_mexicano'
  | 'policia_estatal'
  | 'policia_municipal'
  | 'caseta_peaje';

export interface PoiItem {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  distanceKm: number;
  description: string;
  isOpen24h?: boolean;
  phone?: string;
  securityType?: SecurityForceType;
  fuelAdvice?: {
    isRecommended: boolean;
    reason: string;
    nextStationDistanceKm: number;
  };
  riskInfo?: {
    dangerLevel: 'high' | 'medium';
    nightOnly: boolean;
    reason: string;
  };
  deadZoneInfo?: {
    lengthKm: number;
    noticeDistanceKm: number;
  };
  weatherInfo?: {
    tempC: number;
    condition: string;
  };
}

export interface RouteCoordinate {
  lat: number;
  lng: number;
  speedLimitKmh?: number;
}

export interface NavigationState {
  currentLat: number;
  currentLng: number;
  headingDeg: number;
  speedKmh: number;
  speedLimitKmh: number;
  nextInstruction: string;
  distanceToTurnKm: number;
  totalRemainingKm: number;
  etaMinutes: number;
  isOnline: boolean;
  corridorCachedPct: number;
  isFollowingCar: boolean;
  isSimulating: boolean;
}
