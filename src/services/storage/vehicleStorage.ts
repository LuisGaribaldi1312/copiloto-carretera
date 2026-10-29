import { VehicleProfile } from '../../types/vehicle';

const STORAGE_KEY = 'copiloto_vehicle_profile';

export const DEFAULT_VEHICLE_PROFILE: VehicleProfile = {
  id: 'profile_default',
  make: 'Nissan',
  model: 'Versa',
  year: 2021,
  nickname: 'Mi Auto de Carretera',
  tankCapacityLiters: 41,
  highwayEfficiencyKmPerL: 16.5,
  cityEfficiencyKmPerL: 13.0,
  currentFuelLiters: 35,
  tireType: 'all_season',
  recommendedPsiCold: 33,
  fuelType: 'regular',
  connectionMode: 'manual_profile',
  lastUpdated: Date.now(),
};

export class VehicleStorageService {
  public static loadProfile(): VehicleProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as VehicleProfile;
      }
    } catch (e) {
      console.error('Error cargando perfil del auto:', e);
    }
    return { ...DEFAULT_VEHICLE_PROFILE };
  }

  public static saveProfile(profile: VehicleProfile): void {
    try {
      const toSave = { ...profile, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error guardando perfil del auto:', e);
    }
  }
}
