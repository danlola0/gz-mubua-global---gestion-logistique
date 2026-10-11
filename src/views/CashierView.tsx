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
import type { Payment, Expense, Client, Parcel, Currency, ExchangeRates, UserRole } from '../types/index.ts';
import { formatUSD, formatCurrency } from '../services/api.ts';

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
}) => {
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
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
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
        reference,
        notes,
        cashierId: userId,
        cashierName: userName,
      });

      setShowNewPaymentModal(false);
      setOriginalAmount('');
      setNotes('');
      setReference('');
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
    return matchSearch && matchCurr;
  });

  // Calculate balances per currency
  const totalUSD =
    payments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.originalAmount, 0) -
    expenses.filter((e) => e.currency === 'USD').reduce((s, e) => s + e.originalAmount, 0);

  const totalCNY =
    payments.filter((p) => p.currency === 'CNY').reduce((s, p) => s + p.originalAmount, 0) -
    expenses.filter((e) => e.currency === 'CNY').reduce((s, e) => s + e.originalAmount, 0);

  const totalCDF =
    payments.filter((p) => p.currency === 'CDF').reduce((s, p) => s + p.originalAmount, 0) -
    expenses.filter((e) => e.currency === 'CDF').reduce((s, e) => s + e.originalAmount, 0);

  const totalAOA =
    payments.filter((p) => p.currency === 'AOA').reduce((s, p) => s + p.originalAmount, 0) -
    expenses.filter((e) => e.currency === 'AOA').reduce((s, e) => s + e.originalAmount, 0);

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

        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-400">
            Solde Caisse Chine CNY (¥)
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {formatCurrency(totalCNY, 'CNY')}
          </div>
          <span className="text-[10px] text-slate-400">Guangzhou & Yiwu</span>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-400">
            Solde Caisse Kinshasa CDF (FC)
          </span>
          <div className="text-2xl font-black text-sky-400 mt-1">
            {formatCurrency(totalCDF, 'CDF')}
          </div>
          <span className="text-[10px] text-slate-400">Gombe & Limete</span>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-400">
            Solde Caisse Angola AOA (Kz)
          </span>
          <div className="text-2xl font-black text-purple-400 mt-1">
            {formatCurrency(totalAOA, 'AOA')}
          </div>
          <span className="text-[10px] text-slate-400">Luanda Viana</span>
        </div>
      </div>

      {/* Tab bar */}
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
                  <th className="py-3 px-4">Contrevaleur USD</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
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
                        <div className="font-medium text-slate-800">{p.date}</div>
                        <div className="text-[10px] text-slate-700">{p.agencyName}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.clientName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {p.parcelTrackingNumber || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.type}</span>
                        <div className="text-[10px] text-slate-700">{p.paymentMethod}</div>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCurrency(p.originalAmount, p.currency)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatUSD(p.amountUSD)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onOpenReceipt(p)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5" /> Reçu
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
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="ESPECES">Espèces au guichet</option>
                    <option value="MOBILE_MONEY">Mobile Money (M-Pesa / Airtel)</option>
                    <option value="VIREMENT">Virement bancaire</option>
                    <option value="WECHAT_ALIPAY">WeChat Pay / Alipay (Chine)</option>
                    <option value="CARTE">Carte bancaire (TPE)</option>
                  </select>
                </div>
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
    </div>
  );
};
