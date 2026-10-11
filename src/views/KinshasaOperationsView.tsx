import React, { useState } from 'react';
import {
  Truck,
  Package,
  Ship,
  Plane,
  CheckCircle2,
  MapPin,
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Share2,
  Building2,
  DollarSign,
} from 'lucide-react';
import type { Parcel, Shipment, UserRole } from '../types/index.ts';
import { PARCEL_STATUSES } from '../types/index.ts';
import { formatUSD, createWhatsAppTrackingLink } from '../services/api.ts';

interface KinshasaOperationsViewProps {
  parcels: Parcel[];
  shipments: Shipment[];
  userRole: UserRole;
  onSelectParcel: (parcel: Parcel) => void;
  onConfirmArrival: (shipmentId: string) => Promise<void>;
  onMarkParcelReady: (parcelId: string, location: string) => Promise<void>;
  onDispatchDelivery: (parcelId: string, driverName: string, driverPhone: string) => Promise<void>;
  onConfirmDelivered: (parcelId: string, recipient: string) => Promise<void>;
  onOpenPaymentForParcel: (parcel: Parcel) => void;
}

export const KinshasaOperationsView: React.FC<KinshasaOperationsViewProps> = ({
  parcels,
  shipments,
  userRole,
  onSelectParcel,
  onConfirmArrival,
  onMarkParcelReady,
  onDispatchDelivery,
  onConfirmDelivered,
  onOpenPaymentForParcel,
}) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'incoming' | 'storage' | 'delivery' | 'anomalies'>('storage');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Quick dispatch modal state
  const [dispatchParcelId, setDispatchParcelId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('Christian Bakole');
  const [driverPhone, setDriverPhone] = useState('+243 81 777 6655');

  // Quick delivery confirmation state
  const [deliveryModalParcelId, setDeliveryModalParcelId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');

  // Quick warehouse storage state
  const [storageParcelId, setStorageParcelId] = useState<string | null>(null);
  const [storageLocation, setStorageLocation] = useState('Rayon Hangar Limete A-02');

  // Incoming shipments from China (in transit or departed)
  const incomingShipments = shipments.filter(
    (s) => s.status === 'EXPEDIE' || s.status === 'EN_TRANSIT'
  );

  // Destination parcels (arrived, storage, delivery)
  const destParcels = parcels.filter((p) =>
    [
      'ARRIVE_DESTINATION',
      'DEDOUANEMENT_TRAITEMENT',
      'DISPONIBLE_AGENCE',
      'PREPARATION_LIVRAISON',
      'EN_COURS_LIVRAISON',
      'LIVRE',
      'RETIRE_CLIENT',
      'ANOMALIE',
    ].includes(p.status)
  );

  const availableForPickup = destParcels.filter((p) => p.status === 'DISPONIBLE_AGENCE');
  const readyToProcess = destParcels.filter((p) =>
    ['ARRIVE_DESTINATION', 'DEDOUANEMENT_TRAITEMENT'].includes(p.status)
  );
  const inDelivery = destParcels.filter(
    (p) => p.status === 'PREPARATION_LIVRAISON' || p.status === 'EN_COURS_LIVRAISON'
  );
  const delivered = destParcels.filter((p) => p.status === 'LIVRE' || p.status === 'RETIRE_CLIENT');
  const anomalies = destParcels.filter((p) => p.status === 'ANOMALIE');

  const handleArrivalSubmit = async (shipmentId: string) => {
    setActionLoading(shipmentId);
    try {
      await onConfirmArrival(shipmentId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchParcelId) return;
    setActionLoading(dispatchParcelId);
    try {
      await onDispatchDelivery(dispatchParcelId, driverName, driverPhone);
      setDispatchParcelId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliveredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalParcelId) return;
    setActionLoading(deliveryModalParcelId);
    try {
      await onConfirmDelivered(deliveryModalParcelId, recipientName);
      setDeliveryModalParcelId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStorageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storageParcelId) return;
    setActionLoading(storageParcelId);
    try {
      await onMarkParcelReady(storageParcelId, storageLocation);
      setStorageParcelId(null);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/20 text-emerald-300 border border-emerald-400/30">
              HUB DESTINATION • KINSHASA & ANGOLA
            </span>
            <span className="text-xs text-emerald-200">Gombe, Limete & Luanda Viana</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Opérations Kinshasa & Réception</h1>
          <p className="text-xs text-emerald-100 mt-1 max-w-xl">
            Arrivée des conteneurs maritimes et vols cargo, stockage au Hangar Limete, retraits au
            guichet, dispatch des livreurs et clôture des livraisons.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/60 p-3 rounded-xl border border-emerald-700/50">
          <div className="text-center px-3 border-r border-emerald-700/50">
            <span className="text-[10px] text-emerald-300 uppercase block font-semibold">
              Disponibles Guichet
            </span>
            <span className="text-xl font-black text-white">{availableForPickup.length}</span>
          </div>
          <div className="text-center px-3 border-r border-emerald-700/50">
            <span className="text-[10px] text-emerald-300 uppercase block font-semibold">
              En Tournée Livreur
            </span>
            <span className="text-xl font-black text-amber-300">{inDelivery.length}</span>
          </div>
          <div className="text-center px-3">
            <span className="text-[10px] text-emerald-300 uppercase block font-semibold">
              Livrés Total
            </span>
            <span className="text-xl font-black text-white">{delivered.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
        <button
          onClick={() => setSelectedSubTab('incoming')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedSubTab === 'incoming'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Ship className="w-4 h-4" /> Expéditions Entrantes ({incomingShipments.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('storage')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedSubTab === 'storage'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" /> Stockage & Retrait ({availableForPickup.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('delivery')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedSubTab === 'delivery'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" /> Tournées & Livraisons ({inDelivery.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('anomalies')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedSubTab === 'anomalies'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Anomalies & Litiges ({anomalies.length})
        </button>
      </div>

      {/* 1. EXPÉDITIONS ENTRANTES DEPUIS LA CHINE */}
      {selectedSubTab === 'incoming' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Ship className="w-4 h-4 text-blue-600" /> Cargaisons envoyées depuis la Chine
              </h3>
              <p className="text-xs text-slate-500">
                Consultez les informations transmises par Guangzhou/Yiwu et confirmez l’arrivée à destination.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {incomingShipments.length === 0 ? (
              <p className="text-xs text-slate-400 py-10 text-center">
                Aucune expédition en mer ou dans les airs actuellement.
              </p>
            ) : (
              incomingShipments.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {s.shipmentNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.transportMode === 'MARITIME'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {s.transportMode}
                      </span>
                      <span className="text-xs font-bold text-amber-700">➔ {s.destination}</span>
                    </div>
                    <div className="text-xs text-slate-700">
                      Transporteur : <strong>{s.carrierName}</strong> • Réf Conteneur/AWB :{' '}
                      <strong>{s.containerOrFlightNumber}</strong>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>{s.parcelCount} colis</span>
                      <span>• {s.totalWeightKg} kg</span>
                      <span>• {s.totalVolumeCbm} m³</span>
                      <span>• Départ Chine : {s.departureDate}</span>
                      <span>• Arrivée estimée : {s.estimatedArrivalDate || 'En cours'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleArrivalSubmit(s.id)}
                    disabled={actionLoading === s.id}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer self-start md:self-center"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {actionLoading === s.id
                      ? 'Traitement en cours...'
                      : 'Confirmer Arrivée & Dépôtage'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. STOCKAGE & RETRAITS EN AGENCE */}
      {selectedSubTab === 'storage' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" /> Colis Disponibles pour Retrait ou
                Livraison ({availableForPickup.length})
              </h3>
              {readyToProcess.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {readyToProcess.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStorageParcelId(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold"
                    >
                      {p.trackingNumber} : définir emplacement
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500">
              Vérifiez le solde avant de remettre la marchandise
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">N° Suivi</th>
                  <th className="py-3 px-4">Client & Tél</th>
                  <th className="py-3 px-4">Marchandise</th>
                  <th className="py-3 px-4">Emplacement Hangar</th>
                  <th className="py-3 px-4">Solde à Payer</th>
                  <th className="py-3 px-4 text-right">Actions Guichet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availableForPickup.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Aucun colis en attente au guichet actuellement.
                    </td>
                  </tr>
                ) : (
                  availableForPickup.map((p) => {
                    const whatsapp = createWhatsAppTrackingLink(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {p.trackingNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{p.clientName}</div>
                          <div className="text-[10px] text-slate-500">{p.clientPhone}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <div className="font-medium text-slate-800 truncate">{p.description}</div>
                          <div className="text-[10px] text-slate-500">
                            {p.weightKg} kg • {p.volumeCbm} m³
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            {p.warehouseLocation || 'Non assigné'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {p.remainingAmountUSD > 0 ? (
                            <div className="text-rose-600">
                              <span>{formatUSD(p.remainingAmountUSD)}</span>
                              <button
                                onClick={() => onOpenPaymentForParcel(p)}
                                className="block text-[10px] font-semibold text-amber-700 hover:underline"
                              >
                                Encaisser maintenant
                              </button>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold">Payé intégralement ✓</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Retrait direct au guichet */}
                            <button
                              onClick={() => {
                                setDeliveryModalParcelId(p.id);
                                setRecipientName(p.clientName);
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                            >
                              Confirmer Retrait Guichet
                            </button>
                            {/* Assigner Livreur */}
                            <button
                              onClick={() => setDispatchParcelId(p.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition"
                            >
                              Affecter Livreur
                            </button>
                            {/* WhatsApp alert */}
                            <a
                              href={whatsapp}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Alerter le client par WhatsApp"
                            >
                              <Share2 className="w-4 h-4" />
                            </a>
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
      )}

      {/* 3. EN TOURNÉE LIVREUR */}
      {selectedSubTab === 'delivery' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" /> Colis Assignés aux Livreurs ({inDelivery.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">N° Suivi</th>
                  <th className="py-3 px-4">Client & Adresse</th>
                  <th className="py-3 px-4">Livreur Assigné</th>
                  <th className="py-3 px-4">Solde</th>
                  <th className="py-3 px-4 text-right">Validation Finale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inDelivery.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Aucune livraison à domicile en cours actuellement.
                    </td>
                  </tr>
                ) : (
                  inDelivery.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.trackingNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.clientName}</div>
                        <div className="text-[10px] text-slate-500">{p.clientPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {p.deliveryDriverName || 'Non renseigné'}
                        </div>
                        <div className="text-[10px] text-slate-500">{p.deliveryDriverPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        {p.remainingAmountUSD > 0 ? (
                          <span className="text-rose-600 font-bold">
                            À encaisser : {formatUSD(p.remainingAmountUSD)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">Payé intégralement ✓</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setDeliveryModalParcelId(p.id);
                            setRecipientName(p.clientName);
                          }}
                          className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                        >
                          Confirmer Remise Colis
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ANOMALIES */}
      {selectedSubTab === 'anomalies' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" /> Colis avec incident ou anomalie signalée ({anomalies.length})
          </div>
          {anomalies.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Excellente nouvelle : aucune anomalie ni litige en cours !
            </p>
          ) : (
            anomalies.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex justify-between items-center">
                <div>
                  <div className="font-mono font-bold text-rose-900">{p.trackingNumber} - {p.clientName}</div>
                  <p className="text-xs text-slate-600 mt-1">{p.description}</p>
                </div>
                <button
                  onClick={() => onSelectParcel(p)}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-slate-900 text-white"
                >
                  Traiter le Dossier
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Définir emplacement entrepôt */}
      {storageParcelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md">
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" /> Marquer disponible au guichet
            </h4>
            <form onSubmit={handleStorageSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Emplacement entrepôt / rayon
                </label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStorageParcelId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === storageParcelId}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {actionLoading === storageParcelId ? 'Enregistrement...' : 'Enregistrer l’emplacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Affecter un Livreur */}
      {dispatchParcelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md">
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" /> Affecter un Livreur Kinshasa
            </h4>
            <form onSubmit={handleDispatchSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nom du Livreur / Chauffeur
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Téléphone du Livreur
                </label>
                <input
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDispatchParcelId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Valider Départ Tournée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmer Livraison / Retrait */}
      {deliveryModalParcelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md">
            <h4 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirmer la Clôture & Remise du Colis
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Enregistrement du bénéficiaire ayant réceptionné et clôture du dossier colis.
            </p>
            <form onSubmit={handleDeliveredSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nom Complet du Réceptionnaire / Bénéficiaire
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Patrice Ilunga (Titulaire)"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModalParcelId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm"
                >
                  Confirmer et Clôturer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
