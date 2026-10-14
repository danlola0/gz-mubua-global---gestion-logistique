// Shared building blocks for record lists: period filter, edit form, delete
// confirmation and row action buttons. Styled like the existing views.
import React, { useState } from 'react';
import { AlertTriangle, CalendarDays, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Period filter: Tout | Aujourd'hui | Hier | Cette semaine | Ce mois | Dates
// ---------------------------------------------------------------------------
export type PeriodKey = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  ALL: 'Tout',
  TODAY: "Aujourd'hui",
  YESTERDAY: 'Hier',
  WEEK: 'Cette semaine',
  MONTH: 'Ce mois',
  CUSTOM: 'Dates…',
};

/** Local calendar day "YYYY-MM-DD" of a Date. */
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Day of a record: plain "YYYY-MM-DD" values are kept, timestamps are converted to the local day. */
export function recordDay(value?: string | null): string {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : localDay(parsed);
}

export interface PeriodState {
  period: PeriodKey;
  from: string;
  to: string;
}

export function usePeriodFilter(initial: PeriodKey = 'ALL') {
  const [state, setState] = useState<PeriodState>({ period: initial, from: '', to: '' });
  const matches = (value?: string | null) => isInPeriod(recordDay(value), state);
  return { state, setState, matches };
}

export function isInPeriod(day: string, { period, from, to }: PeriodState): boolean {
  if (period === 'ALL') return true;
  if (!day) return false;
  const now = new Date();
  const today = localDay(now);
  if (period === 'TODAY') return day === today;
  if (period === 'YESTERDAY') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return day === localDay(y);
  }
  if (period === 'WEEK') {
    // Week from Monday to Sunday (French convention).
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return day >= localDay(monday) && day <= localDay(sunday);
  }
  if (period === 'MONTH') return day.slice(0, 7) === today.slice(0, 7);
  // CUSTOM: open-ended bounds are allowed.
  return (!from || day >= from) && (!to || day <= to);
}

export const PeriodFilterBar: React.FC<{
  value: PeriodState;
  onChange: (next: PeriodState) => void;
  summary?: React.ReactNode;
}> = ({ value, onChange, summary }) => (
  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-1.5">
      <CalendarDays className="h-4 w-4 text-amber-500" />
      {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...value, period: key })}
          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
            value.period === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {PERIOD_LABELS[key]}
        </button>
      ))}
      {value.period === 'CUSTOM' && (
        <span className="flex flex-wrap items-center gap-1">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-slate-300 p-1"
            aria-label="Du"
          />
          <span className="text-slate-500">au</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-slate-300 p-1"
            aria-label="Au"
          />
        </span>
      )}
    </div>
    {summary && <div className="font-semibold text-slate-700">{summary}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------
export const RowActions: React.FC<{
  onEdit?: () => void;
  onDelete?: () => void;
  editTitle?: string;
  deleteTitle?: string;
  disabledReason?: string;
}> = ({ onEdit, onDelete, editTitle = 'Modifier', deleteTitle = 'Supprimer', disabledReason }) => {
  if (!onEdit && !onDelete) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={!!disabledReason}
          title={disabledReason || editTitle}
          className="rounded-lg bg-slate-100 p-1.5 text-slate-700 transition hover:bg-amber-100 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={!!disabledReason}
          title={disabledReason || deleteTitle}
          className="rounded-lg bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Edit form (generic, driven by a field list)
// ---------------------------------------------------------------------------
export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'password' | 'email' | 'tel';
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  step?: string;
  placeholder?: string;
  hint?: string;
  full?: boolean; // spans the two columns
}

type Values = Record<string, string>;

export const EditRecordModal: React.FC<{
  title: string;
  fields: FieldDef[];
  initialValues: object;
  submitLabel?: string;
  note?: React.ReactNode;
  onSubmit: (values: Values) => Promise<void>;
  onClose: () => void;
}> = ({ title, fields, initialValues, submitLabel = 'Enregistrer', note, onSubmit, onClose }) => {
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(fields.map((f) => { const v = (initialValues as Record<string, unknown>)[f.name]; return [f.name, v === undefined || v === null ? '' : String(v).slice(0, f.type === 'date' ? 10 : undefined)]; }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
            <Pencil className="h-4 w-4 shrink-0 text-amber-500" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {note && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">{note}</div>}
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className={`block ${f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
              <span className="mb-1 block font-semibold text-slate-700">
                {f.label} {f.required && '*'}
              </span>
              {f.type === 'select' ? (
                <select
                  value={values[f.name]}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className={inputClass}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={values[f.name]}
                  required={f.required}
                  rows={2}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className={inputClass}
                />
              ) : f.type === 'password' ? (
                <span className="relative block">
                  <input
                    type={shown[f.name] ? 'text' : 'password'}
                    value={values[f.name]}
                    required={f.required}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={f.placeholder}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShown({ ...shown, [f.name]: !shown[f.name] })}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500 hover:text-amber-600"
                    aria-label={shown[f.name] ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {shown[f.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={values[f.name]}
                  required={f.required}
                  min={f.min}
                  step={f.step}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className={inputClass}
                />
              )}
              {f.hint && <span className="mt-0.5 block text-[10px] text-slate-500">{f.hint}</span>}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t pt-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
            {saving ? 'Enregistrement…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
export const ConfirmDeleteModal: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  /** When set, a checkbox with this label must be ticked before confirming. */
  acknowledgement?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}> = ({ title, message, confirmLabel = 'Confirmer la suppression', acknowledgement, onConfirm, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">{title}</h3>
        </div>
        <div className="text-xs leading-relaxed text-slate-600">{message}</div>
        {acknowledgement && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
            {acknowledgement}
          </label>
        )}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</div>}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || (!!acknowledgement && !acknowledged)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-500 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> {busy ? 'Suppression…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CDF', label: 'CDF (FC)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'AOA', label: 'AOA (Kz)' },
];
