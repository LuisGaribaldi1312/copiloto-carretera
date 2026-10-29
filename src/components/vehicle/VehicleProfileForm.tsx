import React, { useState } from 'react';
import { VehicleProfile, TireType, FuelType } from '../../types/vehicle';
import { VehicleStorageService } from '../../services/storage/vehicleStorage';
import { Car, Fuel, Gauge, Disc, ShieldCheck, Bluetooth, Sliders, CheckCircle2 } from '../common/Icons';

interface Props {
  profile: VehicleProfile;
  onProfileUpdated: (updated: VehicleProfile) => void;
  onGoToTelemetry: () => void;
}

export const VehicleProfileForm: React.FC<Props> = ({ profile, onProfileUpdated, onGoToTelemetry }) => {
  const [form, setForm] = useState<VehicleProfile>({ ...profile });
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (field: keyof VehicleProfile, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    VehicleStorageService.saveProfile(form);
    onProfileUpdated(form);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const maxTheoreticalRange = Math.round(form.tankCapacityLiters * form.highwayEfficiencyKmPerL);
  const currentTheoreticalRange = Math.round(form.currentFuelLiters * form.highwayEfficiencyKmPerL);
  const currentPct = Math.min(100, Math.round((form.currentFuelLiters / form.tankCapacityLiters) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Configuración del Copiloto
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Car className="w-7 h-7 text-amber-400" />
              Perfil del Vehículo y Modo de Conexión
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Selecciona cómo se comunicará la app con tu auto para calcular autonomía real y prevenir percances.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToTelemetry}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Gauge className="w-4 h-4" />
            Ver Monitor en Vivo
          </button>
        </div>

        {/* Selector de Modo: OBD-II Bluetooth vs Manual por Perfil */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={() => handleChange('connectionMode', 'manual_profile')}
            className={`p-4 rounded-xl border text-left transition-all ${
              form.connectionMode === 'manual_profile'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Modo Manual (Perfil + GPS)
              </span>
              {form.connectionMode === 'manual_profile' && (
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sin escáner físico. La app usa el GPS de tu teléfono junto con la capacidad del tanque y el consumo registrado para calcular tu autonomía y paradas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleChange('connectionMode', 'obd_ble')}
            className={`p-4 rounded-xl border text-left transition-all ${
              form.connectionMode === 'obd_ble'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-blue-400" />
                Modo Escáner OBD-II (Bluetooth)
              </span>
              {form.connectionMode === 'obd_ble' && (
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Conexión automática por Bluetooth a un escáner ELM327. Lee en vivo la velocidad de computadora, RPM, combustible exacto y códigos de falla del motor.
            </p>
          </button>
        </div>
      </div>

      {/* Formulario de Datos del Auto */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Car className="w-5 h-5 text-amber-400" />
            1. Datos Generales del Vehículo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Marca</label>
              <input
                type="text"
                required
                value={form.make}
                onChange={(e) => handleChange('make', e.target.value)}
                placeholder="Ej. Toyota, Nissan, Ford"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Modelo</label>
              <input
                type="text"
                required
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Ej. RAV4, Versa, F-150"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Año</label>
              <input
                type="number"
                min="1990"
                max="2030"
                required
                value={form.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value) || 2020)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Apodo o Placas (Opcional)</label>
              <input
                type="text"
                value={form.nickname || ''}
                onChange={(e) => handleChange('nickname', e.target.value)}
                placeholder="Ej. Mi Nave / ABC-123"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Tipo de Combustible</label>
              <select
                value={form.fuelType}
                onChange={(e) => handleChange('fuelType', e.target.value as FuelType)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              >
                <option value="regular">Gasolina Regular (87 oct)</option>
                <option value="premium">Gasolina Premium (91+ oct)</option>
                <option value="diesel">Diésel Automotriz</option>
                <option value="hybrid">Híbrido / Eléctrico con rango extendido</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sección 2: Tanque y Rendimiento */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Fuel className="w-5 h-5 text-amber-400" />
            2. Capacidad de Combustible y Rendimiento
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Capacidad del Tanque (Litros)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="150"
                  required
                  value={form.tankCapacityLiters}
                  onChange={(e) => handleChange('tankCapacityLiters', parseFloat(e.target.value) || 40)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-12 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">L</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Revisa el manual del propietario (comúnmente 40 a 65 L en sedanes/SUVs).</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Rendimiento en Carretera (km/L)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="4"
                  max="35"
                  required
                  value={form.highwayEfficiencyKmPerL}
                  onChange={(e) => handleChange('highwayEfficiencyKmPerL', parseFloat(e.target.value) || 14)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-16 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">km/L</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Promedio sostenido a 90-110 km/h en autopista.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Combustible Actual en Tanque
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max={form.tankCapacityLiters}
                  required
                  value={form.currentFuelLiters}
                  onChange={(e) => handleChange('currentFuelLiters', parseFloat(e.target.value) || 10)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-12 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">L</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Nivel actual antes de arrancar el viaje ({currentPct}%).</p>
            </div>
          </div>

          {/* Medidor visual rápido de nivel de combustible */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-400">Nivel de Tanque Inicial</span>
              <span className="font-bold text-amber-400">{form.currentFuelLiters} de {form.tankCapacityLiters} Litros ({currentPct}%)</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  currentPct < 20 ? 'bg-red-500' : currentPct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${currentPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
              <span>Autonomía con combustible actual: <strong className="text-white">~{currentTheoreticalRange} km</strong></span>
              <span>Autonomía máxima con tanque lleno: <strong className="text-white">~{maxTheoreticalRange} km</strong></span>
            </div>
          </div>
        </div>

        {/* Sección 3: Llantas y Seguridad Térmica */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Disc className="w-5 h-5 text-amber-400" />
            3. Llantas y Parámetros Térmicos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tipo de Neumático Instalado
              </label>
              <select
                value={form.tireType}
                onChange={(e) => handleChange('tireType', e.target.value as TireType)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              >
                <option value="all_season">Toda Temporada (All Season) - Estándar</option>
                <option value="highway_terrain">Highway-Terrain (HT) - Autopista</option>
                <option value="summer">Verano / Alto Desempeño</option>
                <option value="all_terrain">All-Terrain (AT) - Mixta / Camioneta</option>
                <option value="heavy_duty">Carga Pesada / Mud Terrain (MT)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                La fricción y la temperatura del asfalto varían según el compuesto de la llanta.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Presión de Inflado Recomendada en Frío (PSI)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="26"
                  max="60"
                  required
                  value={form.recommendedPsiCold}
                  onChange={(e) => handleChange('recommendedPsiCold', parseInt(e.target.value) || 32)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-14 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">PSI</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Consulta la etiqueta en el marco de la puerta del conductor (usualmente 32-35 PSI).
              </p>
            </div>
          </div>
        </div>

        {/* Botón de Guardado */}
        <div className="flex items-center justify-end gap-4 pt-2">
          {isSaved && (
            <span className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Perfil guardado correctamente!
            </span>
          )}
          <button
            type="submit"
            className="px-7 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/25 transition-all text-sm flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
};
