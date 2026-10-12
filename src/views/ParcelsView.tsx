import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Filter,
  PlusCircle,
  Ship,
  Plane,
  Eye,
  Share2,
  Printer,
  DollarSign,
  Download,
  Building2,
  Layers,
  ArrowUpDown,
  Trash2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { Parcel, ParcelStatus, TransportMode, UserRole } from '../types/index.ts';
import { PARCEL_STATUSES } from '../types/index.ts';
import { formatUSD, formatDay, createWhatsAppTrackingLink } from '../services/api.ts';

interface ParcelsViewProps {
  parcels: Parcel[];
  userRole: UserRole;
  onOpenNewParcel: () => void;
  onSelectParcel: (parcel: Parcel) => void;
  onOpenLabel: (parcel: Parcel) => void;
  onOpenPaymentForParcel: (parcel: Parcel) => void;
  onDeleteParcel?: (id: string, withPayments?: boolean) => Promise<void>;
  onRefresh?: () => void;
}

export const ParcelsView: React.FC<ParcelsViewProps> = ({
  parcels,
  userRole,
  onOpenNewParcel,
  onSelectParcel,
  onOpenLabel,
  onOpenPaymentForParcel,
  onDeleteParcel,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [destFilter, setDestFilter] = useState<string>('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'weight_desc' | 'balance_desc'>('date_desc');

  // China agencies actually present on parcels (ids are FK values, not hard-coded).
  const chinaAgencyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of parcels) if (p.chinaAgencyId) byId.set(p.chinaAgencyId, p.chinaAgencyName || p.chinaAgencyId);
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [parcels]);

  // Filter & Search logic
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search.trim() ||
        p.trackingNumber.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientPhone.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        (p.shipmentNumber && p.shipmentNumber.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchMode = modeFilter === 'ALL' || p.transportMode === modeFilter;
      const matchDest = destFilter === 'ALL' || p.destination === destFilter;
      const matchAgency = agencyFilter === 'ALL' || p.chinaAgencyId === agencyFilter;

      return matchSearch && matchStatus && matchMode && matchDest && matchAgency;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return b.createdAt.localeCompare(a.createdAt);
      if (sortBy === 'date_asc') return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === 'weight_desc') return b.weightKg - a.weightKg;
      if (sortBy === 'balance_desc') return b.remainingAmountUSD - a.remainingAmountUSD;
      return 0;
    });
  }, [parcels, search, statusFilter, modeFilter, destFilter, agencyFilter, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'N° Suivi',
      'Client',
      'Téléphone',
      'Description',
      'Quantité',
      'Poids (kg)',
      'Volume (m3)',
      'Mode',
      'Destination',
      'Statut',
      'Coût Total ($)',
      'Payé ($)',
      'Reste ($)',
      'Date Création',
    ];
    const rows = filteredParcels.map((p) => [
      p.trackingNumber,
      `"${p.clientName}"`,
      `"${p.clientPhone}"`,
      `"${p.description}"`,
      p.quantity,
      p.weightKg,
      p.volumeCbm,
      p.transportMode,
      p.destination,
      p.status,
      p.totalCostUSD,
      p.amountPaidUSD,
      p.remainingAmountUSD,
      p.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GZ_MUBUA_Colis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Title & Top Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Gestion & Inventaire des Colis
            </h1>
            <span className="shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {filteredParcels.length} colis
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Enregistrement en Chine, pesée, cubage, contrôle qualité, étiquetage et expédition.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:flex-wrap">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              title="Recharger depuis Supabase"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" /> Exporter CSV
          </button>
          {userRole === 'admin' || userRole === 'china_team' ? (
            <button
              onClick={onOpenNewParcel}
              className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Enregistrer un Colis
            </button>
          ) : null}
        </div>
      </div>

      {/* Filters and search controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search bar */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par N° suivi, client, tél, article, fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">Tous les statuts ({parcels.length})</option>
              {Object.values(PARCEL_STATUSES).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mode filter */}
          <div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">Tous les modes (Mer & Air)</option>
              <option value="MARITIME">Maritime uniquement</option>
              <option value="AERIEN">Aérien uniquement</option>
            </select>
          </div>

          {/* Destination filter */}
          <div>
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">Toutes destinations</option>
              <option value="Kinshasa">Kinshasa (RDC)</option>
              <option value="Angola">Angola (Luanda)</option>
            </select>
          </div>
        </div>

        {/* Secondary filter & sorting bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>Agence Chine :</span>
            <button
              onClick={() => setAgencyFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                agencyFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Toutes
            </button>
            {chinaAgencyOptions.map((agency) => (
              <button
                key={agency.id}
                onClick={() => setAgencyFilter(agency.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  agencyFilter === agency.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {agency.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(search || statusFilter !== 'ALL' || modeFilter !== 'ALL' || destFilter !== 'ALL' || agencyFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setModeFilter('ALL');
                  setDestFilter('ALL');
                  setAgencyFilter('ALL');
                }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                title="Effacer tous les filtres"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser filtres
              </button>
            )}
            <span>Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs p-1 rounded-lg border border-slate-200 bg-white"
            >
              <option value="date_desc">Date récente</option>
              <option value="date_asc">Date ancienne</option>
              <option value="weight_desc">Poids (plus lourd)</option>
              <option value="balance_desc">Solde restant dû</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile: one card per parcel */}
      <div className="md:hidden space-y-3">
        {filteredParcels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-10 text-center text-xs text-slate-400">
            Aucun colis ne correspond à vos critères de recherche.
          </div>
        ) : (
          filteredParcels.map((parcel) => {
            const statusCfg = PARCEL_STATUSES[parcel.status];
            return (
              <div key={parcel.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectParcel(parcel)}
                  className="w-full text-left space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-black text-slate-900 tracking-wider break-all">
                        {parcel.trackingNumber}
                      </div>
                      <div className="text-[10px] text-slate-500">Reçu le {formatDay(parcel.chinaReceptionDate || parcel.createdAt)}</div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        statusCfg?.badgeClass || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {statusCfg?.label || parcel.status}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{parcel.clientName}</div>
                    <div className="text-[11px] text-slate-600">{parcel.clientPhone}</div>
                  </div>
                  <div className="text-slate-700 line-clamp-2">{parcel.description}</div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500">Poids</div>
                      <div className="font-bold text-slate-900">{parcel.weightKg} kg</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Mode</div>
                      <div className="font-bold text-slate-900 flex items-center justify-center gap-1">
                        {parcel.transportMode === 'MARITIME' ? (
                          <Ship className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Plane className="w-3.5 h-3.5 text-sky-600" />
                        )}
                        {parcel.destination}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Total</div>
                      <div className="font-bold text-slate-900">{formatUSD(parcel.totalCostUSD)}</div>
                    </div>
                  </div>
                  <div className="text-[11px]">
                    {parcel.remainingAmountUSD > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        Reste à payer : {formatUSD(parcel.remainingAmountUSD)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold">Soldé ✓</span>
                    )}
                  </div>
                </button>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => onSelectParcel(parcel)}
                    className="flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                  >
                    <Eye className="w-4 h-4" /> Détails
                  </button>
                  <button
                    onClick={() => onOpenLabel(parcel)}
                    className="flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                  >
                    <Printer className="w-4 h-4" /> Étiquette
                  </button>
                  <a
                    href={createWhatsAppTrackingLink(parcel)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold"
                  >
                    <Share2 className="w-4 h-4" /> WhatsApp
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Parcels Table (tablet & desktop) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Suivi</th>
                <th className="py-3 px-4">Client Destinataire</th>
                <th className="py-3 px-4">Marchandise</th>
                <th className="py-3 px-4">Poids & Volume</th>
                <th className="py-3 px-4">Acheminement</th>
                <th className="py-3 px-4">Statut Actuel</th>
                <th className="py-3 px-4">Financier</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParcels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucun colis ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredParcels.map((parcel) => {
                  const statusCfg = PARCEL_STATUSES[parcel.status];
                  const whatsappLink = createWhatsAppTrackingLink(parcel);
                  return (
                    <tr key={parcel.id} className="hover:bg-amber-50/40 transition">
                      {/* Tracking Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900 tracking-wider">
                          {parcel.trackingNumber}
                        </div>
                        <div className="text-[10px] text-slate-700 mt-0.5">
                          Reçu le {formatDay(parcel.chinaReceptionDate || parcel.createdAt)}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{parcel.clientName}</div>
                        <div className="text-[11px] text-slate-700">{parcel.clientPhone}</div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate" title={parcel.description}>
                          {parcel.description}
                        </div>
                        <div className="text-[10px] text-slate-700">
                          {parcel.quantity} colis • Fournisseur : {parcel.supplier}
                        </div>
                      </td>

                      {/* Specs */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{parcel.weightKg} kg</div>
                        <div className="text-[10px] text-slate-700">{parcel.volumeCbm} m³ (CBM)</div>
                      </td>

                      {/* Routing */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {parcel.transportMode === 'MARITIME' ? (
                            <Ship className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Plane className="w-3.5 h-3.5 text-sky-600" />
                          )}
                          <span>{parcel.destination}</span>
                        </div>
                        <div className="text-[10px] text-slate-700">
                          {parcel.shipmentNumber || 'Sans expédition'}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                            statusCfg?.badgeClass || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {statusCfg?.label || parcel.status}
                        </span>
                        {parcel.warehouseLocation && (
                          <div className="text-[10px] text-slate-700 mt-1 font-mono">
                            📍 {parcel.warehouseLocation}
                          </div>
                        )}
                      </td>

                      {/* Financials */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {formatUSD(parcel.totalCostUSD)}
                        </div>
                        <div className="text-[10px]">
                          {parcel.remainingAmountUSD > 0 ? (
                            <span className="text-rose-600 font-semibold">
                              Reste : {formatUSD(parcel.remainingAmountUSD)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">Soldé ✓</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectParcel(parcel)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 transition"
                            title="Voir la timeline et détails complets"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onOpenLabel(parcel)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Imprimer l'étiquette de colis"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            title="Aviser le client par WhatsApp"
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
    </div>
  );
};
