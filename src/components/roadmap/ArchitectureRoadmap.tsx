import React from 'react';
import { Radio, Fuel, Wrench, Volume2, HardDrive, CheckCircle2 } from '../common/Icons';

export const ArchitectureRoadmap: React.FC = () => {
  const modules = [
    {
      icon: <HardDrive className="w-5 h-5 text-amber-400" />,
      title: '1. Motor Offline-First (Corridor Cache 15 km)',
      status: 'Diseñado • En Proceso',
      desc: 'Al trazar la ruta en línea, descarga los mosaicos vectoriales (MapLibre/PMTiles) con un búfer de 15 km a ambos costados. Si se pierde la señal, el mapa y la navegación GPS continúan fluidos sin pantalla en blanco.',
    },
    {
      icon: <Radio className="w-5 h-5 text-blue-400" />,
      title: '2. Alerta Preventiva de Zonas Sin Señal (10-15 km antes)',
      status: 'Diseñado',
      desc: 'Con base en datos de cobertura celular (OpenCelliD), calcula la distancia a zonas muertas de telefonía: "Estás por entrar a una zona de 40 km sin señal. Haz tus llamadas ahora".',
    },
    {
      icon: <Fuel className="w-5 h-5 text-emerald-400" />,
      title: '3. Gasolineras Inteligentes por Autonomía Real',
      status: 'Integrado con Modelo Matemático',
      desc: 'Compara el combustible restante (OBD o manual) con la distancia entre gasolineras: te alerta si la estación a 8 km es la última antes de un desierto de 90 km.',
    },
    {
      icon: <Wrench className="w-5 h-5 text-purple-400" />,
      title: '4. Capas de Auxilio: Vulcanizadoras 24h & Talleres',
      status: 'Diseñado',
      desc: 'Directorio georreferenciado offline de vulcanizadoras, talleres de suspensión y paraderos seguros para descansar.',
    },
    {
      icon: <Volume2 className="w-5 h-5 text-rose-400" />,
      title: '5. Integración por Voz Manos Libres (Siri & Asistente)',
      status: 'Diseñado',
      desc: 'Soporte Web Speech API y atajos nativos de Siri / Google Assistant para consultar autonomía y pedir auxilio mecánico sin soltar el volante.',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          Plan de Arquitectura y Siguientes Módulos
        </h2>
        <p className="text-sm text-slate-400">
          Esta plataforma está estructurada en capas modulares e independientes, pensada para compilar tanto en Web (PWA instalable) como en Android e iOS con una sola base de código.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {modules.map((m, idx) => (
          <div
            key={idx}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl">{m.icon}</div>
                <h3 className="font-bold text-white text-base">{m.title}</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 font-semibold border border-slate-700">
                {m.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-12">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
