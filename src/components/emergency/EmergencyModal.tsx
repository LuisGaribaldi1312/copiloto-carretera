import React, { useState } from 'react';
import { X, Phone, MessageSquare, AlertOctagon, Shield, MapPin, Copy, Check } from '../common/Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Coordenadas simuladas o de GPS
  const simulatedCoords = { lat: 20.6736, lon: -103.3440 }; // Ej. Autopista GDL-CDMX
  const insurancePhone = '8000123456';
  const policyNumber = 'POL-992384-MX';
  const insurerName = 'GNP / Qualitas / AXA';

  const emergencySmsText = `[AUXILIO SOS CARRETERA] Mi vehiculo tiene una falla/percance. Mis coordenadas exactas GPS son: https://maps.google.com/?q=${simulatedCoords.lat},${simulatedCoords.lon} . Poliza: ${policyNumber} (${insurerName}).`;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${simulatedCoords.lat}, ${simulatedCoords.lon}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendSms = () => {
    // Protocolo estándar de enlace SMS que abre la app de mensajes nativa sin requerir internet celular
    window.location.href = `sms:?body=${encodeURIComponent(emergencySmsText)}`;
  };

  const handleCallInsurer = () => {
    window.location.href = `tel:${insurancePhone}`;
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-rose-600/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative text-white space-y-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-rose-400">Bóveda de Emergencia SOS</h2>
            <p className="text-xs text-slate-400">Asistencia vial y comunicación directa sin internet</p>
          </div>
        </div>

        {/* Coordenadas en Vivo */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">Ubicación GPS Satelital Actual</div>
              <div className="text-sm font-mono font-bold text-white">
                {simulatedCoords.lat.toFixed(4)}, {simulatedCoords.lon.toFixed(4)}
              </div>
            </div>
          </div>
          <button
            onClick={handleCopyCoords}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Póliza Guardada */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Shield className="w-4 h-4 text-emerald-400" />
              Aseguradora Registrada:
            </span>
            <strong className="text-white">{insurerName}</strong>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Póliza:</span>
            <span className="font-mono font-bold text-amber-400">{policyNumber}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Cabina Directa:</span>
            <span className="font-bold text-white">{insurancePhone}</span>
          </div>
        </div>

        {/* Botones de Acción de 1-Toque */}
        <div className="space-y-3 pt-1">
          <button
            onClick={handleCallInsurer}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all text-sm"
          >
            <Phone className="w-5 h-5 fill-current" />
            Llamar Directo a Cabina de Seguro (Tel: {insurancePhone})
          </button>

          <button
            onClick={handleSendSms}
            className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-500 font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-rose-600/30 transition-all text-sm"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            Enviar SOS por SMS con Coordenadas (Funciona sin datos móviles)
          </button>
        </div>

        <p className="text-[11px] text-slate-500 text-center leading-tight">
          El SMS satelital/2G se procesa a nivel telefónico y no requiere conexión de datos 4G/5G.
        </p>
      </div>
    </div>
  );
};
