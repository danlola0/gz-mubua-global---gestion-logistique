-- Additive migration: transit delay (in days) per transport mode and per parcel.
-- - exchange_rates: default delay for air and sea, set by the administrator
--   (NULL = not configured; no value is invented).
-- - parcels: delay chosen when the parcel is registered and the resulting
--   estimated arrival date (reception date + delay).
-- No existing row is rewritten or deleted.

ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS aerien_transit_days integer,
  ADD COLUMN IF NOT EXISTS maritime_transit_days integer;

ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS estimated_transit_days integer,
  ADD COLUMN IF NOT EXISTS estimated_arrival_date date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_transit_days_check') THEN
    ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_transit_days_check
      CHECK ((aerien_transit_days IS NULL OR aerien_transit_days BETWEEN 0 AND 365)
         AND (maritime_transit_days IS NULL OR maritime_transit_days BETWEEN 0 AND 365));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parcels_estimated_transit_days_check') THEN
    ALTER TABLE public.parcels ADD CONSTRAINT parcels_estimated_transit_days_check
      CHECK (estimated_transit_days IS NULL OR estimated_transit_days BETWEEN 0 AND 365);
  END IF;
END $$;
