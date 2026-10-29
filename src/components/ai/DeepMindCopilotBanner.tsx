import React from 'react';
import { DeepMindAnalysisResult, DeepMindCopilotService } from '../../services/ai/deepMindCopilotService';
import { Brain, Volume2, Sparkles, ChevronRight } from '../common/Icons';

interface Props {
  analysis: DeepMindAnalysisResult | null;
  onOpenDetails: () => void;
}

export const DeepMindCopilotBanner: React.FC<Props> = ({ analysis, onOpenDetails }) => {
  if (!analysis) return null;

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToSpeak = `${analysis.title}. ${analysis.summary}. Velocidad recomendada: ${analysis.recommendedSpeedKmh} kilómetros por hora.`;
    DeepMindCopilotService.speak(textToSpeak);
  };

  return (
    <div
      onClick={onOpenDetails}
      className="bg-slate-900/95 border border-indigo-500/40 hover:border-indigo-400 rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto cursor-pointer transition-all hover:bg-slate-900 group max-w-xl animate-fade-in"
    >
      <div className="flex items-center gap-2.5 truncate">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
          <Brain className="w-5 h-5" />
        </div>
        <div className="truncate space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              DeepMind Copilot
            </span>
            <span className="text-slate-600">•</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${analysis.safetyScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              Seguridad {analysis.safetyScore}/100
            </span>
          </div>
          <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
            {analysis.title} — {analysis.recommendedSpeedKmh} km/h sugeridos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSpeak}
          title="Escuchar consejo por voz"
          className="p-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-xl border border-indigo-700/50 transition-all"
        >
          <Volume2 className="w-4 h-4" />
        </button>
        <div className="hidden sm:flex items-center text-xs text-slate-400 group-hover:text-white font-semibold">
          <span>Detalles</span>
          <ChevronRight className="w-4 h-4 ml-0.5 text-amber-400" />
        </div>
      </div>
    </div>
  );
};
