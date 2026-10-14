-- Additive migration: payment methods per country (cash boxes by agency country)
-- and the payment method of expenses. No existing row is rewritten or deleted.

-- 1. Configurable payment methods. The list below is the configuration requested
--    by the business (not sample data); the admin can add/rename/disable methods,
--    e.g. the mobile money services used in Angola.
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id varchar(50) PRIMARY KEY,
  country varchar(20) NOT NULL CHECK (country IN ('Chine', 'RDC', 'Angola')),
  code varchar(40) NOT NULL,
  label varchar(80) NOT NULL,
  kind varchar(10) NOT NULL CHECK (kind IN ('cash', 'bank', 'mobile')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, code)
);

INSERT INTO public.payment_methods (id, country, code, label, kind, sort_order) VALUES
  ('PM-CN-ESPECES', 'Chine', 'ESPECES', 'Espèces', 'cash', 1),
  ('PM-CN-BANQUE', 'Chine', 'BANQUE', 'Banque', 'bank', 2),
  ('PM-CN-ALIPAY', 'Chine', 'ALIPAY', 'Alipay', 'mobile', 3),
  ('PM-CD-ESPECES', 'RDC', 'ESPECES', 'Espèces', 'cash', 1),
  ('PM-CD-BANQUE', 'RDC', 'BANQUE', 'Banque', 'bank', 2),
  ('PM-CD-MPESA', 'RDC', 'MPESA', 'M-Pesa', 'mobile', 3),
  ('PM-CD-ORANGE', 'RDC', 'ORANGE_MONEY', 'Orange Money', 'mobile', 4),
  ('PM-CD-AIRTEL', 'RDC', 'AIRTEL_MONEY', 'Airtel Money', 'mobile', 5),
  ('PM-CD-AFRIMONEY', 'RDC', 'AFRIMONEY', 'Afrimoney', 'mobile', 6),
  ('PM-AO-ESPECES', 'Angola', 'ESPECES', 'Espèces', 'cash', 1),
  ('PM-AO-BANQUE', 'Angola', 'BANQUE', 'Banque', 'bank', 2)
ON CONFLICT (country, code) DO NOTHING;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_methods FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_methods TO service_role;
GRANT SELECT ON public.payment_methods TO authenticated;
DROP POLICY IF EXISTS scoped_read_payment_methods ON public.payment_methods;
CREATE POLICY scoped_read_payment_methods ON public.payment_methods FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) IS NOT NULL);

-- 2. Expenses record the payment method they were paid with (NULL = recorded before).
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method varchar(40);

-- 3. Expense corrections may change the payment method too.
CREATE OR REPLACE FUNCTION public.update_expense_transaction(target_id varchar, patch jsonb, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before public.expenses%ROWTYPE;
  merged public.expenses%ROWTYPE;
  after public.expenses%ROWTYPE;
BEGIN
  SELECT * INTO before FROM public.expenses WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dépense non trouvée'; END IF;
  IF before.category = 'salaire' THEN RAISE EXCEPTION 'SALARY_EXPENSE'; END IF;
  merged := jsonb_populate_record(before, patch);
  IF COALESCE(merged.amount_usd, 0) <= 0 OR COALESCE(merged.original_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF merged.category = 'salaire' THEN RAISE EXCEPTION 'SALARY_EXPENSE'; END IF;

  UPDATE public.expenses SET
    category = merged.category, category_label = merged.category_label,
    original_amount = merged.original_amount, currency = merged.currency,
    exchange_rate = merged.exchange_rate, amount_usd = merged.amount_usd,
    beneficiary = merged.beneficiary, description = merged.description,
    date = merged.date, country = merged.country, payment_method = merged.payment_method
  WHERE id = target_id RETURNING * INTO after;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(after);
END;
$$;
REVOKE ALL ON FUNCTION public.update_expense_transaction(varchar, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense_transaction(varchar, jsonb, jsonb) TO service_role;

-- 4. Receipt corrections may move a receipt to another cash box (agency), admin only (checked by the API).
CREATE OR REPLACE FUNCTION public.update_payment_transaction(target_id varchar, patch jsonb, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before public.payments%ROWTYPE;
  merged public.payments%ROWTYPE;
  after public.payments%ROWTYPE;
  linked_client varchar;
BEGIN
  SELECT * INTO before FROM public.payments WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non trouvé'; END IF;
  merged := jsonb_populate_record(before, patch);
  IF COALESCE(merged.amount_usd, 0) <= 0 OR COALESCE(merged.original_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  UPDATE public.payments SET
    original_amount = merged.original_amount, currency = merged.currency,
    exchange_rate = merged.exchange_rate, amount_usd = merged.amount_usd,
    agency_id = merged.agency_id, agency_name = merged.agency_name,
    payment_method = merged.payment_method, reference = merged.reference,
    notes = merged.notes, date = merged.date, type = merged.type
  WHERE id = target_id RETURNING * INTO after;

  IF after.parcel_id IS NOT NULL THEN
    UPDATE public.parcels p
      SET amount_paid_usd = totals.paid,
          remaining_amount_usd = GREATEST(0, COALESCE(p.total_cost_usd, 0) - totals.paid)
      FROM (SELECT COALESCE(SUM(amount_usd), 0) AS paid FROM public.payments WHERE parcel_id = after.parcel_id) totals
      WHERE p.id = after.parcel_id;
    SELECT client_id INTO linked_client FROM public.parcels WHERE id = after.parcel_id;
  END IF;
  linked_client := COALESCE(after.client_id, linked_client);
  IF linked_client IS NOT NULL THEN
    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount - totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id = linked_client) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd), 0) FROM public.parcels WHERE client_id = linked_client) AS amount,
               (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE client_id = linked_client) AS paid
      ) totals
      WHERE c.id = linked_client;
  END IF;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(after);
END;
$$;
REVOKE ALL ON FUNCTION public.update_payment_transaction(varchar, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_transaction(varchar, jsonb, jsonb) TO service_role;

