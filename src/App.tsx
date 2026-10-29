import React, { useState } from 'react';
import { VehicleProfile } from './types/vehicle';
import { VehicleStorageService } from './services/storage/vehicleStorage';
import { Navbar } from './components/layout/Navbar';
import { HighwayNavigationMap } from './components/map/HighwayNavigationMap';
import { VehicleProfileForm } from './components/vehicle/VehicleProfileForm';
import { ObdLiveMonitor } from './components/obd/ObdLiveMonitor';
import { ArchitectureRoadmap } from './components/roadmap/ArchitectureRoadmap';
import { EmergencyModal } from './components/emergency/EmergencyModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'map' | 'profile' | 'telemetry' | 'roadmap'>('map');
  const [profile, setProfile] = useState<VehicleProfile>(VehicleStorageService.loadProfile());
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);

  const handleProfileUpdated = (updated: VehicleProfile) => {
    setProfile(updated);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Barra de Navegación Superior Flotante */}
      <header className="shrink-0 z-50 w-full bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-xl">
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onEmergencyClick={() => setIsEmergencyOpen(true)}
        />
      </header>

      {/* Área Principal de Contenido Edge-to-Edge */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        <ErrorBoundary>
          {currentTab === 'map' && (
            <HighwayNavigationMap
              profile={profile}
              onOpenSos={() => setIsEmergencyOpen(true)}
            />
          )}

          {currentTab === 'profile' && (
            <div className="w-full h-full overflow-y-auto p-3 sm:p-6 max-w-4xl mx-auto">
              <button
                onClick={() => setCurrentTab('map')}
                className="mb-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl border border-slate-700 text-xs flex items-center gap-2 transition-all shadow-lg"
              >
                ← Volver al Mapa en Pantalla Completa
              </button>
              <VehicleProfileForm
                profile={profile}
                onProfileUpdated={handleProfileUpdated}
                onGoToTelemetry={() => setCurrentTab('telemetry')}
              />
            </div>
          )}

          {currentTab === 'telemetry' && (
            <div className="w-full h-full overflow-y-auto p-3 sm:p-6 max-w-4xl mx-auto">
              <button
                onClick={() => setCurrentTab('map')}
                className="mb-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl border border-slate-700 text-xs flex items-center gap-2 transition-all shadow-lg"
              >
                ← Volver al Mapa en Pantalla Completa
              </button>
              <ObdLiveMonitor
                profile={profile}
                onEditProfile={() => setCurrentTab('profile')}
              />
            </div>
          )}

          {currentTab === 'roadmap' && (
            <div className="w-full h-full overflow-y-auto p-3 sm:p-6 max-w-5xl mx-auto">
              <button
                onClick={() => setCurrentTab('map')}
                className="mb-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl border border-slate-700 text-xs flex items-center gap-2 transition-all shadow-lg"
              >
                ← Volver al Mapa en Pantalla Completa
              </button>
              <ArchitectureRoadmap />
            </div>
          )}
        </ErrorBoundary>
      </main>

      {/* Modal Bóveda SOS */}
      <EmergencyModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
      />
    </div>
  );
};

export default App;
