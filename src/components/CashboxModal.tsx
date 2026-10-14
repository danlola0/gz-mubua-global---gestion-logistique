// Detail of an agency cash box: balance per payment method (per currency) and
// the transaction history of the selected method, filterable by period.
import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Wallet, X } from 'lucide-react';
import type { Currency } from '../types/index.ts';
import { formatCurrency, formatDay } from '../services/api.ts';
import type { CashboxSummary, CurrencyAmounts, MethodBalance } from '../services/cashbox.ts';
import { PeriodFilterBar, usePeriodFilter } from './RecordTools.tsx';

const AmountsList: React.FC<{ amounts: CurrencyAmounts; emptyLabel?: string; signed?: boolean }> = ({ amounts, emptyLabel = '0', signed }) => {
  const entries = (Object.entries(amounts) as [Currency, number][]).filter(([, v]) => Math.abs(v) > 0.004);
  if (entries.length === 0) return <span className="text-slate-400">{emptyLabel}</span>;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {entries.map(([currency, value]) => (
        <span key={currency} className={`font-mono font-bold ${value < 0 ? 'text-rose-600' : signed ? 'text-emerald-700' : 'text-slate-900'}`}>
          {formatCurrency(value, currency)}
        </span>
      ))}
    </span>
  );
};

export const CashboxModal: React.FC<{
  title: string;
  summary: CashboxSummary;
  onClose: () => void;
}> = ({ title, summary, onClose }) => {
  const period = usePeriodFilter();
  const [selected, setSelected] = useState<MethodBalance | null>(null);

  // In/out of the period, per method and currency.
  const periodFlows = useMemo(() => {
    const flows = new Map<string, { inflow: CurrencyAmounts; outflow: CurrencyAmounts }>();
    for (const m of summary.methods) {
      const inflow: CurrencyAmounts = {};
      const outflow: CurrencyAmounts = {};
      for (const t of m.transactions) {
        if (!period.matches(t.date)) continue;
        const target = t.direction === 'IN' ? inflow : outflow;
        target[t.currency] = Math.round(((target[t.currency] || 0) + t.amount) * 100) / 100;
      }
      flows.set(m.code, { inflow, outflow });
    }
    return flows;
  }, [summary, period.state]);

  const visibleTransactions = selected ? selected.transactions.filter((t) => period.matches(t.date)) : [];
  const selectedFlows = selected ? periodFlows.get(selected.code) : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-slate-900 p-4 text-white sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            {selected && (
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Retour">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <Wallet className="h-6 w-6 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <h3 className="truncate text-base font-black">{selected ? `${title} — ${selected.label}` : title}</h3>
              <p className="text-[11px] text-slate-300">
                {selected ? 'Historique des opérations de ce moyen de paiement' : 'Solde par moyen de paiement (chaque devise séparément)'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right text-xs [&_span]:!text-white">
              <div className="text-[10px] uppercase text-slate-400">{selected ? 'Solde du moyen' : 'Solde total'}</div>
              <AmountsList amounts={selected ? selected.balances : summary.totals} />
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto p-4 text-xs sm:p-5">
          <PeriodFilterBar
            value={period.state}
            onChange={period.setState}
            summary={
              selected && selectedFlows ? (
                <span className="flex flex-wrap items-center gap-2">
                  Entrées : <AmountsList amounts={selectedFlows.inflow} signed /> Sorties : <AmountsList amounts={selectedFlows.outflow} />
                </span>
              ) : (
                'Les soldes sont cumulés ; la période filtre les entrées/sorties et l’historique.'
              )
            }
          />

          {!selected ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Moyen de paiement</th>
                    <th className="px-3 py-2.5 text-right">Entrées (période)</th>
                    <th className="px-3 py-2.5 text-right">Sorties (période)</th>
                    <th className="px-3 py-2.5 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.methods.map((m) => (
                    <tr key={m.code} onClick={() => setSelected(m)} className="cursor-pointer transition hover:bg-amber-50/60" title="Voir l’historique">
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {m.label}
                        <span className="ml-1 text-[10px] font-normal text-slate-400">({m.transactions.length} opération(s))</span>
                      </td>
                      <td className="px-3 py-2.5 text-right"><AmountsList amounts={periodFlows.get(m.code)?.inflow || {}} signed emptyLabel="—" /></td>
                      <td className="px-3 py-2.5 text-right"><AmountsList amounts={periodFlows.get(m.code)?.outflow || {}} emptyLabel="—" /></td>
                      <td className="px-3 py-2.5 text-right"><AmountsList amounts={m.balances} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900 text-white">
                    <td className="px-3 py-2.5 font-black" colSpan={3}>Total de la caisse</td>
                    <td className="px-3 py-2.5 text-right [&_span]:text-white"><AmountsList amounts={summary.totals} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Opération</th>
                    <th className="px-3 py-2.5">Référence</th>
                    <th className="px-3 py-2.5">Détail</th>
                    <th className="px-3 py-2.5 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Aucune opération sur cette période.</td>
                    </tr>
                  )}
                  {visibleTransactions.map((t) => (
                    <tr key={`${t.direction}-${t.id}`}>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDay(t.date)}</td>
                      <td className="px-3 py-2.5">
                        {t.direction === 'IN' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><ArrowDownLeft className="h-3.5 w-3.5" /> Encaissement</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600"><ArrowUpRight className="h-3.5 w-3.5" /> Décaissement</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{t.reference}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-700" title={t.label}>{t.label}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold ${t.direction === 'IN' ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {t.direction === 'IN' ? '+' : '−'} {formatCurrency(t.amount, t.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
