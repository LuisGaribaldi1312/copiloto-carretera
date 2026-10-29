import React, { useState, useEffect } from 'react';
import { VehicleProfile, ObdTelemetry, TripState, SmartAlert } from '../../types/vehicle';
import { obdService, ObdConnectionState } from '../../services/obd/obdBluetoothService';
import { VehicleEstimator } from '../../services/telemetry/vehicleEstimator';
import { 
  Bluetooth, 
  Play, 
  Square, 
  AlertTriangle, 
  CheckCircle2, 
  Fuel, 
  Gauge, 
  Thermometer, 
  Zap, 
  Disc, 
  Activity,
  AlertCircle
} from '../common/Icons';

interface Props {
  profile: VehicleProfile;
  onEditProfile: () => void;
}

export const ObdLiveMonitor: React.FC<Props> = ({ profile, onEditProfile }) => {
  const [telemetry, setTelemetry] = useState<ObdTelemetry>(obdService.telemetry);
  const [connectionState, setConnectionState] = useState<ObdConnectionState>(obdService.state);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Estado del viaje simulado/actual para cálculo de llantas y fatiga
  const tripState: TripState = {
    totalKmCovered: 145,
    continuousDrivingMinutes: 130, // 2h 10m para probar la alerta de fatiga y calor
    ambientTempC: 34,              // 34°C para probar alerta de calor en asfalto
    estimatedAsphaltTempC: 52,     // 52°C asfalto caliente
    avgSpeedKmh: 98,
    estimatedFuelRemainingLiters: 22,
    estimatedRangeKm: 363,
  };

  const [alerts, setAlerts] = useState<SmartAlert[]>([]);

  useEffect(() => {
    const unsubTelemetry = obdService.onTelemetry((data) => {
      setTelemetry({ ...data });
    });

    const unsubState = obdService.onStateChange((state, msg) => {
      setConnectionState(state);
      if (msg) setStatusMessage(msg);
      if (state === 'connected' && msg?.includes('Simulación')) {
        setIsSimulating(true);
      } else if (state === 'disconnected') {
        setIsSimulating(false);
      }
    });

    return () => {
      unsubTelemetry();
      unsubState();
    };
  }, []);

  // Recalcular alertas inteligentes cuando cambia la telemetría o el viaje
  useEffect(() => {
    // Si OBD provee combustible real en litros:
    let fuelRem = tripState.estimatedFuelRemainingLiters;
    if (telemetry.fuelLevelPct != null) {
      fuelRem = (profile.tankCapacityLiters * telemetry.fuelLevelPct) / 100;
    }

    const currentTrip: TripState = {
      ...tripState,
      estimatedFuelRemainingLiters: fuelRem,
      estimatedRangeKm: Math.round(fuelRem * profile.highwayEfficiencyKmPerL),
      estimatedAsphaltTempC: VehicleEstimator.estimateAsphaltTemperature(tripState.ambientTempC, true),
    };

    const smartAlerts = VehicleEstimator.evaluateSmartAlerts(profile, currentTrip, telemetry);
    setAlerts(smartAlerts);
  }, [telemetry, tripState, profile]);

  const handleConnectBle = async () => {
    try {
      setStatusMessage('Iniciando emparejamiento Bluetooth...');
      await obdService.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(msg);
    }
  };

  const handleStartSimulation = () => {
    obdService.startSimulation();
    setIsSimulating(true);
  };

  const handleDisconnect = async () => {
    await obdService.disconnect();
    setIsSimulating(false);
  };

  // Cálculo de nivel de combustible a mostrar (OBD real o Estimado matemático)
  const effectiveFuelPct = telemetry.fuelLevelPct != null
    ? telemetry.fuelLevelPct
    : Math.round((tripState.estimatedFuelRemainingLiters / profile.tankCapacityLiters) * 100);

  const effectiveFuelLiters = telemetry.fuelLevelPct != null
    ? ((profile.tankCapacityLiters * telemetry.fuelLevelPct) / 100).toFixed(1)
    : tripState.estimatedFuelRemainingLiters.toFixed(1);

  const effectiveRangeKm = Math.round(parseFloat(effectiveFuelLiters) * profile.highwayEfficiencyKmPerL);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Barra de Control de Conexión */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                Telemetría en Vivo & Diagnóstico OBD-II
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  connectionState === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : connectionState === 'connecting' || connectionState === 'initializing'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-emerald-400 animate-ping'
                      : connectionState === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
                {connectionState === 'connected'
                  ? isSimulating
                    ? 'Simulador Activo'
                    : 'OBD-II Conectado'
                  : connectionState === 'connecting'
                  ? 'Buscando...'
                  : connectionState === 'initializing'
                  ? 'Inicializando...'
                  : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Vehículo activo:{' '}
              <strong className="text-white">
                {profile.year} {profile.make} {profile.model}
              </strong>{' '}
              ({profile.nickname || 'Sin apodo'}) • Modo:{' '}
              <button
                onClick={onEditProfile}
                className="text-amber-400 hover:underline font-medium"
              >
                {profile.connectionMode === 'obd_ble' ? 'Escáner Bluetooth' : 'Perfil Manual (GPS)'} [Cambiar]
              </button>
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {connectionState !== 'connected' ? (
              <>
                <button
                  onClick={handleConnectBle}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Bluetooth className="w-4 h-4" />
                  Conectar ELM327 BLE
                </button>
                <button
                  onClick={handleStartSimulation}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Probar con Simulador
                </button>
              </>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
                Desconectar Escáner
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="text-amber-400">ℹ</span>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Relojes y Cuadros Principales del Auto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Velocidad */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Velocidad</span>
            <Gauge className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-5xl font-black tracking-tight text-white">
              {telemetry.speedKmh}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1.5">km/h</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {connectionState === 'connected' ? 'Dato real ECU (PID 010D)' : 'Esperando señal GPS / OBD'}
          </div>
        </div>

        {/* RPM */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tacómetro</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <span className={`text-4xl font-black tracking-tight ${telemetry.rpm > 5500 ? 'text-red-400' : 'text-white'}`}>
              {telemetry.rpm}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1.5">RPM</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                telemetry.rpm > 5500 ? 'bg-red-500' : telemetry.rpm > 3500 ? 'bg-amber-400' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, (telemetry.rpm / 7000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Combustible Restante */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Combustible</span>
            <Fuel className={`w-4 h-4 ${effectiveFuelPct < 20 ? 'text-red-400 animate-bounce' : 'text-emerald-400'}`} />
          </div>
          <div className="my-2">
            <span className="text-4xl font-black tracking-tight text-white">
              {effectiveFuelPct}%
            </span>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">
              {effectiveFuelLiters} L restantes
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                effectiveFuelPct < 20 ? 'bg-red-500' : effectiveFuelPct < 40 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${effectiveFuelPct}%` }}
            />
          </div>
        </div>

        {/* Autonomía Restante Estimada */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Autonomía</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-4xl font-black tracking-tight text-amber-400">
              ~{effectiveRangeKm}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1.5">km</span>
          </div>
          <div className="text-[11px] text-slate-500">
            A {profile.highwayEfficiencyKmPerL} km/L nominal
          </div>
        </div>
      </div>

      {/* Panel Secundario: Diagnóstico de Motor & Temperatura */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Temperatura de Motor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-800 rounded-xl text-blue-400">
            <Thermometer className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Refrigerante de Motor</div>
            <div className="text-xl font-bold text-white">
              {telemetry.coolantTempC != null ? `${telemetry.coolantTempC} °C` : '-- °C'}
            </div>
            <div className="text-[11px] text-slate-500">Normal en carretera: 85 - 95 °C</div>
          </div>
        </div>

        {/* Voltaje de Batería */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-800 rounded-xl text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Alternador / Batería</div>
            <div className="text-xl font-bold text-white">
              {telemetry.batteryVoltage != null ? `${telemetry.batteryVoltage} V` : '13.8 V (Est.)'}
            </div>
            <div className="text-[11px] text-slate-500">Con motor encendido: 13.5 - 14.5 V</div>
          </div>
        </div>

        {/* Diagnóstico DTC (Check Engine) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            telemetry.dtcCodes.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Códigos de Falla (DTC)</div>
            <div className={`text-xl font-bold ${telemetry.dtcCodes.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {telemetry.dtcCodes.length > 0 ? `${telemetry.dtcCodes.length} Fallas` : 'Sin Códigos'}
            </div>
            <div className="text-[11px] text-slate-500">
              {telemetry.dtcCodes.length > 0 ? telemetry.dtcCodes.join(', ') : 'Sistema de motor OK'}
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Alertas Inteligentes (Llantas, Calor de Asfalto y Fatiga) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-amber-400" />
            Alertas Inteligentes de Seguridad & Llantas
          </h3>
          <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium border border-amber-500/20">
            {alerts.length} Sugerencias Activas
          </span>
        </div>

        {/* Parámetros de Carretera en Vivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">Temperatura Ambiente:</span>
            <span className="font-bold text-white">{tripState.ambientTempC}°C</span>
          </div>
          <div>
            <span className="text-slate-400 block">Asfalto Estimado:</span>
            <span className="font-bold text-amber-400">{tripState.estimatedAsphaltTempC}°C (Caliente)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Tiempo al Volante:</span>
            <span className="font-bold text-white">{Math.floor(tripState.continuousDrivingMinutes / 60)}h {tripState.continuousDrivingMinutes % 60}m</span>
          </div>
          <div>
            <span className="text-slate-400 block">Presión Calibrada:</span>
            <span className="font-bold text-white">{profile.recommendedPsiCold} PSI (Frío)</span>
          </div>
        </div>

        {/* Tarjetas de Alerta */}
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                alert.severity === 'critical'
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                  : alert.severity === 'warning'
                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                  : 'bg-blue-950/30 border-blue-800/60 text-blue-200'
              }`}
            >
              <div className="mt-0.5">
                {alert.severity === 'critical' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                ) : alert.severity === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-bold text-sm text-white flex items-center justify-between">
                  <span>{alert.title}</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-black/40">
                    {alert.type}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{alert.message}</p>
                <div className="text-xs font-medium text-amber-300/90 pt-1 border-t border-white/10 mt-1.5">
                  👉 <strong>Acción:</strong> {alert.actionRequired}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
