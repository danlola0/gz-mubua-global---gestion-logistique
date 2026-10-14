-- Additive migration: admin-confirmed deletion of a client file together with
-- its parcels and payments, in one transaction. The default DELETE keeps refusing
-- clients that have parcels or payments; this function is only called by the
-- Edge API when the admin explicitly ticks "delete its parcels and payments too".
-- The audit row (built by the API) keeps a full snapshot of what is deleted.

CREATE OR REPLACE FUNCTION public.delete_client_cascade_transaction(target_id varchar, audit_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed public.clients%ROWTYPE;
  removed_parcels jsonb;
  removed_payments jsonb;
  touched_shipments varchar[];
  sid varchar;
BEGIN
  SELECT * INTO removed FROM public.clients WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client non trouvé'; END IF;

  -- Payments of the client, and payments attached to its parcels.
  WITH deleted AS (
    DELETE FROM public.payments
    WHERE client_id = target_id
       OR parcel_id IN (SELECT id FROM public.parcels WHERE client_id = target_id)
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(deleted)), '[]'::jsonb) INTO removed_payments FROM deleted;

  SELECT COALESCE(array_agg(DISTINCT shipment_id), '{}') INTO touched_shipments
  FROM public.parcels WHERE client_id = target_id AND shipment_id IS NOT NULL;

  WITH deleted AS (
    DELETE FROM public.parcels WHERE client_id = target_id RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(deleted)), '[]'::jsonb) INTO removed_parcels FROM deleted;

  -- Shipments that contained these parcels: refresh their totals.
  FOREACH sid IN ARRAY touched_shipments LOOP
    UPDATE public.shipments s
      SET parcel_ids = COALESCE((SELECT jsonb_agg(p.id) FROM public.parcels p WHERE p.shipment_id = s.id), '[]'::jsonb),
          parcel_count = (SELECT COUNT(*) FROM public.parcels p WHERE p.shipment_id = s.id),
          total_weight_kg = COALESCE((SELECT SUM(p.weight_kg) FROM public.parcels p WHERE p.shipment_id = s.id), 0),
          total_volume_cbm = COALESCE((SELECT SUM(p.volume_cbm) FROM public.parcels p WHERE p.shipment_id = s.id), 0),
          updated_at = CURRENT_DATE
      WHERE s.id = sid;
  END LOOP;

  -- Parcels where this client was only the sender keep existing (sender cleared by FK),
  -- a linked client account loses its client file (FK ON DELETE SET NULL).
  DELETE FROM public.clients WHERE id = target_id;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN jsonb_build_object('client', to_jsonb(removed), 'parcels', removed_parcels, 'payments', removed_payments);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_client_cascade_transaction(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_client_cascade_transaction(varchar, jsonb) TO service_role;
