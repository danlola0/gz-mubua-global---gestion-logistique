-- Additive support for the Supabase Edge API cutover.
-- This migration adds counters and atomic business RPCs; it does not delete or
-- rewrite existing operational rows. Apply only after reviewing and backing up.

CREATE TABLE IF NOT EXISTS public.app_counters (
  counter_name text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'parcel', COALESCE(MAX((regexp_match(tracking_number, '^COL-[0-9]{4}-([0-9]+)$'))[1]::bigint), 0)
FROM public.parcels
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'client', COALESCE(MAX((regexp_match(code, '^CLI-([0-9]+)$'))[1]::bigint), 0)
FROM public.clients
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'shipment', COALESCE(MAX((regexp_match(shipment_number, '^EXP-[0-9]{4}-([0-9]+)$'))[1]::bigint), 0)
FROM public.shipments
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'payment', COALESCE(MAX((regexp_match(receipt_number, '^REC-[0-9]{4}-([0-9]+)$'))[1]::bigint), 0)
FROM public.payments
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'expense', COALESCE(MAX((regexp_match(voucher_number, '^DEP-[0-9]{4}-([0-9]+)$'))[1]::bigint), 0)
FROM public.expenses
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'employee', COALESCE(MAX((regexp_match(employee_code, '^EMP-[A-Z]+-([0-9]+)$'))[1]::bigint), 0)
FROM public.employees
ON CONFLICT (counter_name) DO NOTHING;

INSERT INTO public.app_counters (counter_name, last_value)
SELECT 'salary', COALESCE(MAX((regexp_match(slip_number, '^PAY-[0-9]{4}-[0-9]{2}-([0-9]+)$'))[1]::bigint), 0)
FROM public.salary_payments
ON CONFLICT (counter_name) DO NOTHING;

ALTER TABLE public.app_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_counters TO service_role;

CREATE OR REPLACE FUNCTION public.next_app_sequence(p_counter_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE next_value bigint;
BEGIN
  INSERT INTO public.app_counters AS counters (counter_name, last_value)
  VALUES (p_counter_name, 1)
  ON CONFLICT (counter_name)
  DO UPDATE SET last_value = counters.last_value + 1
  RETURNING last_value INTO next_value;
  RETURN next_value;
END;
$$;
REVOKE ALL ON FUNCTION public.next_app_sequence(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_app_sequence(text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_parcel_transaction(
  parcel_data jsonb,
  payment_data jsonb DEFAULT NULL,
  audit_data jsonb DEFAULT NULL,
  notification_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE created public.parcels%ROWTYPE;
BEGIN
  INSERT INTO public.parcels SELECT (jsonb_populate_record(NULL::public.parcels, parcel_data)).* RETURNING * INTO created;

  IF payment_data IS NOT NULL THEN
    INSERT INTO public.payments SELECT (jsonb_populate_record(NULL::public.payments, payment_data)).*;
    UPDATE public.parcels p
      SET amount_paid_usd = totals.paid,
          remaining_amount_usd = GREATEST(0, COALESCE(p.total_cost_usd, 0) - totals.paid)
      FROM (SELECT COALESCE(SUM(amount_usd), 0) AS paid FROM public.payments WHERE parcel_id = created.id) totals
      WHERE p.id = created.id;
  END IF;

  IF created.client_id IS NOT NULL THEN
    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount - totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id = created.client_id) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd), 0) FROM public.parcels WHERE client_id = created.client_id) AS amount,
               (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE client_id = created.client_id) AS paid
      ) totals
      WHERE c.id = created.client_id;
  END IF;

  IF created.shipment_id IS NOT NULL THEN
    UPDATE public.shipments s
      SET parcel_ids = COALESCE((SELECT jsonb_agg(p.id) FROM public.parcels p WHERE p.shipment_id=s.id),'[]'::jsonb),
          parcel_count = (SELECT COUNT(*) FROM public.parcels p WHERE p.shipment_id=s.id),
          total_weight_kg = COALESCE((SELECT SUM(p.weight_kg) FROM public.parcels p WHERE p.shipment_id=s.id),0),
          total_volume_cbm = COALESCE((SELECT SUM(p.volume_cbm) FROM public.parcels p WHERE p.shipment_id=s.id),0),
          updated_at = CURRENT_DATE
    WHERE s.id = created.shipment_id;
  END IF;

  IF audit_data IS NOT NULL THEN
    INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  END IF;
  IF notification_data IS NOT NULL THEN
    INSERT INTO public.notifications SELECT (jsonb_populate_record(NULL::public.notifications, notification_data)).*;
  END IF;

  SELECT * INTO created FROM public.parcels WHERE id = created.id;
  RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.create_parcel_transaction(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_parcel_transaction(jsonb, jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.record_payment_transaction(
  payment_data jsonb,
  audit_data jsonb DEFAULT NULL,
  notification_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE created public.payments%ROWTYPE; target_parcel_id varchar; target_client_id varchar;
BEGIN
  INSERT INTO public.payments SELECT (jsonb_populate_record(NULL::public.payments, payment_data)).* RETURNING * INTO created;
  target_parcel_id := created.parcel_id;
  target_client_id := created.client_id;

  IF target_parcel_id IS NOT NULL THEN
    UPDATE public.parcels p
      SET amount_paid_usd = totals.paid,
          remaining_amount_usd = GREATEST(0, COALESCE(p.total_cost_usd, 0) - totals.paid)
      FROM (SELECT COALESCE(SUM(amount_usd), 0) AS paid FROM public.payments WHERE parcel_id = target_parcel_id) totals
      WHERE p.id = target_parcel_id;
  END IF;

  IF target_client_id IS NOT NULL THEN
    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount - totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id = target_client_id) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd), 0) FROM public.parcels WHERE client_id = target_client_id) AS amount,
               (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE client_id = target_client_id) AS paid
      ) totals
      WHERE c.id = target_client_id;
  END IF;

  IF audit_data IS NOT NULL THEN INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*; END IF;
  IF notification_data IS NOT NULL THEN INSERT INTO public.notifications SELECT (jsonb_populate_record(NULL::public.notifications, notification_data)).*; END IF;
  RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.record_payment_transaction(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_transaction(jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_parcel_status_transaction(
  target_id varchar,
  next_status varchar,
  history_item jsonb,
  patch jsonb,
  audit_data jsonb,
  notification_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE updated public.parcels%ROWTYPE;
BEGIN
  UPDATE public.parcels p
  SET status = next_status,
      status_history = COALESCE(p.status_history, '[]'::jsonb) || jsonb_build_array(history_item),
      updated_at = CURRENT_DATE,
      warehouse_location = COALESCE(patch->>'warehouse_location', p.warehouse_location),
      delivery_driver_name = COALESCE(patch->>'delivery_driver_name', p.delivery_driver_name),
      delivery_driver_phone = COALESCE(patch->>'delivery_driver_phone', p.delivery_driver_phone),
      delivery_recipient = COALESCE(patch->>'delivery_recipient', p.delivery_recipient),
      delivery_date = CASE WHEN patch ? 'delivery_recipient' THEN CURRENT_DATE ELSE p.delivery_date END
  WHERE p.id = target_id
  RETURNING p.* INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colis non trouvé'; END IF;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  IF notification_data IS NOT NULL THEN
    INSERT INTO public.notifications SELECT (jsonb_populate_record(NULL::public.notifications, notification_data)).*;
  END IF;
  RETURN to_jsonb(updated);
END;
$$;
REVOKE ALL ON FUNCTION public.update_parcel_status_transaction(varchar, varchar, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_parcel_status_transaction(varchar, varchar, jsonb, jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.transition_shipment_transaction(
  target_id varchar,
  transition text,
  event_date date,
  actor_name text,
  actor_agency text,
  audit_data jsonb,
  notification_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE shipment public.shipments%ROWTYPE; parcel_status text; comment_text text;
BEGIN
  IF transition = 'depart' THEN
    UPDATE public.shipments SET status = 'EXPEDIE', departure_date = event_date, updated_at = event_date
      WHERE id = target_id RETURNING * INTO shipment;
    IF NOT FOUND THEN RAISE EXCEPTION 'Expédition non trouvée'; END IF;
    parcel_status := 'EXPEDIE';
    comment_text := 'Départ de l’expédition ' || shipment.shipment_number;
  ELSIF transition = 'arrive' THEN
    UPDATE public.shipments SET status = 'ARRIVE', actual_arrival_date = event_date, updated_at = event_date
      WHERE id = target_id RETURNING * INTO shipment;
    IF NOT FOUND THEN RAISE EXCEPTION 'Expédition non trouvée'; END IF;
    parcel_status := 'ARRIVE_DESTINATION';
    comment_text := 'Arrivée confirmée à destination (' || shipment.destination || ').';
  ELSE
    RAISE EXCEPTION 'Transition expédition invalide';
  END IF;

  UPDATE public.parcels p
  SET status = parcel_status,
      updated_at = event_date,
      status_history = COALESCE(p.status_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('id', 'SH-' || gen_random_uuid()::text, 'status', parcel_status,
          'date', event_date, 'time', to_char(CURRENT_TIME, 'HH24:MI'), 'user', actor_name,
          'agency', COALESCE(actor_agency, shipment.destination_agency_name), 'comment', comment_text)
      )
  WHERE p.shipment_id = shipment.id;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  IF notification_data IS NOT NULL THEN
    INSERT INTO public.notifications SELECT (jsonb_populate_record(NULL::public.notifications, notification_data)).*;
  END IF;
  RETURN to_jsonb(shipment);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_shipment_transaction(varchar, text, date, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_shipment_transaction(varchar, text, date, text, text, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.link_parcels_to_shipment_transaction(
  target_shipment_id varchar,
  target_parcel_ids varchar[],
  actor_name text,
  audit_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE shipment public.shipments%ROWTYPE;
BEGIN
  SELECT * INTO shipment FROM public.shipments WHERE id = target_shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expédition non trouvée'; END IF;

  UPDATE public.parcels p
  SET shipment_id = shipment.id,
      shipment_number = shipment.shipment_number,
      status = CASE WHEN p.status IN ('COMMANDE_CREEE','ATTENTE_RECEPTION_CHINE','RECU_CHINE','IDENTIFIE','CONTROLE','PREPARE_EXPEDITION') THEN 'EXPEDITION_EN_PREPARATION' ELSE p.status END,
      status_history = CASE WHEN p.status IN ('COMMANDE_CREEE','ATTENTE_RECEPTION_CHINE','RECU_CHINE','IDENTIFIE','CONTROLE','PREPARE_EXPEDITION')
        THEN COALESCE(p.status_history,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','SH-'||gen_random_uuid()::text,'status','EXPEDITION_EN_PREPARATION','date',CURRENT_DATE,'time',to_char(CURRENT_TIME,'HH24:MI'),'user',actor_name,'agency',shipment.departure_agency_name,'comment','Ajouté à l’expédition '||shipment.shipment_number))
        ELSE p.status_history END
  WHERE p.id = ANY(target_parcel_ids);

  UPDATE public.shipments s
  SET parcel_ids = COALESCE((SELECT jsonb_agg(p.id) FROM public.parcels p WHERE p.shipment_id=s.id),'[]'::jsonb),
      parcel_count = (SELECT COUNT(*) FROM public.parcels p WHERE p.shipment_id=s.id),
      total_weight_kg = COALESCE((SELECT SUM(p.weight_kg) FROM public.parcels p WHERE p.shipment_id=s.id),0),
      total_volume_cbm = COALESCE((SELECT SUM(p.volume_cbm) FROM public.parcels p WHERE p.shipment_id=s.id),0),
      updated_at = CURRENT_DATE
  WHERE s.id=shipment.id RETURNING * INTO shipment;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(shipment);
END;
$$;
REVOKE ALL ON FUNCTION public.link_parcels_to_shipment_transaction(varchar, varchar[], text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_parcels_to_shipment_transaction(varchar, varchar[], text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_salary_transaction(
  salary_data jsonb,
  expense_data jsonb DEFAULT NULL,
  audit_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE created public.salary_payments%ROWTYPE;
BEGIN
  INSERT INTO public.salary_payments SELECT (jsonb_populate_record(NULL::public.salary_payments, salary_data)).* RETURNING * INTO created;
  IF expense_data IS NOT NULL THEN
    INSERT INTO public.expenses SELECT (jsonb_populate_record(NULL::public.expenses, expense_data)).*;
  END IF;
  IF audit_data IS NOT NULL THEN
    INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  END IF;
  RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.create_salary_transaction(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_salary_transaction(jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_expense_transaction(expense_data jsonb, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE created public.expenses%ROWTYPE;
BEGIN
  INSERT INTO public.expenses SELECT (jsonb_populate_record(NULL::public.expenses, expense_data)).* RETURNING * INTO created;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.create_expense_transaction(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_transaction(jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_salary_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed public.salary_payments%ROWTYPE;
BEGIN
  DELETE FROM public.salary_payments WHERE id=target_id RETURNING * INTO removed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bulletin de paie non trouvé'; END IF;
  IF removed.status = 'PAYE' THEN
    DELETE FROM public.expenses
    WHERE category='salaire' AND description LIKE '%[Bulletin ' || removed.slip_number || ']%';
  END IF;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs,audit_data)).*;
  RETURN to_jsonb(removed);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_salary_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_salary_transaction(varchar, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_expense_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed public.expenses%ROWTYPE;
BEGIN
  DELETE FROM public.expenses WHERE id=target_id RETURNING * INTO removed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dépense non trouvée'; END IF;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs,audit_data)).*;
  RETURN to_jsonb(removed);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_expense_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expense_transaction(varchar, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_payment_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed public.payments%ROWTYPE; linked_client_id varchar;
BEGIN
  DELETE FROM public.payments WHERE id = target_id RETURNING * INTO removed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non trouvé'; END IF;
  IF removed.parcel_id IS NOT NULL THEN
    SELECT client_id INTO linked_client_id FROM public.parcels WHERE id=removed.parcel_id;
    UPDATE public.parcels p
      SET amount_paid_usd = totals.paid,
          remaining_amount_usd = GREATEST(0, COALESCE(p.total_cost_usd,0) - totals.paid)
      FROM (SELECT COALESCE(SUM(amount_usd),0) AS paid FROM public.payments WHERE parcel_id=removed.parcel_id) totals
      WHERE p.id=removed.parcel_id;
  END IF;
  linked_client_id := COALESCE(removed.client_id, linked_client_id);
  IF linked_client_id IS NOT NULL THEN
    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount-totals.paid)
      FROM (
         SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id=linked_client_id) AS parcel_count,
           (SELECT COALESCE(SUM(total_cost_usd),0) FROM public.parcels WHERE client_id=linked_client_id) AS amount,
           (SELECT COALESCE(SUM(amount_usd),0) FROM public.payments WHERE client_id=linked_client_id) AS paid
            ) totals WHERE c.id=linked_client_id;
  END IF;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs,audit_data)).*;
  RETURN to_jsonb(removed);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_payment_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payment_transaction(varchar, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_shipment_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed public.shipments%ROWTYPE;
BEGIN
  SELECT * INTO removed FROM public.shipments WHERE id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expédition non trouvée'; END IF;
  UPDATE public.parcels SET shipment_id=NULL, shipment_number=NULL WHERE shipment_id=target_id;
  DELETE FROM public.shipments WHERE id=target_id;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs,audit_data)).*;
  RETURN to_jsonb(removed);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_shipment_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shipment_transaction(varchar, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_parcel_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed public.parcels%ROWTYPE;
BEGIN
  SELECT * INTO removed FROM public.parcels WHERE id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colis non trouvé'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE parcel_id=target_id) THEN
    RAISE EXCEPTION 'Suppression impossible : ce colis possède des paiements enregistrés';
  END IF;
  DELETE FROM public.parcels WHERE id=target_id;
  IF removed.client_id IS NOT NULL THEN
    UPDATE public.clients c
      SET total_parcels=totals.parcel_count, total_amount_usd=totals.amount,
          total_paid_usd=totals.paid, remaining_balance_usd=GREATEST(0,totals.amount-totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id=removed.client_id) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd),0) FROM public.parcels WHERE client_id=removed.client_id) AS amount,
               (SELECT COALESCE(SUM(amount_usd),0) FROM public.payments WHERE client_id=removed.client_id) AS paid
      ) totals WHERE c.id=removed.client_id;
  END IF;
  IF removed.shipment_id IS NOT NULL THEN
    UPDATE public.shipments s
      SET parcel_ids = COALESCE((SELECT jsonb_agg(p.id) FROM public.parcels p WHERE p.shipment_id=s.id),'[]'::jsonb),
          parcel_count = (SELECT COUNT(*) FROM public.parcels p WHERE p.shipment_id=s.id),
          total_weight_kg = COALESCE((SELECT SUM(p.weight_kg) FROM public.parcels p WHERE p.shipment_id=s.id),0),
          total_volume_cbm = COALESCE((SELECT SUM(p.volume_cbm) FROM public.parcels p WHERE p.shipment_id=s.id),0),
          updated_at = CURRENT_DATE
    WHERE s.id = removed.shipment_id;
  END IF;
  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs,audit_data)).*;
  RETURN to_jsonb(removed);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_parcel_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_parcel_transaction(varchar, jsonb) TO service_role;
