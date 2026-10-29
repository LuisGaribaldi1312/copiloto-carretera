import { VehicleProfile, SmartAlert, TripState, ObdTelemetry } from '../../types/vehicle';

export class VehicleEstimator {
  /**
   * Calcula el factor de corrección por velocidad aerodinámica.
   * A 90 km/h el rendimiento es cercano al 100% nominal; a 130 km/h aumenta la fricción del viento.
   */
  public static getSpeedConsumptionMultiplier(speedKmh: number): number {
    if (speedKmh <= 70) return 0.95;
    if (speedKmh <= 95) return 1.0;
    if (speedKmh <= 115) return 1.12; // 12% más gasto
    if (speedKmh <= 130) return 1.25; // 25% más gasto
    return 1.40; // >130 km/h consume hasta 40% más
  }

  /**
   * Estima el combustible restante y la autonomía en modo manual usando el GPS y el perfil del auto.
   */
  public static calculateManualTrip(
    profile: VehicleProfile,
    kmTraveled: number,
    avgSpeedKmh: number
  ): { remainingLiters: number; remainingRangeKm: number; pct: number } {
    const speedFactor = this.getSpeedConsumptionMultiplier(avgSpeedKmh);
    const effectiveKmPerL = profile.highwayEfficiencyKmPerL / speedFactor;

    const fuelConsumedLiters = kmTraveled / Math.max(effectiveKmPerL, 1);
    const remainingLiters = Math.max(0, profile.currentFuelLiters - fuelConsumedLiters);
    const remainingRangeKm = Math.round(remainingLiters * profile.highwayEfficiencyKmPerL);
    const pct = Math.round((remainingLiters / profile.tankCapacityLiters) * 100);

    return {
      remainingLiters: parseFloat(remainingLiters.toFixed(1)),
      remainingRangeKm,
      pct,
    };
  }

  /**
   * Estima la temperatura superficial del asfalto basada en el clima ambiente y radiación solar.
   */
  public static estimateAsphaltTemperature(ambientTempC: number, isDaylight: boolean = true): number {
    if (!isDaylight) {
      return ambientTempC + 2; // Noche: asfalto retiene poco calor
    }
    // Con sol diurno directo, el asfalto suele calentarse entre 15°C y 22°C más que el aire ambiente
    return ambientTempC + 18;
  }

  /**
   * Genera alertas proactivas inteligentes para llantas, combustible, descanso y motor.
   */
  public static evaluateSmartAlerts(
    profile: VehicleProfile,
    trip: TripState,
    obd?: ObdTelemetry
  ): SmartAlert[] {
    const alerts: SmartAlert[] = [];
    const now = Date.now();

    // 1. Alerta de Llantas y Calor de Asfalto
    const asphaltTemp = trip.estimatedAsphaltTempC;
    if (asphaltTemp >= 50 && trip.continuousDrivingMinutes >= 60) {
      alerts.push({
        id: 'tire-heat-warning',
        type: 'tire_temp',
        severity: 'warning',
        title: 'Calor Extremo en Asfalto y Llantas',
        message: `El asfalto ronda los ${Math.round(asphaltTemp)}°C y llevas ${Math.round(trip.continuousDrivingMinutes)} min rodando.`,
        actionRequired: `El calor expande el aire interior hasta 5 PSI. Revisa presión y desgaste en la siguiente parada. Presión recomendada en frío: ${profile.recommendedPsiCold} PSI.`,
        timestamp: now,
      });
    }

    // 2. Alerta de Fatiga del Conductor y Mecánica Continua
    if (trip.continuousDrivingMinutes >= 120) {
      const hours = (trip.continuousDrivingMinutes / 60).toFixed(1);
      alerts.push({
        id: 'fatigue-stop-warning',
        type: 'fatigue_warning',
        severity: trip.continuousDrivingMinutes >= 180 ? 'critical' : 'warning',
        title: 'Pausa de Seguridad Recomendada',
        message: `Llevas ${hours} horas continuas al volante sin descanso.`,
        actionRequired: 'La fatiga al volante es la causa #1 de percances nocturnos. Busca un paradero seguro para estirar piernas y revisar niveles de aceite/agua.',
        timestamp: now,
      });
    }

    // 3. Alerta de Combustible Crítico
    const currentFuelLiters = obd?.fuelLevelPct != null
      ? (profile.tankCapacityLiters * obd.fuelLevelPct) / 100
      : trip.estimatedFuelRemainingLiters;

    const remainingRange = trip.estimatedRangeKm;

    if (remainingRange <= 70 || (currentFuelLiters / profile.tankCapacityLiters) <= 0.15) {
      alerts.push({
        id: 'low-fuel-alert',
        type: 'low_fuel',
        severity: remainingRange <= 35 ? 'critical' : 'warning',
        title: 'Reserva de Gasolina Comprometida',
        message: `Autonomía estimada: ${remainingRange} km (${currentFuelLiters.toFixed(1)} L restantes).`,
        actionRequired: 'En carretera las gasolineras pueden distar más de 60 km. Carga en la estación más próxima.',
        timestamp: now,
      });
    }

    // 4. Códigos de Falla OBD-II (Check Engine)
    if (obd && obd.dtcCodes.length > 0) {
      alerts.push({
        id: 'obd-dtc-alert',
        type: 'engine_dtc',
        severity: 'critical',
        title: `Código de Falla de Motor: ${obd.dtcCodes.join(', ')}`,
        message: 'La computadora del vehículo reporta un código de error de diagnóstico activo.',
        actionRequired: 'No aceleres bruscamente ni remolques peso excesivo. Monitorea la temperatura del motor.',
        timestamp: now,
      });
    }

    return alerts;
  }
}
