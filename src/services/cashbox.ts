// Cash box balances per agency country and payment method, computed from the
// receipts (payments) and expenses loaded from Supabase. Amounts are never
// summed across currencies: every balance is kept per currency.
import type { Agency, Currency, Expense, Payment, PaymentMethodConfig } from '../types/index.ts';

export type CashCountry = 'Chine' | 'RDC' | 'Angola';
export const CASH_COUNTRIES: { country: CashCountry; label: string; mainCurrency: Currency }[] = [
  { country: 'Chine', label: 'Chine', mainCurrency: 'CNY' },
  { country: 'RDC', label: 'Kinshasa', mainCurrency: 'CDF' },
  { country: 'Angola', label: 'Angola', mainCurrency: 'AOA' },
];

/** Former generic codes (before cash boxes) mapped to the current methods. */
const LEGACY_CODES: Record<string, string> = { VIREMENT: 'BANQUE', CARTE: 'BANQUE', WECHAT_ALIPAY: 'ALIPAY' };
export const UNSPECIFIED = 'NON_PRECISE';

export function normalizeMethod(code?: string | null): string {
  const value = String(code || '').trim();
  if (!value) return UNSPECIFIED;
  return LEGACY_CODES[value] || value;
}

export type CurrencyAmounts = Partial<Record<Currency, number>>;

export interface CashTransaction {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  reference: string;
  label: string;
  amount: number;
  currency: Currency;
}

export interface MethodBalance {
  code: string;
  label: string;
  configured: boolean; // false = former/unspecified method still holding money
  balances: CurrencyAmounts;
  transactions: CashTransaction[];
}

export interface CashboxSummary {
  country: CashCountry;
  methods: MethodBalance[];
  totals: CurrencyAmounts;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const add = (target: CurrencyAmounts, currency: Currency, amount: number) => {
  target[currency] = round2((target[currency] || 0) + amount);
};

/** Country of a receipt = country of the agency that collected it (null if unknown). */
export function paymentCountry(payment: Payment, agencies: Agency[]): CashCountry | null {
  const country = agencies.find((a) => a.id === payment.agencyId)?.country;
  return country === 'Chine' || country === 'RDC' || country === 'Angola' ? country : null;
}

export function methodLabel(code: string, country: CashCountry, methods: PaymentMethodConfig[]): string {
  const configured = methods.find((m) => m.country === country && m.code === code);
  if (configured) return configured.label;
  if (code === UNSPECIFIED) return 'Non précisé (opérations antérieures)';
  if (code === 'MOBILE_MONEY') return 'Mobile Money (non précisé)';
  return code;
}

export function computeCashbox(
  country: CashCountry,
  payments: Payment[],
  expenses: Expense[],
  agencies: Agency[],
  methods: PaymentMethodConfig[]
): CashboxSummary {
  const byCode = new Map<string, MethodBalance>();
  const bucket = (code: string) => {
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        label: methodLabel(code, country, methods),
        configured: methods.some((m) => m.country === country && m.code === code),
        balances: {},
        transactions: [],
      });
    }
    return byCode.get(code)!;
  };
  // Every active configured method is listed, even with a zero balance.
  methods
    .filter((m) => m.country === country && m.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((m) => bucket(m.code));

  const totals: CurrencyAmounts = {};
  for (const p of payments) {
    if (paymentCountry(p, agencies) !== country) continue;
    const amount = Number(p.originalAmount) || 0;
    const b = bucket(normalizeMethod(p.paymentMethod));
    add(b.balances, p.currency, amount);
    add(totals, p.currency, amount);
    b.transactions.push({ id: p.id, date: String(p.date), direction: 'IN', reference: p.receiptNumber, label: p.clientName + (p.parcelTrackingNumber ? ` • ${p.parcelTrackingNumber}` : ''), amount, currency: p.currency });
  }
  for (const e of expenses) {
    if (e.country !== country) continue;
    const amount = Number(e.originalAmount) || 0;
    const b = bucket(normalizeMethod(e.paymentMethod));
    add(b.balances, e.currency, -amount);
    add(totals, e.currency, -amount);
    b.transactions.push({ id: e.id, date: String(e.date), direction: 'OUT', reference: e.voucherNumber, label: `${e.categoryLabel} • ${e.beneficiary}`, amount, currency: e.currency });
  }
  for (const b of byCode.values()) b.transactions.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  return { country, methods: Array.from(byCode.values()), totals };
}

/** Receipts collected without an agency cannot be placed in any cash box. */
export function unassignedPayments(payments: Payment[], agencies: Agency[]): Payment[] {
  return payments.filter((p) => paymentCountry(p, agencies) === null);
}
