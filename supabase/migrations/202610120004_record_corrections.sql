-- Additive migration: transactional corrections of financial records.
-- Each function locks the row, applies the (already validated) patch built by
-- the Edge API, recalculates the dependent balances and writes the audit row
-- (old and new values) in the same transaction. No existing row is deleted.

-- Payment correction: recalculates the parcel and the client balances.
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

-- Expense correction. Salary expenses are corrected through their pay slip.
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
    date = merged.date, country = merged.country
  WHERE id = target_id RETURNING * INTO after;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(after);
END;
$$;
REVOKE ALL ON FUNCTION public.update_expense_transaction(varchar, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense_transaction(varchar, jsonb, jsonb) TO service_role;

-- Pay slip correction: keeps the linked salary expense ("[Bulletin <slip>]") in sync.
CREATE OR REPLACE FUNCTION public.update_salary_transaction(target_id varchar, patch jsonb, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before public.salary_payments%ROWTYPE;
  merged public.salary_payments%ROWTYPE;
  after public.salary_payments%ROWTYPE;
BEGIN
  SELECT * INTO before FROM public.salary_payments WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bulletin de paie non trouvé'; END IF;
  merged := jsonb_populate_record(before, patch);
  IF COALESCE(merged.net_salary_usd, 0) < 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  UPDATE public.salary_payments SET
    base_salary_usd = merged.base_salary_usd, primes_usd = merged.primes_usd,
    avances_usd = merged.avances_usd, retenues_usd = merged.retenues_usd,
    overtime_usd = merged.overtime_usd, net_salary_usd = merged.net_salary_usd,
    paid_amount_original = merged.paid_amount_original, currency = merged.currency,
    exchange_rate = merged.exchange_rate, payment_date = merged.payment_date,
    payment_method = merged.payment_method, notes = merged.notes
  WHERE id = target_id RETURNING * INTO after;

  IF after.status = 'PAYE' THEN
    UPDATE public.expenses SET
      original_amount = after.paid_amount_original, currency = after.currency,
      exchange_rate = after.exchange_rate, amount_usd = after.net_salary_usd,
      date = after.payment_date
    WHERE category = 'salaire' AND description LIKE '%[Bulletin ' || after.slip_number || ']%';
  END IF;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(after);
END;
$$;
REVOKE ALL ON FUNCTION public.update_salary_transaction(varchar, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_salary_transaction(varchar, jsonb, jsonb) TO service_role;
