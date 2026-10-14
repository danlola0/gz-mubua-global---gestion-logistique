import React, { useState } from 'react';
import {
  Ship,
  Plane,
  PlusCircle,
  Calendar,
  Clock,
  ArrowRight,
  Boxes,
  CheckCircle,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react';
import type { Shipment, Parcel, UserRole } from '../types/index.ts';
import { formatUSD, formatDay } from '../services/api.ts';
import { ConfirmDeleteModal, EditRecordModal, PeriodFilterBar, RowActions, usePeriodFilter } from '../components/RecordTools.tsx';

interface ShipmentsViewProps {
  shipments: Shipment[];
  parcels: Parcel[];
  userRole: UserRole;
  onOpenNewShipment: () => void;
  onDepartShipment: (shipmentId: string) => Promise<void>;
  onArriveShipment: (shipmentId: string) => Promise<void>;
  onSelectParcel: (parcel: Parcel) => void;
  onUpdateShipment?: (id: string, data: Partial<Shipment>) => Promise<void>;
  onDeleteShipment?: (id: string) => Promise<void>;
}

export const ShipmentsView: React.FC<ShipmentsViewProps> = ({
  shipments,
  parcels,
  userRole,
  onOpenNewShipment,
  onDepartShipment,
  onArriveShipment,
  onSelectParcel,
  onUpdateShipment,
  onDeleteShipment,
}) => {
  // Admin and China team edit shipment details (API checks the agency); only the admin deletes.
  const canEdit = !!onUpdateShipment && (userRole === 'admin' || userRole === 'china_team');
  const canDelete = !!onDeleteShipment && userRole === 'admin';
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deletingShipment, setDeletingShipment] = useState<Shipment | null>(null);
  const period = usePeriodFilter();
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(shipments[0] || null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredShipments = shipments.filter((s) => {
    const matchMode = filterMode === 'ALL' || s.transportMode === filterMode;
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
    return matchMode && matchStatus && period.matches(s.departureDate || s.createdAt);
  });

  // Parcels inside the selected shipment
  const linkedParcels = selectedShipment
    ? parcels.filter((p) => p.shipmentId === selectedShipment.id)
    : [];

  const handleDepart = async (id: string) => {
    setActionLoading(id);
    try {
      await onDepartShipment(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleArrive = async (id: string) => {
    setActionLoading(id);
    try {
      await onArriveShipment(id);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Expéditions & Fret International
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {shipments.length} expéditions
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Groupage en conteneurs maritimes (FCL/LCL) et lots aériens réguliers depuis Guangzhou et Yiwu.
          </p>
        </div>

        {userRole === 'admin' || userRole === 'china_team' ? (
          <button
            onClick={onOpenNewShipment}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" /> Créer une Expédition
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs sm:flex-row sm:items-center sm:gap-3">
        <span className="font-bold text-slate-700">Filtres :</span>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="min-w-0 w-full p-2 rounded-lg border border-slate-300 bg-slate-50 sm:w-auto"
        >
          <option value="ALL">Tous les modes (Mer & Air)</option>
          <option value="MARITIME">Maritime uniquement</option>
          <option value="AERIEN">Aérien uniquement</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="min-w-0 w-full p-2 rounded-lg border border-slate-300 bg-slate-50 sm:w-auto"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="EN_PREPARATION">En préparation</option>
          <option value="EXPEDIE">Expédié</option>
          <option value="EN_TRANSIT">En transit</option>
          <option value="ARRIVE">Arrivé à destination</option>
        </select>
      </div>

      {/* Grid: Left Shipments list, Right Manifest detail */}
      <PeriodFilterBar
        value={period.state}
        onChange={period.setState}
        summary={<>{filteredShipments.length} expédition(s) • {filteredShipments.reduce((n, sh) => n + (Number(sh.parcelCount) || 0), 0)} colis</>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Shipments List */}
        <div className="space-y-3">
          {filteredShipments.map((s) => {
            const isSelected = selectedShipment?.id === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
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
                </div>

                <div className="text-xs font-bold text-slate-800 mt-1">
                  {s.carrierName} ({s.containerOrFlightNumber})
                </div>

                <div className="text-xs text-amber-700 font-semibold mt-1">
                  {s.departureAgencyName} ➔ {s.destination}
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-700">
                  <span>
                    {s.parcelCount} colis • {s.totalWeightKg} kg • {s.totalVolumeCbm} m³
                  </span>
                  <span className="font-bold text-slate-900">{s.status}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Shipment Manifest */}
        <div className="lg:col-span-2">
          {selectedShipment ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              {/* Shipment Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xl text-slate-900">
                      {selectedShipment.shipmentNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        selectedShipment.transportMode === 'MARITIME'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {selectedShipment.transportMode}
                    </span>
                    <span className="text-xs font-bold bg-slate-100 px-2.5 py-0.5 rounded text-slate-700">
                      Statut : {selectedShipment.status}
                    </span>
                    <RowActions
                      onEdit={canEdit ? () => setEditingShipment(selectedShipment) : undefined}
                      onDelete={canDelete ? () => setDeletingShipment(selectedShipment) : undefined}
                    />
                  </div>
                  <p className="text-xs text-slate-700 mt-1">
                    Transporteur : <strong>{selectedShipment.carrierName}</strong> | Conteneur/Vol :{' '}
                    <strong>{selectedShipment.containerOrFlightNumber}</strong>
                  </p>
                  <p className="text-xs text-amber-700 font-semibold mt-0.5">
                    Itinéraire : {selectedShipment.departureAgencyName} ➔{' '}
                    {selectedShipment.destination}
                  </p>
                </div>

                {/* Status action buttons */}
                {userRole !== 'client' && (
                  <div className="flex items-center gap-2">
                    {selectedShipment.status === 'EN_PREPARATION' && (userRole === 'admin' || userRole === 'china_team') && (
                      <button
                        onClick={() => handleDepart(selectedShipment.id)}
                        disabled={actionLoading === selectedShipment.id}
                        className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                      >
                        {actionLoading === selectedShipment.id ? '...' : 'Valider Départ Navire / Avion'}
                      </button>
                    )}
                    {['EXPEDIE', 'EN_TRANSIT'].includes(selectedShipment.status) && (userRole === 'admin' || userRole === 'kinshasa_team') && (
                      <button
                        onClick={() => handleArrive(selectedShipment.id)}
                        disabled={actionLoading === selectedShipment.id}
                        className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {actionLoading === selectedShipment.id ? '...' : 'Confirmer Arrivée Kinshasa / Luanda'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stats ribbons */}
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-700 block uppercase">Colis Associés</span>
                  <span className="text-lg font-black text-slate-900">
                    {selectedShipment.parcelCount}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-700 block uppercase">Poids Total</span>
                  <span className="text-lg font-black text-slate-900">
                    {selectedShipment.totalWeightKg} kg
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-700 block uppercase">Volume CBM</span>
                  <span className="text-lg font-black text-slate-900">
                    {selectedShipment.totalVolumeCbm} m³
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-700 block uppercase">Coût Fret Estimé</span>
                  <span className="text-lg font-black text-amber-700">
                    {formatUSD(selectedShipment.totalCostUSD)}
                  </span>
                </div>
              </div>

              {/* Manifest table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Manifeste de Chargement (Liste des Colis inclus)
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">N° Suivi</th>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3">Marchandise</th>
                        <th className="py-2.5 px-3">Poids</th>
                        <th className="py-2.5 px-3">Volume</th>
                        <th className="py-2.5 px-3">Statut Colis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {linkedParcels.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Aucun colis n'est actuellement rattaché à cette expédition.
                          </td>
                        </tr>
                      ) : (
                        linkedParcels.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => onSelectParcel(p)}
                            className="hover:bg-amber-50/50 cursor-pointer transition"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {p.trackingNumber}
                            </td>
                            <td className="py-2.5 px-3 font-medium">{p.clientName}</td>
                            <td className="py-2.5 px-3 max-w-[160px] truncate">{p.description}</td>
                            <td className="py-2.5 px-3 font-bold">{p.weightKg} kg</td>
                            <td className="py-2.5 px-3 font-bold">{p.volumeCbm} m³</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold text-slate-700">
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Sélectionnez une expédition pour afficher son manifeste.
            </div>
          )}
        </div>
      </div>
      {editingShipment && onUpdateShipment && (
        <EditRecordModal
          title={`Modifier l’expédition ${editingShipment.shipmentNumber}`}
          initialValues={editingShipment}
          fields={[
            { name: 'carrierName', label: 'Transporteur' },
            { name: 'containerOrFlightNumber', label: 'N° conteneur / vol' },
            { name: 'departureDate', label: 'Date de départ', type: 'date' },
            { name: 'estimatedArrivalDate', label: 'Arrivée estimée', type: 'date' },
            { name: 'comments', label: 'Commentaires', type: 'textarea' },
          ]}
          onSubmit={(v) =>
            onUpdateShipment(editingShipment.id, {
              carrierName: v.carrierName,
              containerOrFlightNumber: v.containerOrFlightNumber,
              departureDate: v.departureDate || undefined,
              estimatedArrivalDate: v.estimatedArrivalDate || undefined,
              comments: v.comments,
            })
          }
          onClose={() => setEditingShipment(null)}
        />
      )}
      {deletingShipment && onDeleteShipment && (
        <ConfirmDeleteModal
          title={`Supprimer l’expédition ${deletingShipment.shipmentNumber} ?`}
          message="Les colis rattachés ne sont pas supprimés : ils sont simplement détachés de cette expédition. La suppression est tracée dans le journal d’audit."
          onConfirm={async () => {
            await onDeleteShipment(deletingShipment.id);
            setSelectedShipment(null);
          }}
          onClose={() => setDeletingShipment(null)}
        />
      )}
    </div>
  );
};
