-- Additive migration: universal per-kg freight tariff + per-parcel pricing snapshot.
-- New columns and NOT VALID checks only; no existing rows are rewritten or deleted.
-- Apply BEFORE deploying the matching Edge Function (supabase/functions/api).

-- Universal tariff (repeats 202610110001 idempotently in case it was not applied).
ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS maritime_price_per_kg NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerien_price_per_kg NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_rate_currency VARCHAR(10) DEFAULT 'USD';

-- Snapshot of the tariff applied when the parcel was registered. Later tariff
-- changes never rewrite these values.
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pricing_exchange_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS freight_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14, 2);

COMMENT ON COLUMN public.parcels.price_per_kg IS 'Tarif/kg appliqué à l’enregistrement, dans pricing_currency (figé).';
COMMENT ON COLUMN public.parcels.pricing_exchange_rate IS 'Unités de pricing_currency pour 1 USD au moment de l’enregistrement.';
COMMENT ON COLUMN public.parcels.freight_amount IS 'Fret = poids × price_per_kg, dans pricing_currency.';
COMMENT ON COLUMN public.parcels.total_amount IS 'Montant total (fret + frais annexes), dans pricing_currency.';

-- NOT VALID: enforced for new/updated rows without scanning historical rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_freight_rates_check') THEN
    ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_freight_rates_check
      CHECK (COALESCE(maritime_price_per_kg, 0) >= 0
         AND COALESCE(aerien_price_per_kg, 0) >= 0
         AND COALESCE(freight_rate_currency, 'USD') IN ('USD', 'CNY', 'CDF', 'AOA')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parcels_amounts_non_negative_check') THEN
    ALTER TABLE public.parcels ADD CONSTRAINT parcels_amounts_non_negative_check
      CHECK (weight_kg > 0
         AND COALESCE(price_per_kg, 0) >= 0
         AND COALESCE(transport_cost_usd, 0) >= 0
         AND COALESCE(extra_fees_usd, 0) >= 0
         AND COALESCE(total_cost_usd, 0) >= 0
         AND COALESCE(amount_paid_usd, 0) >= 0
         AND COALESCE(remaining_amount_usd, 0) >= 0) NOT VALID;
  END IF;
END;
$$;
