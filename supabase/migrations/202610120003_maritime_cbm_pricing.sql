-- Additive migration: sea freight priced by volume (CBM), air freight by weight (kg).
-- No existing row is rewritten or deleted. Existing parcels keep their stored amounts.

-- 1. Admin tariff: price per CBM for sea freight (air keeps aerien_price_per_kg).
--    maritime_price_per_kg is kept for history but no longer used for new parcels.
ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS maritime_price_per_cbm NUMERIC(12, 2) DEFAULT 0;
COMMENT ON COLUMN public.exchange_rates.maritime_price_per_cbm IS 'Prix du fret maritime par CBM (m³), dans freight_rate_currency.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_maritime_cbm_check') THEN
    ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_maritime_cbm_check
      CHECK (COALESCE(maritime_price_per_cbm, 0) >= 0) NOT VALID;
  END IF;
END;
$$;

-- 2. Per-parcel snapshot of the pricing basis and the tariff applied at registration.
--    pricing_unit: 'KG' (air) or 'CBM' (sea); NULL = parcel priced before this change.
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS pricing_unit VARCHAR(5),
  ADD COLUMN IF NOT EXISTS price_per_cbm NUMERIC(12, 2);
COMMENT ON COLUMN public.parcels.pricing_unit IS 'Base de calcul figée : KG (aérien) ou CBM (maritime).';
COMMENT ON COLUMN public.parcels.price_per_cbm IS 'Tarif/CBM appliqué à l’enregistrement, dans pricing_currency (figé).';

-- 3. Amount checks: sea parcels are billed by volume, so their weight may be 0,
--    but they must have a volume. Recreated NOT VALID (historic rows not rescanned).
ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_amounts_non_negative_check;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_amounts_non_negative_check
  CHECK (
    weight_kg >= 0
    AND (weight_kg > 0 OR pricing_unit = 'CBM')
    AND (pricing_unit IS DISTINCT FROM 'CBM' OR volume_cbm > 0)
    AND (pricing_unit IS NULL OR pricing_unit IN ('KG', 'CBM'))
    AND COALESCE(price_per_kg, 0) >= 0
    AND COALESCE(price_per_cbm, 0) >= 0
    AND COALESCE(transport_cost_usd, 0) >= 0
    AND COALESCE(extra_fees_usd, 0) >= 0
    AND COALESCE(total_cost_usd, 0) >= 0
    AND COALESCE(amount_paid_usd, 0) >= 0
    AND COALESCE(remaining_amount_usd, 0) >= 0
  ) NOT VALID;
