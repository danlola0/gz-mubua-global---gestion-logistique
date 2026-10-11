import React from 'react';
import {
  Package,
  Ship,
  Plane,
  Truck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  ArrowUpRight,
  Clock,
  MapPin,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import type { DashboardStats, Parcel, Shipment, UserRole } from '../types/index.ts';
import { formatUSD, formatCurrency } from '../services/api.ts';
import { PARCEL_STATUSES } from '../types/index.ts';

interface DashboardViewProps {
  stats: DashboardStats | null;
  parcels: Parcel[];
  shipments: Shipment[];
  userRole: UserRole;
  loadError?: string | null;
  onOpenNewParcel: () => void;
  onOpenNewShipment: () => void;
  onOpenNewPayment: () => void;
  onSelectParcel: (parcel: Parcel) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  parcels,
  shipments,
  userRole,
  onOpenNewParcel,
  onOpenNewShipment,
  onOpenNewPayment,
  onSelectParcel,
  onNavigateTab,
  loadError,
}) => {
  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-700">
        {loadError}
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const recentParcels = parcels.slice(0, 6);
  const activeShipments = shipments.filter((s) => ['EN_PREPARATION', 'EXPEDIE', 'EN_TRANSIT'].includes(s.status));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Welcome & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full opacity-10 pointer-events-none flex items-center justify-end pr-8">
          <Ship className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                GZ MUBUA GLOBAL • SYSTÈME CENTRAL
              </span>
              <span className="text-xs text-slate-400">Réseau Chine - RDC - Angola</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Tableau de Bord Opérationnel & Financier
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Suivi en temps réel des réceptions à Guangzhou/Yiwu, du transit maritime et aérien,
              des arrivées à Kinshasa et Luanda, et de la trésorerie multi-devises.
            </p>
          </div>

          {/* Quick Actions (only for staff) */}
          {userRole !== 'client' && (
            <div className="flex flex-wrap items-center gap-2">
              {(userRole === 'admin' || userRole === 'china_team') && (
                <button
                  onClick={onOpenNewParcel}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nouveau Colis
                </button>
              )}
              {(userRole === 'admin' || userRole === 'china_team') && (
                <button
                  onClick={onOpenNewShipment}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition border border-slate-600 cursor-pointer"
                >
                  <Ship className="w-4 h-4 text-amber-400" />
                  Nouvelle Expédition
                </button>
              )}
              {(userRole === 'admin' || userRole === 'cashier') && (
                <button
                  onClick={onOpenNewPayment}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  Encaisser Paiement
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 1. ACTIVITÉ LOGISTIQUE (Statistiques des Colis) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" /> Flux Logistique des Colis
          </h2>
          <button
            onClick={() => onNavigateTab('parcels')}
            className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
          >
            Voir tous les colis ({stats.parcels.total}) <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <span className="text-[11px] font-bold uppercase text-slate-700">Total Colis</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.parcels.total}</div>
            <span className="text-[10px] text-slate-700">Toutes destinations</span>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-800">En Chine</span>
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">{stats.parcels.inChina}</div>
            <span className="text-[10px] text-amber-700 font-medium">Réception / Entrepôt</span>
          </div>

          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-blue-800">En Transit</span>
              <Ship className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1">{stats.parcels.inTransit}</div>
            <span className="text-[10px] text-blue-700 font-medium">Mer & Air cargo</span>
          </div>

          <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-teal-800">Arrivés</span>
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-teal-900 mt-1">{stats.parcels.arrived}</div>
            <span className="text-[10px] text-teal-700 font-medium">Dédouanement / Port</span>
          </div>

          <div className="bg-green-50/70 p-4 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-green-800">Disponibles</span>
              <Truck className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div className="text-2xl font-black text-green-900 mt-1">
              {stats.parcels.availableAtAgency}
            </div>
            <span className="text-[10px] text-green-700 font-medium">En agence & tournées</span>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-800">Livrés</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {stats.parcels.delivered}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">Délivrés aux clients</span>
          </div>

          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-rose-800">Anomalies</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-900 mt-1">{stats.parcels.anomalies}</div>
            <span className="text-[10px] text-rose-700 font-medium">Litiges / Problèmes</span>
          </div>
        </div>
      </div>

      {/* 2. FINANCES & TRÉSORERIE MULTI-DEVISES (Only for Admin & Cashier) */}
      {(userRole === 'admin' || userRole === 'cashier') && (
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Bilan Trésorerie & Caisse Multi-Devises
              </h2>
              <p className="text-xs text-slate-400">
                Calculs consolidés en USD avec conservation stricte des devises d’origine (USD, CNY, CDF, AOA).
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('cashier')}
              className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
            >
              Détail de la caisse <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <span className="text-[11px] uppercase font-semibold text-slate-400">
                Recettes Totales Encaissées
              </span>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {formatUSD(stats.finances.totalRevenueUSD)}
              </div>
              <span className="text-[10px] text-slate-400">Paiements clients et fret</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <span className="text-[11px] uppercase font-semibold text-slate-400">
                Dépenses Totales d'Exploitation
              </span>
              <div className="text-xl font-black text-rose-400 mt-1">
                {formatUSD(stats.finances.totalExpensesUSD)}
              </div>
              <span className="text-[10px] text-slate-400">Fret, douane, loyers, salaires</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <span className="text-[11px] uppercase font-semibold text-slate-400">
                Marge Nette de Trésorerie
              </span>
              <div
                className={`text-xl font-black mt-1 ${
                  stats.finances.netBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {formatUSD(stats.finances.netBalanceUSD)}
              </div>
              <span className="text-[10px] text-slate-400">Recettes - Dépenses</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <span className="text-[11px] uppercase font-semibold text-slate-400">
                Reste à Recouvrer Clients
              </span>
              <div className="text-xl font-black text-amber-300 mt-1">
                {formatUSD(stats.finances.clientTotalRemainingUSD)}
              </div>
              <span className="text-[10px] text-slate-400">
                {stats.clients.withPendingBalance} clients avec soldes dus
              </span>
            </div>
          </div>

          {/* Caisse Balances by Currency */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Solde physique en Caisse par Devise :
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Caisse USD ($)</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatCurrency(stats.finances.balancesByCurrency.USD, 'USD')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Caisse Chine CNY (¥)</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatCurrency(stats.finances.balancesByCurrency.CNY, 'CNY')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Caisse Kinshasa CDF (FC)</span>
                <span className="font-mono font-bold text-sky-400 text-sm">
                  {formatCurrency(stats.finances.balancesByCurrency.CDF, 'CDF')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Caisse Luanda AOA (Kz)</span>
                <span className="font-mono font-bold text-purple-400 text-sm">
                  {formatCurrency(stats.finances.balancesByCurrency.AOA, 'AOA')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. EXPÉDITIONS & RECENT PARCELS SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Shipments Card */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" /> Expéditions en Cours
            </h3>
            <button
              onClick={() => onNavigateTab('shipments')}
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              Gérer
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {activeShipments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Aucune expédition en cours actuellement.
              </p>
            ) : (
              activeShipments.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onNavigateTab('shipments')}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{s.shipmentNumber}</span>
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
                  <div className="text-xs text-slate-600 mt-1 font-medium">
                    {s.departureAgencyName} ➔ {s.destination}
                  </div>
                  <div className="text-[11px] text-slate-700 mt-1 flex items-center justify-between">
                    <span>
                      {s.parcelCount} colis • {s.totalWeightKg} kg • {s.totalVolumeCbm} m³
                    </span>
                    <span className="font-semibold text-amber-700">{s.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
            <span>Maritimes : <strong>{stats.shipments.maritime}</strong></span>
            <span>Aériennes : <strong>{stats.shipments.aerien}</strong></span>
          </div>
        </div>

        {/* Recent Parcels Activity Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" /> Dernières Marchandises Enregistrées
            </h3>
            <button
              onClick={() => onNavigateTab('parcels')}
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              Voir Tout
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">N° Suivi</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Marchandise</th>
                  <th className="py-2.5 px-3">Poids / Vol</th>
                  <th className="py-2.5 px-3">Statut Actuel</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentParcels.map((p) => {
                  const statusCfg = PARCEL_STATUSES[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {p.trackingNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        <div>{p.clientName}</div>
                        <div className="text-[10px] text-slate-600">{p.clientPhone}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={p.description}>
                        {p.description}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {p.weightKg} kg / {p.volumeCbm} m³
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            statusCfg?.badgeClass || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {statusCfg?.label || p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onSelectParcel(p)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-amber-100 hover:text-amber-900 font-semibold text-slate-700 transition"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
