import React, { useState } from 'react';
import {
  Building2,
  Package,
  Ship,
  Plane,
  PlusCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Boxes,
  Scale,
  QrCode,
  Send,
  Eye,
  Filter,
} from 'lucide-react';
import type { Parcel, Shipment, UserRole } from '../types/index.ts';
import { PARCEL_STATUSES } from '../types/index.ts';
import { formatUSD } from '../services/api.ts';

interface ChinaOperationsViewProps {
  parcels: Parcel[];
  shipments: Shipment[];
  userRole: UserRole;
  onOpenNewParcel: () => void;
  onOpenNewShipment: () => void;
  onSelectParcel: (parcel: Parcel) => void;
  onSelectShipment: (shipment: Shipment) => void;
  onQuickReceive: (parcelId: string) => Promise<void>;
  onTransmitToKinshasa: (shipmentId: string) => Promise<void>;
}

export const ChinaOperationsView: React.FC<ChinaOperationsViewProps> = ({
  parcels,
  shipments,
  userRole,
  onOpenNewParcel,
  onOpenNewShipment,
  onSelectParcel,
  onSelectShipment,
  onQuickReceive,
  onTransmitToKinshasa,
}) => {
  const [selectedHub, setSelectedHub] = useState<'ALL' | 'AG-GZ' | 'AG-YIWU'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter parcels currently in China
  const chinaParcels = parcels.filter((p) =>
    [
      'COMMANDE_CREEE',
      'ATTENTE_RECEPTION_CHINE',
      'RECU_CHINE',
      'IDENTIFIE',
      'CONTROLE',
      'PREPARE_EXPEDITION',
      'EXPEDITION_EN_PREPARATION',
    ].includes(p.status) && (selectedHub === 'ALL' || p.chinaAgencyId === selectedHub)
  );

  // Shipments currently in preparation in China
  const preparingShipments = shipments.filter(
    (s) => s.status === 'EN_PREPARATION' || s.status === 'EXPEDIE'
  );

  const pendingReceptionCount = parcels.filter(
    (p) => p.status === 'COMMANDE_CREEE' || p.status === 'ATTENTE_RECEPTION_CHINE'
  ).length;

  const handleReceiveClick = async (parcelId: string) => {
    setActionLoading(parcelId);
    try {
      await onQuickReceive(parcelId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransmitClick = async (shipmentId: string) => {
    setActionLoading(shipmentId);
    try {
      await onTransmitToKinshasa(shipmentId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/20 text-white border border-white/20">
              HUB ASIE • GUANGZHOU & YIWU
            </span>
            <span className="text-xs text-amber-100">广州 / 义乌 国际货运中心</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Opérations Chine</h1>
          <p className="text-xs text-amber-100 mt-1 max-w-xl">
            Gestion des réceptions fournisseurs, vérification de poids et cubage, groupage en conteneurs
            maritimes ou vols cargo, et transmission en temps réel à Kinshasa et Luanda.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenNewParcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-amber-400 transition shadow-lg cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" /> Enregistrer Réception
          </button>
          <button
            onClick={onOpenNewShipment}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-amber-50 text-slate-950 transition shadow-lg cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-amber-600" /> Préparer Expédition
          </button>
        </div>
      </div>

      {/* Hub selector & Quick China stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-700 font-semibold uppercase block">
            Colis en Entrepôt Chine
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{chinaParcels.length}</div>
          <span className="text-[11px] text-amber-700 font-medium">À charger en conteneurs/vols</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-700 font-semibold uppercase block">
            En Attente de Réception
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">{pendingReceptionCount}</div>
          <span className="text-[11px] text-slate-700">Fournisseurs en transit</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-700 font-semibold uppercase block">
            Poids Total Stocké
          </span>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {chinaParcels.reduce((s, p) => s + p.weightKg, 0)} kg
          </div>
          <span className="text-[11px] text-slate-700">En cours de consolidation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-700 font-semibold uppercase block">
            Volume Total Cubé
          </span>
          <div className="text-2xl font-black text-teal-700 mt-1">
            {chinaParcels.reduce((s, p) => s + p.volumeCbm, 0).toFixed(2)} m³
          </div>
          <span className="text-[11px] text-slate-700">Espace conteneur requis</span>
        </div>
      </div>

      {/* Filter by Hub */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <span className="font-bold text-slate-700">Filtrer par Hub Chine :</span>
        <button
          onClick={() => setSelectedHub('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition ${
            selectedHub === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          Tous les Hubs
        </button>
        <button
          onClick={() => setSelectedHub('AG-GZ')}
          className={`px-3 py-1 rounded-lg font-bold transition ${
            selectedHub === 'AG-GZ'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          Guangzhou (HQ Chine)
        </button>
        <button
          onClick={() => setSelectedHub('AG-YIWU')}
          className={`px-3 py-1 rounded-lg font-bold transition ${
            selectedHub === 'AG-YIWU'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          Yiwu Trade City
        </button>
      </div>

      {/* 1. SECTION: EXPÉDITIONS EN PRÉPARATION & TRANSMISSION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-600" /> Expéditions & Groupage en Cours de Préparation
            </h2>
            <p className="text-xs text-slate-500">
              Conteneurs maritimes et lots aériens prêts pour départ vers Kinshasa ou Luanda.
            </p>
          </div>
          <button
            onClick={onOpenNewShipment}
            className="text-xs font-bold text-amber-600 hover:underline"
          >
            + Nouvelle expédition
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {preparingShipments.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center col-span-3">
              Aucune expédition en préparation actuellement.
            </p>
          ) : (
            preparingShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {shipment.shipmentNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        shipment.transportMode === 'MARITIME'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {shipment.transportMode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1">
                    {shipment.carrierName} ({shipment.containerOrFlightNumber})
                  </div>
                  <div className="text-xs font-bold text-amber-700 mt-1">
                    {shipment.departureAgencyName} ➔ {shipment.destination}
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-lg border border-slate-200 mt-2 text-center text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 block">COLIS</span>
                      <strong className="text-slate-900">{shipment.parcelCount}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">POIDS</span>
                      <strong className="text-slate-900">{shipment.totalWeightKg} kg</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">VOLUME</span>
                      <strong className="text-slate-900">{shipment.totalVolumeCbm} m³</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    Statut : {shipment.status}
                  </span>
                  {shipment.status === 'EN_PREPARATION' ? (
                    <button
                      onClick={() => handleTransmitClick(shipment.id)}
                      disabled={actionLoading === shipment.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition shadow-sm disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {actionLoading === shipment.id ? 'Transmission...' : 'Valider Départ Chine'}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Transmis à Kinshasa
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. SECTION: TABLEAU DES COLIS EN CHINE AVEC ACTION DE RÉCEPTION RAPIDE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" /> File des Colis Présents en Chine ({chinaParcels.length})
          </h3>
          <span className="text-xs text-slate-500">
            Confirmez la réception physique ou inspectez le contenu
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Suivi Unique</th>
                <th className="py-3 px-4">Client & Tél</th>
                <th className="py-3 px-4">Marchandise & Fournisseur</th>
                <th className="py-3 px-4">Mesures & Poids</th>
                <th className="py-3 px-4">Statut Chine</th>
                <th className="py-3 px-4">Expédition Liée</th>
                <th className="py-3 px-4 text-right">Actions Opérateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chinaParcels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Tous les colis en Chine ont déjà été expédiés !
                  </td>
                </tr>
              ) : (
                chinaParcels.map((p) => {
                  const cfg = PARCEL_STATUSES[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {p.trackingNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.clientName}</div>
                        <div className="text-[10px] text-slate-500">{p.clientPhone}</div>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate">{p.description}</div>
                        <div className="text-[10px] text-slate-500">Fourn : {p.supplier}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{p.weightKg} kg</div>
                        <div className="text-[10px] text-slate-500">{p.volumeCbm} m³</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${cfg?.badgeClass}`}
                        >
                          {cfg?.label || p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.shipmentNumber ? (
                          <span className="font-mono font-bold text-blue-700">
                            {p.shipmentNumber}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">En attente de lot</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {['COMMANDE_CREEE', 'ATTENTE_RECEPTION_CHINE'].includes(p.status) && (
                            <button
                              onClick={() => handleReceiveClick(p.id)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                            >
                              {actionLoading === p.id ? '...' : 'Confirmer Réception'}
                            </button>
                          )}
                          <button
                            onClick={() => onSelectParcel(p)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-amber-100 text-slate-700 transition"
                          >
                            Inspecter / Suivi
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
