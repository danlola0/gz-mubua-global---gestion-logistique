-- Additive migration: admin-confirmed deletion of a parcel together with its
-- payment receipts, in one transaction. The default delete_parcel_transaction
-- keeps refusing parcels that have payments; this function is only called by
-- the Edge API when the admin explicitly ticks "delete the receipts too".
-- The audit row (built by the API) keeps a snapshot of the deleted receipts.

CREATE OR REPLACE FUNCTION public.delete_parcel_with_payments_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed public.parcels%ROWTYPE;
  removed_payments jsonb;
  affected_client varchar;
BEGIN
  SELECT * INTO removed FROM public.parcels WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colis non trouvé'; END IF;

  WITH deleted AS (
    DELETE FROM public.payments WHERE parcel_id = target_id RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(deleted)), '[]'::jsonb) INTO removed_payments FROM deleted;

  DELETE FROM public.parcels WHERE id = target_id;

  -- Refresh every client touched by the parcel or its receipts.
  FOR affected_client IN
    SELECT DISTINCT c_id FROM (
      SELECT removed.client_id AS c_id
      UNION
      SELECT value->>'client_id' FROM jsonb_array_elements(removed_payments)
    ) ids WHERE c_id IS NOT NULL
  LOOP
    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount - totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id = affected_client) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd), 0) FROM public.parcels WHERE client_id = affected_client) AS amount,
               (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE client_id = affected_client) AS paid
      ) totals
      WHERE c.id = affected_client;
  END LOOP;

  IF removed.shipment_id IS NOT NULL THEN
    UPDATE public.shipments s
      SET parcel_ids = COALESCE((SELECT jsonb_agg(p.id) FROM public.parcels p WHERE p.shipment_id = s.id), '[]'::jsonb),
          parcel_count = (SELECT COUNT(*) FROM public.parcels p WHERE p.shipment_id = s.id),
          total_weight_kg = COALESCE((SELECT SUM(p.weight_kg) FROM public.parcels p WHERE p.shipment_id = s.id), 0),
          total_volume_cbm = COALESCE((SELECT SUM(p.volume_cbm) FROM public.parcels p WHERE p.shipment_id = s.id), 0),
          updated_at = CURRENT_DATE
    WHERE s.id = removed.shipment_id;
  END IF;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN jsonb_build_object('parcel', to_jsonb(removed), 'payments', removed_payments);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_parcel_with_payments_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_parcel_with_payments_transaction(varchar, jsonb) TO service_role;
