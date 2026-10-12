// Shared parcel pricing rules, imported by both the Edge API and the React form
// so the amount shown before saving is exactly the amount stored in Supabase.
// Dependency-free on purpose: it must run in Deno and in the browser bundle.
//
//   Air (AERIEN)     : freight = weight (kg)   x price per kg
//   Sea (MARITIME)   : freight = volume (CBM)  x price per CBM,
//                      volume  = length x width x height (cm) / 1 000 000

export type PricingCurrency = 'USD' | 'CNY' | 'CDF' | 'AOA';
export const PRICING_CURRENCIES: PricingCurrency[] = ['USD', 'CNY', 'CDF', 'AOA'];
export type PricingBasis = 'KG' | 'CBM';

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const roundVolume = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export function isPricingCurrency(value: unknown): value is PricingCurrency {
  return typeof value === 'string' && (PRICING_CURRENCIES as string[]).includes(value);
}

/** Pricing basis of a transport mode: air by weight, sea by volume. */
export const basisForMode = (mode: unknown): PricingBasis => (mode === 'AERIEN' ? 'KG' : 'CBM');

/** Volume in CBM from dimensions in centimetres; null unless all three are > 0. */
export function volumeFromDimensionsCm(lengthCm: unknown, widthCm: unknown, heightCm: unknown): number | null {
  const l = Number(lengthCm), w = Number(widthCm), h = Number(heightCm);
  if (![l, w, h].every((d) => Number.isFinite(d) && d > 0)) return null;
  return roundVolume((l * w * h) / 1_000_000);
}

/** Units of `currency` for 1 USD (USD → 1). Returns 0 when the rate is unknown/invalid. */
export function currencyRate(currency: PricingCurrency, rates: { CNY?: number; CDF?: number; AOA?: number }): number {
  if (currency === 'USD') return 1;
  const rate = Number(rates[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export interface ParcelPricingInput {
  /** 'KG' (air) or 'CBM' (sea). Defaults to 'KG' for parcels priced before CBM pricing. */
  basis?: PricingBasis;
  weightKg: number;
  /** Required (> 0) for the CBM basis. */
  volumeCbm?: number;
  /** Tariff for the basis (per kg or per CBM), in `currency`. 0 = no tariff configured. */
  unitPrice: number;
  /** Used only when no tariff is configured (legacy manual pricing), in `currency`. */
  manualFreightAmount?: number;
  extraFees: number;
  amountPaid: number;
  currency: PricingCurrency;
  /** Units of `currency` for 1 USD. */
  exchangeRate: number;
}

export interface ParcelPricing {
  basis: PricingBasis;
  currency: PricingCurrency;
  exchangeRate: number;
  unitPrice: number;
  /** Weight (kg) or volume (CBM) the tariff was applied to. */
  billedQuantity: number;
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
  const basis: PricingBasis = input.basis ?? 'KG';
  const { weightKg, unitPrice, extraFees, amountPaid, currency, exchangeRate } = input;
  const volumeCbm = input.volumeCbm ?? 0;
  const manualFreight = input.manualFreightAmount ?? 0;

  if (basis === 'KG') {
    if (!isNumber(weightKg) || weightKg <= 0) return { ok: false, error: 'Le poids doit être un nombre supérieur à 0 kg.' };
  } else {
    if (!isNumber(volumeCbm) || volumeCbm <= 0) return { ok: false, error: 'Saisissez la longueur, la largeur et la hauteur (en cm, supérieures à 0) pour calculer le volume.' };
    if (!isNumber(weightKg) || weightKg < 0) return { ok: false, error: 'Le poids ne peut pas être négatif.' };
  }
  if (!isPricingCurrency(currency)) return { ok: false, error: `Devise de tarification non prise en charge : ${String(currency)}.` };
  if (!isNumber(exchangeRate) || exchangeRate <= 0) return { ok: false, error: `Taux de change ${currency} invalide. Vérifiez les taux dans les paramètres.` };
  if (!isNumber(unitPrice) || unitPrice < 0) return { ok: false, error: 'Le tarif ne peut pas être négatif.' };
  if (!isNumber(manualFreight) || manualFreight < 0) return { ok: false, error: 'Les frais de transport ne peuvent pas être négatifs.' };
  if (!isNumber(extraFees) || extraFees < 0) return { ok: false, error: 'Les frais annexes ne peuvent pas être négatifs.' };
  if (!isNumber(amountPaid) || amountPaid < 0) return { ok: false, error: 'L’acompte ne peut pas être négatif.' };

  const billedQuantity = basis === 'KG' ? weightKg : roundVolume(volumeCbm);
  const freightAmount = roundMoney(unitPrice > 0 ? billedQuantity * unitPrice : manualFreight);
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
      basis,
      currency,
      exchangeRate,
      unitPrice: unitPrice > 0 ? unitPrice : 0,
      billedQuantity,
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
