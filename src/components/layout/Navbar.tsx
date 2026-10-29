import React from 'react';
import { Navigation, Car, PhoneCall, Gauge, Layers } from '../common/Icons';

interface Props {
  currentTab: 'map' | 'profile' | 'telemetry' | 'roadmap';
  onSelectTab: (tab: 'map' | 'profile' | 'telemetry' | 'roadmap') => void;
  onEmergencyClick: () => void;
}

export const Navbar: React.FC<Props> = ({ currentTab, onSelectTab, onEmergencyClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-2.5 sm:px-6 py-1.5 sm:py-2.5 w-full transition-all">
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
        {/* Logo / Título Automotriz */}
        <div
          onClick={() => onSelectTab('map')}
          className="flex items-center gap-2 cursor-pointer select-none shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25 font-black shrink-0">
            <Navigation className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-black text-white text-xs sm:text-base tracking-tight">COPILOTO</span>
              <span className="text-[8px] sm:text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/40 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                Carretera
              </span>
            </div>
            <div className="hidden xs:flex text-[9px] sm:text-[11px] text-slate-400 items-center gap-1.5 font-medium leading-none mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              En Vivo • GPS 60 FPS
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación de Escritorio, Tablets y Celular en Horizontal */}
        <nav className="hidden sm:flex md:flex landscape:flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 p-1 rounded-2xl text-[11px] sm:text-xs font-bold shadow-inner">
          <button
            onClick={() => onSelectTab('map')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              currentTab === 'map'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Mapa</span>
          </button>

          <button
            onClick={() => onSelectTab('profile')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              currentTab === 'profile'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Perfil del Auto</span>
            <span className="sm:hidden">Auto</span>
          </button>

          <button
            onClick={() => onSelectTab('telemetry')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              currentTab === 'telemetry'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>OBD-II</span>
          </button>

          <button
            onClick={() => onSelectTab('roadmap')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              currentTab === 'roadmap'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Módulos</span>
          </button>
        </nav>

        {/* Botón SOS de Emergencia */}
        <button
          onClick={onEmergencyClick}
          className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-rose-900/30 border border-rose-400/40 shrink-0"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Bóveda SOS</span>
        </button>
      </div>

      {/* Tabs móviles SOLO en vertical (se oculta automáticamente en orientación horizontal para no tapar la vista del mapa) */}
      <div className="flex md:hidden landscape:hidden items-center justify-around mt-1.5 pt-1.5 border-t border-slate-800/80 text-xs font-bold">
        <button
          onClick={() => onSelectTab('map')}
          className={`flex-1 py-1 text-center flex items-center justify-center gap-1 ${currentTab === 'map' ? 'text-amber-400 border-b-2 border-amber-400 font-extrabold' : 'text-slate-400'}`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Mapa</span>
        </button>
        <button
          onClick={() => onSelectTab('profile')}
          className={`flex-1 py-1 text-center flex items-center justify-center gap-1 ${currentTab === 'profile' ? 'text-amber-400 border-b-2 border-amber-400 font-extrabold' : 'text-slate-400'}`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Auto</span>
        </button>
        <button
          onClick={() => onSelectTab('telemetry')}
          className={`flex-1 py-1 text-center flex items-center justify-center gap-1 ${currentTab === 'telemetry' ? 'text-amber-400 border-b-2 border-amber-400 font-extrabold' : 'text-slate-400'}`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>OBD-II</span>
        </button>
        <button
          onClick={() => onSelectTab('roadmap')}
          className={`flex-1 py-1 text-center flex items-center justify-center gap-1 ${currentTab === 'roadmap' ? 'text-amber-400 border-b-2 border-amber-400 font-extrabold' : 'text-slate-400'}`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Módulos</span>
        </button>
      </div>
    </header>
  );
};

