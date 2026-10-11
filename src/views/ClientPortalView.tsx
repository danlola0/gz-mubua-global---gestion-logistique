import React, { useState } from 'react';
import {
  Package,
  Search,
  Clock,
  DollarSign,
  Ship,
  Plane,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Phone,
} from 'lucide-react';
import type { Parcel, Payment, User } from '../types/index.ts';
import { PARCEL_STATUSES } from '../types/index.ts';
import { formatUSD } from '../services/api.ts';

interface ClientPortalViewProps {
  currentUser: User;
  parcels: Parcel[];
  payments: Payment[];
  onSelectParcel: (parcel: Parcel) => void;
  onOpenPublicTracking: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  currentUser,
  parcels,
  payments,
  onSelectParcel,
  onOpenPublicTracking,
}) => {
  const [search, setSearch] = useState('');

  // Client only sees their own parcels (matching phone or client name)
  const myParcels = parcels.filter(
    (p) =>
      p.clientPhone.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, '') ||
      p.clientName.toLowerCase() === currentUser.fullName.toLowerCase() ||
      p.clientId === currentUser.id
  );

  const filtered = myParcels.filter((p) => {
    const q = search.toLowerCase();
    return (
      !search ||
      p.trackingNumber.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  const totalDueUSD = myParcels.reduce((s, p) => s + (p.totalCostUSD || 0), 0);
  const totalPaidUSD = myParcels.reduce((s, p) => s + (p.amountPaidUSD || 0), 0);
  const remainingUSD = Math.max(0, totalDueUSD - totalPaidUSD);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome banner for client */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
              ESPACE CLIENT SÉCURISÉ
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Bonjour, {currentUser.fullName}</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-lg">
            Retrouvez en direct la progression de vos marchandises expédiées depuis la Chine vers{' '}
            Kinshasa et Luanda, vos montants réglés et vos factures.
          </p>
        </div>

        <button
          onClick={onOpenPublicTracking}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer self-start md:self-auto"
        >
          <Search className="w-4 h-4" /> Suivi Rapide par Numéro
        </button>
      </div>

      {/* Financial Status Summary for the Client */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Total Fret Facturé</span>
          <div className="text-xl font-black text-slate-900 mt-1">{formatUSD(totalDueUSD)}</div>
          <span className="text-[10px] text-slate-400">Pour {myParcels.length} colis</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Montant Déjà Réglé</span>
          <div className="text-xl font-black text-emerald-600 mt-1">{formatUSD(totalPaidUSD)}</div>
          <span className="text-[10px] text-emerald-700">Acomptes & soldes validés</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Reste à Payer</span>
          <div
            className={`text-xl font-black mt-1 ${
              remainingUSD > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatUSD(remainingUSD)}
          </div>
          <span className="text-[10px] text-slate-400">À régler à la livraison ou retrait</span>
        </div>
      </div>

      {/* Search my parcels */}
      <div className="bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher parmi mes colis (ex: COL-2026-000001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none"
          />
        </div>
      </div>

      {/* Parcels list */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" /> Mes Colis en Cours & Historique ({filtered.length})
        </h2>

        {filtered.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-400 text-xs rounded-2xl border">
            Aucun colis trouvé sous votre nom ou numéro.
          </div>
        ) : (
          filtered.map((parcel) => {
            const cfg = PARCEL_STATUSES[parcel.status];
            return (
              <div
                key={parcel.id}
                onClick={() => onSelectParcel(parcel)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-slate-900 text-base">
                      {parcel.trackingNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${cfg?.badgeClass}`}
                    >
                      {cfg?.label || parcel.status}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                      {parcel.transportMode === 'MARITIME' ? (
                        <Ship className="w-3 h-3 text-blue-600" />
                      ) : (
                        <Plane className="w-3 h-3 text-sky-600" />
                      )}
                      {parcel.transportMode}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-800 text-xs">{parcel.description}</p>

                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>
                      Poids : <strong>{parcel.weightKg} kg</strong>
                    </span>
                    <span>
                      Volume : <strong>{parcel.volumeCbm} m³</strong>
                    </span>
                    <span>
                      Destination : <strong>{parcel.destination}</strong>
                    </span>
                    {parcel.warehouseLocation && (
                      <span className="text-amber-700 font-semibold">
                        📍 {parcel.warehouseLocation}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Financial & CTA */}
                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Solde</span>
                    {parcel.remainingAmountUSD > 0 ? (
                      <span className="font-bold text-rose-600 text-sm">
                        Reste : {formatUSD(parcel.remainingAmountUSD)}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600 text-sm">Réglé intégralement ✓</span>
                    )}
                  </div>

                  <button className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition">
                    Voir la Timeline
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer support help */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
        <div>
          <strong className="block text-sm font-bold">Besoin d'aide ou d'informations sur votre colis ?</strong>
          <span>
            Contactez notre service client Kinshasa (+243 81 555 0101) ou Guangzhou (+86 138 0013 8000).
          </span>
        </div>
        <a
          href="https://wa.me/243815550101"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
        >
          WhatsApp Support
        </a>
      </div>
    </div>
  );
};
