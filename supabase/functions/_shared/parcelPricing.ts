// Shared parcel pricing rules, imported by both the Edge API and the React form
// so the amount shown before saving is exactly the amount stored in Supabase.
// Dependency-free on purpose: it must run in Deno and in the browser bundle.

export type PricingCurrency = 'USD' | 'CNY' | 'CDF' | 'AOA';
export const PRICING_CURRENCIES: PricingCurrency[] = ['USD', 'CNY', 'CDF', 'AOA'];

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function isPricingCurrency(value: unknown): value is PricingCurrency {
  return typeof value === 'string' && (PRICING_CURRENCIES as string[]).includes(value);
}

/** Units of `currency` for 1 USD (USD → 1). Returns 0 when the rate is unknown/invalid. */
export function currencyRate(currency: PricingCurrency, rates: { CNY?: number; CDF?: number; AOA?: number }): number {
  if (currency === 'USD') return 1;
  const rate = Number(rates[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export interface ParcelPricingInput {
  weightKg: number;
  /** Universal tariff for the chosen transport mode, in `currency`. 0 = no tariff configured. */
  pricePerKg: number;
  /** Used only when no tariff is configured (legacy manual pricing), in `currency`. */
  manualFreightAmount?: number;
  extraFees: number;
  amountPaid: number;
  currency: PricingCurrency;
  /** Units of `currency` for 1 USD. */
  exchangeRate: number;
}

export interface ParcelPricing {
  currency: PricingCurrency;
  exchangeRate: number;
  pricePerKg: number;
  freightAmount: number;
  extraFees: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  transportCostUSD: number;
  extraFeesUSD: number;
  totalCostUSD: number;
  amountPaidUSD: number;
  remainingAmountUSD: number;
}

const isNumber = (value: number) => typeof value === 'number' && Number.isFinite(value);

export function computeParcelPricing(input: ParcelPricingInput): { ok: true; value: ParcelPricing } | { ok: false; error: string } {
  const { weightKg, pricePerKg, extraFees, amountPaid, currency, exchangeRate } = input;
  const manualFreight = input.manualFreightAmount ?? 0;

  if (!isNumber(weightKg) || weightKg <= 0) return { ok: false, error: 'Le poids doit être un nombre supérieur à 0 kg.' };
  if (!isPricingCurrency(currency)) return { ok: false, error: `Devise de tarification non prise en charge : ${String(currency)}.` };
  if (!isNumber(exchangeRate) || exchangeRate <= 0) return { ok: false, error: `Taux de change ${currency} invalide. Vérifiez les taux dans les paramètres.` };
  if (!isNumber(pricePerKg) || pricePerKg < 0) return { ok: false, error: 'Le tarif par kg ne peut pas être négatif.' };
  if (!isNumber(manualFreight) || manualFreight < 0) return { ok: false, error: 'Les frais de transport ne peuvent pas être négatifs.' };
  if (!isNumber(extraFees) || extraFees < 0) return { ok: false, error: 'Les frais annexes ne peuvent pas être négatifs.' };
  if (!isNumber(amountPaid) || amountPaid < 0) return { ok: false, error: 'L’acompte ne peut pas être négatif.' };

  const freightAmount = roundMoney(pricePerKg > 0 ? weightKg * pricePerKg : manualFreight);
  const fees = roundMoney(extraFees);
  const paid = roundMoney(amountPaid);
  const totalAmount = roundMoney(freightAmount + fees);
  if (paid > totalAmount) {
    return { ok: false, error: `L’acompte (${paid} ${currency}) dépasse le montant total du colis (${totalAmount} ${currency}).` };
  }

  // USD is the accounting base of payments and balances; derive it from the
  // rounded totals so that a full payment leaves exactly 0 remaining.
  const totalCostUSD = roundMoney(totalAmount / exchangeRate);
  const transportCostUSD = Math.min(totalCostUSD, roundMoney(freightAmount / exchangeRate));
  const amountPaidUSD = Math.min(totalCostUSD, roundMoney(paid / exchangeRate));

  return {
    ok: true,
    value: {
      currency,
      exchangeRate,
      pricePerKg: pricePerKg > 0 ? pricePerKg : 0,
      freightAmount,
      extraFees: fees,
      totalAmount,
      amountPaid: paid,
      remainingAmount: roundMoney(totalAmount - paid),
      transportCostUSD,
      extraFeesUSD: roundMoney(totalCostUSD - transportCostUSD),
      totalCostUSD,
      amountPaidUSD,
      remainingAmountUSD: roundMoney(totalCostUSD - amountPaidUSD),
    },
  };
}
