import React, { useState } from 'react';
import { DeepMindAnalysisResult, DeepMindCopilotService } from '../../services/ai/deepMindCopilotService';
import { Brain, Sparkles, Volume2, X, Search, ShieldCheck, Zap } from '../common/Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysis: DeepMindAnalysisResult | null;
  onRefreshAnalysis?: () => void;
}

export const DeepMindCopilotModal: React.FC<Props> = ({
  isOpen,
  onClose,
  analysis,
  onRefreshAnalysis,
}) => {
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'deepmind'; text: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [apiKey, setApiKey] = useState(DeepMindCopilotService.getApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  if (!isOpen) return null;

  const handleSpeakBriefing = () => {
    if (!analysis) return;
    const textToSpeak = `${analysis.title}. ${analysis.summary} Velocidad sugerida: ${analysis.recommendedSpeedKmh} kilómetros por hora. ${analysis.tireAdvice}`;
    DeepMindCopilotService.speak(textToSpeak);
  };

  const handleSendQuestion = async (customText?: string) => {
    const text = customText || query;
    if (!text.trim()) return;

    setChatLog((prev) => [...prev, { role: 'user', text }]);
    setQuery('');
    setIsAsking(true);

    try {
      const answer = await DeepMindCopilotService.queryAssistant(
        text,
        analysis ? `Ruta en análisis: ${analysis.title}. Puntuación de seguridad: ${analysis.safetyScore}/100.` : undefined
      );
      setChatLog((prev) => [...prev, { role: 'deepmind', text: answer }]);
      // Leer automáticamente la respuesta
      DeepMindCopilotService.speak(answer);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveApiKey = () => {
    DeepMindCopilotService.setApiKey(apiKey);
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowKeyConfig(false);
      if (onRefreshAnalysis) onRefreshAnalysis();
    }, 1200);
  };

  const quickPrompts = [
    '⛽ ¿Dónde me conviene cargar gasolina en este trayecto?',
    '🌡️ ¿A qué temperatura llega el asfalto y cómo afecta mis llantas?',
    '🌙 ¿Qué riesgos hay si conduzco de noche en esta ruta?',
    '⚡ ¿A qué velocidad ahorro más gasolina según el arrastre?',
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl relative text-white space-y-5 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado DeepMind */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-amber-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
              <Brain className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Copiloto Google DeepMind</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {analysis?.isAiLive ? 'Gemini 3.8 Flash' : 'Motor Neuronal Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Razonamiento en tiempo real para optimización vehicular, seguridad y autonomía.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-[11px] font-semibold text-slate-400 hover:text-amber-400 underline pt-1"
          >
            {showKeyConfig ? 'Cerrar Clave' : 'Configurar API Key'}
          </button>
        </div>

        {/* Panel de Configuración de API Key (Opcional) */}
        {showKeyConfig && (
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 animate-fade-in">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Google Gemini API Key (Opcional):</span>
              <span className="text-[10px] text-slate-400 font-normal">Si no tienes, el copiloto usa el motor neuronal local</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all"
              >
                {savedKeySuccess ? '¡Guardada!' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Resumen del Análisis de Ruta Actual */}
        {analysis ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Índice Seguridad</span>
                <span className={`text-2xl font-black ${analysis.safetyScore >= 80 ? 'text-emerald-400' : analysis.safetyScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {analysis.safetyScore}/100
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Velocidad Óptima</span>
                <span className="text-2xl font-black text-amber-400">
                  {analysis.recommendedSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Nivel de Alerta</span>
                <span className={`text-sm font-extrabold uppercase mt-1 block ${analysis.hazardLevel === 'low' ? 'text-emerald-400' : analysis.hazardLevel === 'medium' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {analysis.hazardLevel}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center">
                <button
                  onClick={handleSpeakBriefing}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Escuchar</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Dictamen */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-2">
              <div className="text-sm font-black text-amber-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>{analysis.title}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {analysis.summary}
              </p>
              {analysis.recommendedFuelStop && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4 shrink-0 text-amber-400" />
                  <span><strong>Parada Estratégica:</strong> {analysis.recommendedFuelStop.reason}</span>
                </div>
              )}
              {analysis.nightWarning && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  ⚠️ <strong>Alerta Nocturna:</strong> {analysis.nightWarning}
                </div>
              )}
              <div className="text-[11px] text-slate-400 pt-1">
                🛞 <strong>Llantas:</strong> {analysis.tireAdvice}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
            <span className="text-3xl block">🧭</span>
            <div className="text-sm font-bold text-white">Traza un destino en el mapa para activar el análisis</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              DeepMind evaluará las curvas, el calor del asfalto, paradas de gasolina y riesgo horario en cuanto elijas una ruta.
            </p>
          </div>
        )}

        {/* Sección de Preguntas en Lenguaje Natural */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Pregúntale a DeepMind en Lenguaje Natural:</span>
          </div>

          {/* Chips rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuestion(prompt)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] whitespace-nowrap border border-slate-800 transition-all shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Historial de conversación */}
          {chatLog.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs p-2.5 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200 ml-6 text-right'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 mr-6'
                  }`}
                >
                  <strong className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    {msg.role === 'user' ? 'Tú' : 'DeepMind Copilot'}
                  </strong>
                  {msg.text}
                </div>
              ))}
            </div>
          )}

          {/* Input de consulta */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
            <Search className="w-5 h-5 text-amber-400 ml-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
              placeholder="Ej. ¿Qué velocidad me recomiendas para no forzar el motor?..."
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none px-2 font-medium"
            />
            <button
              onClick={() => handleSendQuestion()}
              disabled={isAsking}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all shrink-0 disabled:opacity-50"
            >
              {isAsking ? 'Pensando...' : 'Consultar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
