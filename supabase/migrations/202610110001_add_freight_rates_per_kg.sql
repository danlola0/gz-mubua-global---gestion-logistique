-- Additive migration: add per-kilogram freight rates configurable by admin.
-- New columns only; no existing rows are rewritten or deleted.

ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS maritime_price_per_kg NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerien_price_per_kg NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_rate_currency VARCHAR(10) DEFAULT 'USD';

COMMENT ON COLUMN public.exchange_rates.maritime_price_per_kg IS 'Prix du fret maritime par kilogramme (admin-configurable).';
COMMENT ON COLUMN public.exchange_rates.aerien_price_per_kg IS 'Prix du fret aérien par kilogramme (admin-configurable).';
COMMENT ON COLUMN public.exchange_rates.freight_rate_currency IS 'Devise utilisée pour les tarifs au kg (USD, CNY, CDF, AOA).';
