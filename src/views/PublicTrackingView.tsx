import React, { useState } from 'react';
import {
  Search,
  Package,
  Ship,
  Plane,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Calendar,
  AlertCircle,
  Truck,
  Building2,
  X,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { PARCEL_STATUSES } from '../types/index.ts';

interface PublicTrackingViewProps {
  onClose?: () => void;
  initialTracking?: string;
}

export const PublicTrackingView: React.FC<PublicTrackingViewProps> = ({
  onClose,
  initialTracking = '',
}) => {
  const [trackingInput, setTrackingInput] = useState(initialTracking);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackingInput.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.trackParcel(trackingInput.trim());
      setTrackingResult(data);
    } catch (err: any) {
      setTrackingResult(null);
      setErrorMessage(err.message || 'Colis introuvable avec ce numéro');
    } finally {
      setIsLoading(false);
    }
  };

  // 9 visual milestone steps for public client timeline
  const milestones = [
    { key: 'COMMANDE_CREEE', label: 'Commande Créée' },
    { key: 'RECU_CHINE', label: 'Réception Entrepôt Chine' },
    { key: 'CONTROLE', label: 'Contrôle & Pesée' },
    { key: 'EXPEDITION_EN_PREPARATION', label: 'Préparation Fret' },
    { key: 'EXPEDIE', label: 'Départ Chine' },
    { key: 'EN_TRANSIT', label: 'En Transit (Mer / Air)' },
    { key: 'ARRIVE_DESTINATION', label: 'Arrivé à Destination' },
    { key: 'DISPONIBLE_AGENCE', label: 'Disponible à l’Agence' },
    { key: 'LIVRE', label: 'Livré / Remis au Client' },
  ];

  const getMilestoneIndex = (status: string) => {
    const map: Record<string, number> = {
      COMMANDE_CREEE: 0,
      ATTENTE_RECEPTION_CHINE: 0,
      RECU_CHINE: 1,
      IDENTIFIE: 1,
      CONTROLE: 2,
      PREPARE_EXPEDITION: 3,
      EXPEDITION_EN_PREPARATION: 3,
      EXPEDIE: 4,
      EN_TRANSIT: 5,
      ARRIVE_DESTINATION: 6,
      DEDOUANEMENT_TRAITEMENT: 6,
      DISPONIBLE_AGENCE: 7,
      PREPARATION_LIVRAISON: 7,
      EN_COURS_LIVRAISON: 7,
      LIVRE: 8,
      RETIRE_CLIENT: 8,
    };
    return map[status] ?? 0;
  };

  const currentStep = trackingResult ? getMilestoneIndex(trackingResult.status) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden text-center">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
          <Package className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Suivi des Marchandises en Temps Réel
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-lg mx-auto">
          Portail officiel de tracking <strong>GZ MUBUA GLOBAL</strong> : suivez le parcours de vos colis
          depuis la Chine jusqu'à Kinshasa ou Luanda.
        </p>

        {/* Search input form */}
        <form onSubmit={handleSearch} className="mt-6 max-w-md mx-auto flex gap-2">
          <input
            type="text"
            required
            placeholder="Numéro de suivi du colis..."
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            className="flex-1 px-4 py-3 text-sm rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-wider"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            {isLoading ? 'Recherche...' : 'Suivre'}
          </button>
        </form>

        <div className="mt-3 text-[11px] text-slate-400 text-center">
          Saisissez le numéro de suivi réel communiqué lors de l’enregistrement du colis.
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center gap-3 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tracking Result Display */}
      {trackingResult && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden space-y-6 p-6 sm:p-8">
          {/* Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                NUMÉRO DE SUIVI
              </span>
              <div className="font-mono font-black text-2xl text-slate-950 mt-0.5">
                {trackingResult.trackingNumber}
              </div>
              <div className="text-xs text-slate-600 mt-1">Suivi public : seuls le statut et la destination sont affichés.</div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                STATUT ACTUEL
              </span>
              <div className="mt-1">
                <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {PARCEL_STATUSES[trackingResult.status as keyof typeof PARCEL_STATUSES]?.label ||
                    trackingResult.status}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center sm:justify-end gap-1">
                {trackingResult.transportMode === 'MARITIME' ? (
                  <Ship className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Plane className="w-3.5 h-3.5 text-sky-600" />
                )}
                {trackingResult.transportMode} ➔ {trackingResult.destination}
              </div>
            </div>
          </div>

          {/* 9-Stage Visual Timeline Stepper */}
          <div className="py-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Progression Globale du Colis
            </h3>

            {/* Desktop Stepper */}
            <div className="hidden md:grid grid-cols-9 gap-1 text-center relative">
              {milestones.map((step, idx) => {
                const isCompleted = idx <= currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step.key} className="flex flex-col items-center relative group">
                    {/* Connecting line */}
                    {idx < milestones.length - 1 && (
                      <div
                        className={`absolute top-4 left-1/2 w-full h-1 -z-0 ${
                          idx < currentStep ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                      />
                    )}

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-100 shadow-md font-black'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>

                    <span
                      className={`text-[10px] mt-2 font-medium leading-tight ${
                        isCurrent ? 'font-black text-amber-600' : 'text-slate-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper */}
            <div className="md:hidden space-y-3 pl-4 border-l-2 border-slate-200">
              {milestones.map((step, idx) => {
                const isCompleted = idx <= currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-200'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs ${
                        isCurrent ? 'font-bold text-amber-600' : 'text-slate-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Publicly safe details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Agence Retrait</span>
              <strong className="text-amber-700">
                {trackingResult.destinationAgencyName || trackingResult.destination}
              </strong>
            </div>
          </div>

          {/* Timeline of events */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Historique des Jalons Enregistrés
            </h4>
            <div className="space-y-3">
              {trackingResult.statusHistory.map((item: any, i: number) => {
                const cfg = PARCEL_STATUSES[item.status as keyof typeof PARCEL_STATUSES];
                return (
                  <div
                    key={item.id || i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{cfg?.label || item.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 whitespace-nowrap">
                      {item.date} à {item.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
