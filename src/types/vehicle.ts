export type TireType = 'all_season' | 'summer' | 'highway_terrain' | 'all_terrain' | 'heavy_duty';

export type FuelType = 'regular' | 'premium' | 'diesel' | 'hybrid';

export interface VehicleProfile {
  id: string;
  make: string;
  model: string;
  year: number;
  nickname?: string;
  tankCapacityLiters: number;
  highwayEfficiencyKmPerL: number;
  cityEfficiencyKmPerL: number;
  currentFuelLiters: number;
  tireType: TireType;
  recommendedPsiCold: number;
  fuelType: FuelType;
  connectionMode: 'obd_ble' | 'manual_profile';
  pairedDeviceId?: string;
  lastUpdated: number;
}

export interface ObdTelemetry {
  isConnected: boolean;
  deviceName?: string;
  speedKmh: number;
  rpm: number;
  fuelLevelPct: number | null;
  coolantTempC: number | null;
  throttlePct: number | null;
  batteryVoltage: number | null;
  dtcCodes: string[];
  protocol?: string;
  lastPingMs: number;
}

export interface SmartAlert {
  id: string;
  type: 'tire_temp' | 'fatigue_warning' | 'low_fuel' | 'engine_dtc' | 'asphalt_heat';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionRequired: string;
  timestamp: number;
}

export interface TripState {
  totalKmCovered: number;
  continuousDrivingMinutes: number;
  ambientTempC: number;
  estimatedAsphaltTempC: number;
  avgSpeedKmh: number;
  estimatedFuelRemainingLiters: number;
  estimatedRangeKm: number;
}
