import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  PlusCircle,
  Search,
  Filter,
  Printer,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';
import type { Payment, Expense, Client, Parcel, Currency, ExchangeRates, UserRole, Agency, PaymentMethodConfig } from '../types/index.ts';
import { CASH_COUNTRIES, computeCashbox, methodLabel, normalizeMethod, unassignedPayments, type CashCountry } from '../services/cashbox.ts';
import { CashboxModal } from '../components/CashboxModal.tsx';
import { formatUSD, formatCurrency, formatDay } from '../services/api.ts';
import {
  ConfirmDeleteModal,
  CURRENCY_OPTIONS,
  EditRecordModal,
  PeriodFilterBar,
  RowActions,
  usePeriodFilter,
} from '../components/RecordTools.tsx';

const PAYMENT_TYPE_OPTIONS = [
  { value: 'AVANCE', label: 'Avance / acompte' },
  { value: 'SOLDE', label: 'Solde' },
  { value: 'FRAIS_TRANSPORT', label: 'Frais de transport' },
  { value: 'FRAIS_SUPPLEMENTAIRES', label: 'Frais supplémentaires' },
  { value: 'AUTRE_RECETTE', label: 'Autre recette' },
];

interface CashierViewProps {
  payments: Payment[];
  expenses: Expense[];
  clients: Client[];
  parcels: Parcel[];
  exchangeRates: ExchangeRates;
  userRole: UserRole;
  userName: string;
  userId: string;
  onOpenReceipt: (payment: Payment) => void;
  onCreatePayment: (data: any) => Promise<void>;
  onUpdatePayment?: (id: string, data: Partial<Payment>) => Promise<void>;
  agencies?: Agency[];
  paymentMethods?: PaymentMethodConfig[];
  userAgencyId?: string;
  onDeletePayment?: (id: string) => Promise<void>;
}

export const CashierView: React.FC<CashierViewProps> = ({
  payments,
  expenses,
  clients,
  parcels,
  exchangeRates,
  userRole,
  userName,
  userId,
  onOpenReceipt,
  onCreatePayment,
  onUpdatePayment,
  onDeletePayment,
  agencies = [],
  paymentMethods = [],
  userAgencyId,
}) => {
  // ---- Cash boxes per agency country ----
  const userCountry = agencies.find((a) => a.id === userAgencyId)?.country as CashCountry | undefined;
  // Admin: every cash box; other roles: only their agency's cash box (data already limited by RLS).
  const visibleCountries = CASH_COUNTRIES.filter((c) => userRole === 'admin' || c.country === userCountry);
  const [openCountry, setOpenCountry] = useState<CashCountry | null>(null);
  const unassigned = unassignedPayments(payments, agencies);
  const methodsFor = (country?: string) =>
    paymentMethods.filter((m) => m.country === country && m.active).sort((a, b) => a.sortOrder - b.sortOrder);
  // Agency whose cash box receives a new receipt (admin may choose, others: own agency).
  const [cashAgencyId, setCashAgencyId] = useState(userAgencyId || agencies[0]?.id || '');
  const cashCountry = agencies.find((a) => a.id === cashAgencyId)?.country;
  // Corrections: cashier and admin may correct a receipt; only the admin deletes one.
  const canEditPayment = !!onUpdatePayment && (userRole === 'admin' || userRole === 'cashier');
  const canDeletePayment = !!onDeletePayment && userRole === 'admin';
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const paymentPeriod = usePeriodFilter();
  const [activeTab, setActiveTab] = useState<'recettes' | 'depenses' | 'balances'>('recettes');
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);

  // New Payment Form state
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [selectedParcelId, setSelectedParcelId] = useState('');
  const [paymentType, setPaymentType] = useState('AVANCE');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [originalAmount, setOriginalAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client's unpaid parcels when client selected
  const clientParcels = useMemo(() => {
    if (!selectedClientId) return [];
    return parcels.filter((p) => p.clientId === selectedClientId);
  }, [selectedClientId, parcels]);

  // Handle client selection change
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const related = parcels.filter((p) => p.clientId === clientId);
    if (related.length > 0) {
      setSelectedParcelId(related[0].id);
      // default amount to remaining balance if any
      if (related[0].remainingAmountUSD > 0) {
        setOriginalAmount(related[0].remainingAmountUSD);
      }
    } else {
      setSelectedParcelId('');
    }
  };

  const handleParcelChange = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    const p = parcels.find((item) => item.id === parcelId);
    if (p && p.remainingAmountUSD > 0) {
      setOriginalAmount(p.remainingAmountUSD);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !originalAmount || Number(originalAmount) <= 0) {
      alert('Veuillez renseigner un client et un montant valide.');
      return;
    }
    if (!methodsFor(cashCountry).some((m) => m.code === paymentMethod)) {
      alert('Veuillez choisir le mode de paiement de la caisse de l’agence.');
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients.find((c) => c.id === selectedClientId);
      const parcel = parcels.find((p) => p.id === selectedParcelId);

      await onCreatePayment({
        clientId: selectedClientId,
        clientName: client?.fullName || 'Client',
        parcelId: selectedParcelId || undefined,
        parcelTrackingNumber: parcel?.trackingNumber || undefined,
        type: paymentType,
        originalAmount: Number(originalAmount),
        currency,
        paymentMethod,
        agencyId: cashAgencyId || undefined,
        reference,
        notes,
        cashierId: userId,
        cashierName: userName,
      });

      setShowNewPaymentModal(false);
      setOriginalAmount('');
      setNotes('');
      setReference('');
      setPaymentMethod('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.receiptNumber.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      (p.parcelTrackingNumber && p.parcelTrackingNumber.toLowerCase().includes(q));
    const matchCurr = currencyFilter === 'ALL' || p.currency === currencyFilter;
    return matchSearch && matchCurr && paymentPeriod.matches(p.date);
  });
  const periodTotalUSD = filteredPayments.reduce((sum, p) => sum + (Number(p.amountUSD) || 0), 0);

  // Calculate balances per currency
  const totalUSD =
    payments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.originalAmount, 0) -
    expenses.filter((e) => e.currency === 'USD').reduce((s, e) => s + e.originalAmount, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Caisse & Gestion Financière
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Multi-Devises
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Encaissements clients, acomptes fret, soldes de livraison et suivi strict de trésorerie par devise.
          </p>
        </div>

        {userRole !== 'client' && (
          <button
            onClick={() => setShowNewPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" /> Encaisser un Paiement
          </button>
        )}
      </div>

      {/* Currency Balances Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-400">
            Solde Caisse USD ($)
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formatCurrency(totalUSD, 'USD')}
          </div>
          <span className="text-[10px] text-slate-400">Trésorerie internationale</span>
        </div>

        {visibleCountries.map(({ country, label, mainCurrency }) => {
          const box = computeCashbox(country, payments, expenses, agencies, paymentMethods);
          const others = (Object.entries(box.totals) as [Currency, number][]).filter(([c, v]) => c !== mainCurrency && Math.abs(v) > 0.004);
          const names = agencies.filter((a) => a.country === country).map((a) => a.name).join(' & ');
          const color = country === 'Chine' ? 'text-amber-400' : country === 'RDC' ? 'text-sky-400' : 'text-purple-400';
          return (
            <button
              key={country}
              type="button"
              onClick={() => setOpenCountry(country)}
              className="text-left bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm transition hover:border-amber-500 hover:ring-2 hover:ring-amber-500/30"
              title="Voir le détail par moyen de paiement"
            >
              <span className="text-[11px] font-semibold uppercase text-slate-400">Solde Caisse {label}</span>
              <div className={`text-2xl font-black mt-1 ${color}`}>{formatCurrency(box.totals[mainCurrency] || 0, mainCurrency)}</div>
              {others.map(([c, v]) => (
                <div key={c} className="text-xs font-bold text-slate-200">{formatCurrency(v, c)}</div>
              ))}
              <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                <span className="truncate">{names || 'Aucune agence configurée'}</span>
                <span className="shrink-0 font-bold text-amber-400">Détail ›</span>
              </span>
            </button>
          );
        })}
      </div>

      {userRole === 'admin' && unassigned.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {unassigned.length} encaissement(s) enregistré(s) avant l’affectation aux caisses ne sont rattachés à aucune agence
          ({unassigned.map((p) => p.receiptNumber).join(', ')}) : ils comptent dans le solde USD global mais dans aucune caisse.
          Corrigez-les via ✏️ dans la liste ci-dessous en choisissant l’agence.
        </p>
      )}

      {openCountry && (
        <CashboxModal
          title={`Caisse ${CASH_COUNTRIES.find((c) => c.country === openCountry)?.label}`}
          summary={computeCashbox(openCountry, payments, expenses, agencies, paymentMethods)}
          onClose={() => setOpenCountry(null)}
        />
      )}

      {/* Tab bar */}      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
        <button
          onClick={() => setActiveTab('recettes')}
          className={`flex-1 min-w-[200px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'recettes'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Recettes & Encaissements Clients ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('depenses')}
          className={`flex-1 min-w-[200px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'depenses'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingDown className="w-4 h-4" /> Décaissements & Dépenses ({expenses.length})
        </button>
      </div>

      {/* Recettes Ledger Table */}
      {activeTab === 'recettes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher par n° reçu, client, n° suivi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
              <span className="text-slate-700">Devise :</span>
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">Toutes les devises</option>
                <option value="USD">USD ($)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="CDF">CDF (FC)</option>
                <option value="AOA">AOA (Kz)</option>
              </select>
            </div>
          </div>

          <PeriodFilterBar
            value={paymentPeriod.state}
            onChange={paymentPeriod.setState}
            summary={<>{filteredPayments.length} encaissement(s) • Total : <span className="text-emerald-700">{formatUSD(periodTotalUSD)}</span></>}
          />

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">N° Reçu</th>
                  <th className="py-3 px-4">Date & Agence</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Colis Lié</th>
                  <th className="py-3 px-4">Nature & Mode</th>
                  <th className="py-3 px-4">Montant Reçu</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Aucune transaction trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{formatDay(p.date)}</div>
                        <div className="text-[10px] text-slate-700">{p.agencyName}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.clientName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {p.parcelTrackingNumber || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.type}</span>
                        <div className="text-[10px] text-slate-700">
                          {(() => {
                            const country = agencies.find((a) => a.id === p.agencyId)?.country as CashCountry | undefined;
                            return country ? methodLabel(normalizeMethod(p.paymentMethod), country, paymentMethods) : p.paymentMethod;
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCurrency(p.originalAmount, p.currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenReceipt(p)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            <Printer className="w-3.5 h-3.5" /> Reçu
                          </button>
                          <RowActions
                            onEdit={canEditPayment ? () => setEditingPayment(p) : undefined}
                            onDelete={canDeletePayment ? () => setDeletingPayment(p) : undefined}
                            editTitle="Corriger ce reçu"
                            deleteTitle="Supprimer ce reçu"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dépenses summary tab */}
      {activeTab === 'depenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Pièce</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Bénéficiaire & Motif</th>
                <th className="py-3 px-4">Agence / Pays</th>
                <th className="py-3 px-4">Montant</th>
                <th className="py-3 px-4">Total USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{e.voucherNumber}</td>
                  <td className="py-3 px-4">{e.date}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{e.categoryLabel}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{e.beneficiary}</div>
                    <div className="text-[10px] text-slate-700">{e.description}</div>
                  </td>
                  <td className="py-3 px-4">
                    {e.agencyName} ({e.country})
                  </td>
                  <td className="py-3 px-4 font-black text-rose-600">
                    {formatCurrency(e.originalAmount, e.currency)}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatUSD(e.amountUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Encaisser un Paiement */}
      {showNewPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Encaisser un Paiement Client
              </h3>
              <button
                onClick={() => setShowNewPaymentModal(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Client Débiteur *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} - Solde dû : {formatUSD(c.remainingBalanceUSD)}
                    </option>
                  ))}
                </select>
              </div>

              {clientParcels.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Associer au Colis concerné
                  </label>
                  <select
                    value={selectedParcelId}
                    onChange={(e) => handleParcelChange(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                  >
                    <option value="">Aucun (Acompte général sur compte client)</option>
                    {clientParcels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.trackingNumber} ({p.description}) - Reste :{' '}
                        {formatUSD(p.remainingAmountUSD)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nature du Règlement
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="AVANCE">Acompte à la commande</option>
                    <option value="SOLDE">Règlement du solde</option>
                    <option value="FRAIS_TRANSPORT">Fret maritime / aérien</option>
                    <option value="FRAIS_SUPPLEMENTAIRES">Frais supplémentaires</option>
                    <option value="AUTRE_RECETTE">Autre recette diverse</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mode de Paiement
                  </label>
                  <select
                    value={paymentMethod}
                    required
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">
                      {methodsFor(cashCountry).length === 0 ? 'Aucun moyen configuré pour cette caisse' : '— Choisir le mode de paiement —'}
                    </option>
                    {methodsFor(cashCountry).map((m) => (
                      <option key={m.id} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                {userRole === 'admin' && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Caisse (agence d’encaissement)
                    </label>
                    <select
                      value={cashAgencyId}
                      required
                      onChange={(e) => {
                        setCashAgencyId(e.target.value);
                        const country = agencies.find((a) => a.id === e.target.value)?.country;
                        if (!methodsFor(country).some((m) => m.code === paymentMethod)) setPaymentMethod('');
                      }}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      {CASH_COUNTRIES.map(({ country, label }) => {
                        const countryAgencies = agencies.filter((a) => a.country === country);
                        const modes = methodsFor(country).map((m) => m.label).join(' · ') || 'aucun mode configuré';
                        return (
                          <optgroup key={country} label={`Caisse ${label} — ${modes}`}>
                            {countryAgencies.length === 0 ? (
                              <option value={`NONE-${country}`} disabled>
                                Aucune agence {label} créée (Paramètres › Agences)
                              </option>
                            ) : (
                              countryAgencies.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.city || a.country})
                                </option>
                              ))
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                    {CASH_COUNTRIES.some(({ country }) => !agencies.some((a) => a.country === country)) && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        Pour encaisser dans la caisse{' '}
                        {CASH_COUNTRIES.filter(({ country }) => !agencies.some((a) => a.country === country))
                          .map((c) => c.label)
                          .join(' / ')}
                        , créez d’abord l’agence dans Paramètres › Agences.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Devise Encaissée
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white font-bold"
                  >
                    <option value="USD">USD ($) - Dollar US</option>
                    <option value="CNY">CNY (¥) - Yuan Chinois</option>
                    <option value="CDF">CDF (FC) - Franc Congolais</option>
                    <option value="AOA">AOA (Kz) - Kwanza Angolais</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Montant dans cette devise *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 500"
                    value={originalAmount}
                    onChange={(e) =>
                      setOriginalAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white font-black text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Référence / N° Transaction (facultatif)
                </label>
                <input
                  type="text"
                  placeholder="Ex: ID Transaction M-Pesa ou N° bordereau banque"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Commentaire / Note de caisse
                </label>
                <input
                  type="text"
                  placeholder="Note particulière..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewPaymentModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Valider Encaissement & Générer Reçu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingPayment && onUpdatePayment && (
        <EditRecordModal
          title={`Corriger le reçu ${editingPayment.receiptNumber}`}
          note="Les soldes du colis et du client sont recalculés. L’ancienne et la nouvelle valeur sont conservées dans le journal d’audit."
          initialValues={editingPayment}
          fields={[
            { name: 'originalAmount', label: 'Montant reçu', type: 'number', required: true, min: 0.01, step: '0.01' },
            { name: 'currency', label: 'Devise', type: 'select', options: CURRENCY_OPTIONS, required: true },
            { name: 'type', label: 'Nature', type: 'select', options: PAYMENT_TYPE_OPTIONS },
            {
              name: 'paymentMethod',
              label: 'Mode de paiement',
              type: 'select',
              hint: userRole === 'admin' ? 'Si vous changez de caisse, choisissez un moyen disponible dans le pays de cette agence.' : undefined,
              options: (() => {
                const country = agencies.find((a) => a.id === editingPayment.agencyId)?.country;
                // Receipt without agency (admin will assign one): offer every configured method.
                const pool = country
                  ? methodsFor(country)
                  : paymentMethods.filter((m) => m.active && (userRole === 'admin' || m.country === userCountry));
                const options = Array.from(new Map(pool.map((m) => [m.code, { value: m.code, label: country ? m.label : `${m.label} (${m.country})` }])).values());
                return options.some((o) => o.value === editingPayment.paymentMethod)
                  ? options
                  : [{ value: editingPayment.paymentMethod, label: `${editingPayment.paymentMethod} (ancien)` }, ...options];
              })(),
            },
            ...(userRole === 'admin'
              ? [{ name: 'agencyId', label: 'Caisse (agence)', type: 'select' as const, required: true, options: [{ value: '', label: '— Choisir —' }, ...agencies.map((a) => ({ value: a.id, label: `${a.name} (${a.country})` }))] }]
              : []),
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'reference', label: 'Référence' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          onSubmit={(v) =>
            onUpdatePayment(editingPayment.id, {
              originalAmount: Number(v.originalAmount),
              currency: v.currency as Currency,
              type: v.type as Payment['type'],
              paymentMethod: v.paymentMethod as Payment['paymentMethod'],
              ...(userRole === 'admin' && v.agencyId ? { agencyId: v.agencyId } : {}),
              date: v.date,
              reference: v.reference,
              notes: v.notes,
            })
          }
          onClose={() => setEditingPayment(null)}
        />
      )}
      {deletingPayment && onDeletePayment && (
        <ConfirmDeleteModal
          title={`Supprimer le reçu ${deletingPayment.receiptNumber} ?`}
          message={
            <>
              Montant : <strong>{formatCurrency(deletingPayment.originalAmount, deletingPayment.currency)}</strong> ({deletingPayment.clientName}).
              Le reçu disparaîtra de la caisse et les soldes du colis et du client seront recalculés. Le détail reste
              conservé dans le journal d’audit.
            </>
          }
          onConfirm={() => onDeletePayment(deletingPayment.id)}
          onClose={() => setDeletingPayment(null)}
        />
      )}
    </div>
  );
};
