import React, { useState } from 'react';
import {
  TrendingDown,
  PlusCircle,
  Filter,
  Search,
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Tag,
} from 'lucide-react';
import type { Expense, ExpenseCategory, Currency, Agency, UserRole, PaymentMethodConfig } from '../types/index.ts';
import { methodLabel, normalizeMethod, type CashCountry } from '../services/cashbox.ts';
import { formatUSD, formatCurrency, formatDay } from '../services/api.ts';
import {
  ConfirmDeleteModal,
  CURRENCY_OPTIONS,
  EditRecordModal,
  PeriodFilterBar,
  RowActions,
  usePeriodFilter,
} from '../components/RecordTools.tsx';

interface ExpensesViewProps {
  expenses: Expense[];
  agencies: Agency[];
  userRole: UserRole;
  userName: string;
  userId: string;
  onCreateExpense: (data: any) => Promise<void>;
  onUpdateExpense?: (id: string, data: Partial<Expense>) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  paymentMethods?: PaymentMethodConfig[];
  userAgencyId?: string;
}

const CATEGORY_OPTIONS: { key: ExpenseCategory; label: string }[] = [
  { key: 'transport', label: 'Fret Maritime & Aérien International' },
  { key: 'douane', label: 'Douane & Formalités de Transit' },
  { key: 'carburant', label: 'Carburant & Camionnettes' },
  { key: 'manutention', label: 'Manutention & Dockers' },
  { key: 'stockage', label: 'Stockage & Hangar' },
  { key: 'loyer', label: 'Loyer Agences & Entrepôts' },
  { key: 'salaire', label: 'Salaires & Rémunérations' },
  { key: 'achat', label: 'Achats pour compte de l’entreprise' },
  { key: 'communication', label: 'Télécoms, Internet & Marketing' },
  { key: 'materiel', label: 'Matériel de conditionnement & emballage' },
  { key: 'livraison', label: 'Frais de livraison locale' },
  { key: 'frais_chine', label: 'Frais spécifiques Agence Chine' },
  { key: 'frais_kinshasa', label: 'Frais spécifiques Kinshasa' },
  { key: 'frais_angola', label: 'Frais spécifiques Agence Angola' },
  { key: 'autres', label: 'Autres dépenses générales' },
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  agencies,
  userRole,
  userName,
  userId,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
  paymentMethods = [],
  userAgencyId,
}) => {
  const methodsFor = (country?: string) =>
    paymentMethods.filter((m) => m.country === country && m.active).sort((a, b) => a.sortOrder - b.sortOrder);
  // Cashier and admin may correct an expense; only the admin deletes one.
  const canEdit = !!onUpdateExpense && (userRole === 'admin' || userRole === 'cashier');
  const canDelete = !!onDeleteExpense && userRole === 'admin';
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const period = usePeriodFilter();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');

  // Form State
  const [category, setCategory] = useState<ExpenseCategory>('transport');
  const [originalAmount, setOriginalAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [agencyId, setAgencyId] = useState((userRole !== 'admin' && userAgencyId) || agencies[0]?.id || '');
  const [expenseMethod, setExpenseMethod] = useState('ESPECES');
  const expenseCountry = agencies.find((a) => a.id === agencyId)?.country;
  const [beneficiary, setBeneficiary] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredExpenses = expenses.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      e.voucherNumber.toLowerCase().includes(q) ||
      e.beneficiary.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'ALL' || e.category === categoryFilter;
    const matchCountry = countryFilter === 'ALL' || e.country === countryFilter;
    return matchSearch && matchCat && matchCountry && period.matches(e.date);
  });

  const totalUSD = filteredExpenses.reduce((s, e) => s + (e.amountUSD || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalAmount || Number(originalAmount) <= 0 || !beneficiary.trim()) {
      alert('Veuillez renseigner un bénéficiaire et un montant valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      const agency = agencies.find((a) => a.id === agencyId);
      const catConfig = CATEGORY_OPTIONS.find((c) => c.key === category);

      await onCreateExpense({
        category,
        categoryLabel: catConfig?.label || category,
        originalAmount: Number(originalAmount),
        currency,
        agencyId,
        agencyName: agency?.name || '',
        country: agency?.country || 'RDC',
        paymentMethod: expenseMethod,
        beneficiary,
        description,
        attachmentName,
        userName,
        userId,
      });

      setShowModal(false);
      setOriginalAmount('');
      setBeneficiary('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Gestion Centralisée des Dépenses
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              Total : {formatUSD(totalUSD)}
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Suivi des coûts d'exploitation : fret, douane, carburant, loyers, manutention et frais d'agences.
          </p>
        </div>

        {userRole !== 'client' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" /> Enregistrer une Dépense
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par pièce, bénéficiaire, motif..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="ALL">Toutes les catégories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="ALL">Tous les pays</option>
            <option value="Chine">Chine</option>
            <option value="RDC">RDC (Kinshasa)</option>
            <option value="Angola">Angola (Luanda)</option>
          </select>
        </div>
      </div>

      <PeriodFilterBar
        value={period.state}
        onChange={period.setState}
        summary={<>{filteredExpenses.length} dépense(s) • Total : <span className="text-rose-600">{formatUSD(totalUSD)}</span></>}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Pièce</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Bénéficiaire & Description</th>
                <th className="py-3 px-4">Agence / Pays</th>
                <th className="py-3 px-4">Montant Payé</th>
                <th className="py-3 px-4">Contrevaleur USD</th>
                <th className="py-3 px-4">Enregistré Par</th>
                {(canEdit || canDelete) && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Aucune dépense enregistrée dans cette sélection.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {exp.voucherNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{formatDay(exp.date)}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{exp.categoryLabel}</td>
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-bold text-slate-900">{exp.beneficiary}</div>
                      <div className="text-[10px] text-slate-700 truncate" title={exp.description}>
                        {exp.description}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{exp.agencyName}</div>
                      <div className="text-[10px] text-slate-700 font-bold">{exp.country}</div>
                      {exp.paymentMethod && (
                        <div className="text-[10px] text-slate-500">
                          {methodLabel(normalizeMethod(exp.paymentMethod), exp.country as CashCountry, paymentMethods)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-black text-rose-600">
                      {formatCurrency(exp.originalAmount, exp.currency)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatUSD(exp.amountUSD)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{exp.recordedBy}</td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4 text-right">
                        <RowActions
                          onEdit={canEdit ? () => setEditing(exp) : undefined}
                          onDelete={canDelete ? () => setDeleting(exp) : undefined}
                          disabledReason={exp.category === 'salaire' ? 'Dépense de salaire : modifiez ou supprimez le bulletin dans « Salaires »' : undefined}
                        />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Expense */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-600" /> Enregistrer une Dépense
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catégorie de Dépense *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Agence & Lieu d'engagement *
                </label>
                <select
                  value={agencyId}
                  onChange={(e) => {
                    setAgencyId(e.target.value);
                    const country = agencies.find((a) => a.id === e.target.value)?.country;
                    setExpenseMethod(methodsFor(country)[0]?.code || '');
                  }}
                  disabled={userRole !== 'admin'}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                  required
                >
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.country})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payé depuis (moyen de paiement de la caisse) *
                </label>
                <select
                  value={expenseMethod}
                  onChange={(e) => setExpenseMethod(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  {methodsFor(expenseCountry).length === 0 && <option value="">Aucun moyen configuré pour cette caisse</option>}
                  {methodsFor(expenseCountry).map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-rose-50 p-3 rounded-xl border border-rose-200">
                <div>
                  <label className="block font-bold text-rose-900 mb-1">Devise</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full p-2 rounded-lg border border-rose-300 bg-white font-bold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CNY">CNY (¥ - Chine)</option>
                    <option value="CDF">CDF (FC - RDC)</option>
                    <option value="AOA">AOA (Kz - Angola)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-rose-900 mb-1">Montant *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 1200"
                    value={originalAmount}
                    onChange={(e) =>
                      setOriginalAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-2 rounded-lg border border-rose-300 bg-white font-black"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bénéficiaire (Fournisseur, compagnie, personne) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: MSC Shipping, TotalEnergies, Propriétaire hangar..."
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motif / Description précise
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Règlement fret conteneur 40HC Matadi..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Valider la Dépense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editing && onUpdateExpense && (
        <EditRecordModal
          title={`Corriger la dépense ${editing.voucherNumber}`}
          note="L’ancienne et la nouvelle valeur sont conservées dans le journal d’audit."
          initialValues={editing}
          fields={[
            {
              name: 'category',
              label: 'Catégorie',
              type: 'select',
              required: true,
              options: CATEGORY_OPTIONS.filter((o) => o.key !== 'salaire').map((o) => ({ value: o.key, label: o.label })),
            },
            { name: 'originalAmount', label: 'Montant', type: 'number', required: true, min: 0.01, step: '0.01' },
            { name: 'currency', label: 'Devise', type: 'select', options: CURRENCY_OPTIONS, required: true },
            { name: 'date', label: 'Date', type: 'date', required: true },
            {
              name: 'country',
              label: 'Pays',
              type: 'select',
              options: [
                { value: 'Chine', label: 'Chine' },
                { value: 'RDC', label: 'RDC' },
                { value: 'Angola', label: 'Angola' },
              ],
            },
            {
              name: 'paymentMethod',
              label: 'Payé depuis',
              type: 'select',
              hint: 'Moyen de paiement de la caisse du pays choisi.',
              options: (() => {
                const options = methodsFor(editing.country).map((m) => ({ value: m.code, label: m.label }));
                return !editing.paymentMethod || options.some((o) => o.value === editing.paymentMethod)
                  ? [{ value: '', label: '— Non précisé —' }, ...options]
                  : [{ value: editing.paymentMethod, label: `${editing.paymentMethod} (ancien)` }, ...options];
              })(),
            },
            { name: 'beneficiary', label: 'Bénéficiaire', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
          onSubmit={(v) =>
            onUpdateExpense(editing.id, {
              category: v.category as ExpenseCategory,
              categoryLabel: CATEGORY_OPTIONS.find((o) => o.key === v.category)?.label || v.category,
              originalAmount: Number(v.originalAmount),
              currency: v.currency as Currency,
              date: v.date,
              country: v.country as Expense['country'],
              beneficiary: v.beneficiary,
              description: v.description,
              ...(v.paymentMethod ? { paymentMethod: v.paymentMethod } : {}),
            })
          }
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && onDeleteExpense && (
        <ConfirmDeleteModal
          title={`Supprimer la dépense ${deleting.voucherNumber} ?`}
          message={
            <>
              Montant : <strong>{formatCurrency(deleting.originalAmount, deleting.currency)}</strong> ({deleting.beneficiary}).
              La dépense disparaîtra des totaux ; son détail reste conservé dans le journal d’audit.
            </>
          }
          onConfirm={() => onDeleteExpense(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
