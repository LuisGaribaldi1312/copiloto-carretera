import React, { useState } from 'react';
import { HighwaySecurityAdvisor, SecurityAdviceResponse } from '../../services/security/highwaySecurityAdvisor';
import { ShieldCheck, AlertTriangle, Clock, X, Search, CheckCircle2 } from '../common/Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const HighwaySecurityModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [question, setQuestion] = useState('');
  const [currentAdvice, setCurrentAdvice] = useState<SecurityAdviceResponse>(
    HighwaySecurityAdvisor.askQuestion('horarios peligrosos')
  );

  if (!isOpen) return null;

  const handleAsk = (queryText: string) => {
    if (!queryText.trim()) return;
    const res = HighwaySecurityAdvisor.askQuestion(queryText);
    setCurrentAdvice(res);
    setQuestion('');
  };

  const presetQueries = [
    { label: '⏰ Horarios de Riesgo', query: 'Cuáles son los horarios peligrosos para circular?' },
    { label: '⚠️ Tramos Peligrosos', query: 'Cuáles son los tramos de carretera más peligrosos?' },
    { label: '🔧 Falla Mecánica Nocturna', query: 'Qué hacer en caso de falla mecánica en carretera?' },
    { label: '⛽ Estrategia de Combustible', query: 'Consejos para cargar gasolina en carretera?' },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl relative text-white space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Copiloto de Seguridad en Carretera</h2>
            <p className="text-xs text-slate-400">
              Consulta en tiempo real sobre horarios seguros, tramos de alto riesgo y prevención.
            </p>
          </div>
        </div>

        {/* Buscador de Consultas */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
            <Search className="w-5 h-5 text-amber-400 ml-2 shrink-0" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk(question)}
              placeholder="Pregunta sobre horarios, tramos peligrosos, retenes..."
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none px-2"
            />
            <button
              onClick={() => handleAsk(question)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shrink-0"
            >
              Consultar
            </button>
          </div>

          {/* Botones de Preguntas Rápidas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {presetQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(item.query)}
                className="px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap transition-all"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tarjeta de Respuesta del Asesor */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              {currentAdvice.title}
            </h3>
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                currentAdvice.warningLevel === 'high'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {currentAdvice.warningLevel === 'high' ? 'Atención Crítica' : 'Preventivo'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {currentAdvice.summary}
          </p>

          {/* Franja de Horarios si aplica */}
          {currentAdvice.safeHours && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Horario Seguro</span>
                  <strong className="text-emerald-400 font-bold">{currentAdvice.safeHours}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Horario Peligroso</span>
                  <strong className="text-rose-400 font-bold">{currentAdvice.dangerHours}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Recomendaciones específicas */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recomendaciones del Copiloto:
            </h4>
            <div className="space-y-2">
              {currentAdvice.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-500">
            Consejo activo: Ante sospecha o acoso vial, no te detengas; dirígete a la caseta de cobro más próxima o llama de inmediato al 074 / 911.
          </p>
        </div>
      </div>
    </div>
  );
};
