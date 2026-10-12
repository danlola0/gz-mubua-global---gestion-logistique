-- Data backfill: parcels saved before clients were auto-created ("+ Nouveau client")
-- have client_id NULL. Link each to the client with the same phone (digits only),
-- creating the client when none exists, then refresh balances. Idempotent: only
-- parcels/payments with a NULL client_id are touched.

DO $$
DECLARE
  r record;
  target_client varchar;
  seq bigint;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (digits) digits, client_name, client_phone, destination
    FROM (
      SELECT regexp_replace(COALESCE(client_phone, ''), '\D', '', 'g') AS digits,
             client_name, client_phone, destination, created_at
      FROM public.parcels
      WHERE client_id IS NULL
    ) p
    WHERE digits <> ''
    ORDER BY digits, created_at
  LOOP
    target_client := NULL;
    SELECT id INTO target_client FROM public.clients
    WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = r.digits
    LIMIT 1;

    IF target_client IS NULL THEN
      seq := public.next_app_sequence('client');
      target_client := 'CLI-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 8);
      INSERT INTO public.clients (id, code, full_name, phone, email, address, city, country,
                                  total_parcels, total_amount_usd, total_paid_usd, remaining_balance_usd, notes, created_at)
      VALUES (target_client, 'CLI-' || lpad(seq::text, 3, '0'), r.client_name, r.client_phone, '', '',
              CASE WHEN r.destination = 'Angola' THEN 'Luanda' ELSE 'Kinshasa' END,
              CASE WHEN r.destination = 'Angola' THEN 'Angola' ELSE 'RDC' END,
              0, 0, 0, 0, 'Créé automatiquement (rattachement des colis existants)', now());
      INSERT INTO public.audit_logs (id, timestamp, user_id, user_name, user_role, agency_name, action, entity_type, entity_id, details)
      VALUES ('LOG-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 8),
              now(), NULL, 'Système (migration)', 'admin', NULL, 'CREATE', 'CLIENT', target_client,
              'Création du client ' || r.client_name || ' (rattachement des colis existants)');
    END IF;

    UPDATE public.parcels SET client_id = target_client
    WHERE client_id IS NULL AND regexp_replace(COALESCE(client_phone, ''), '\D', '', 'g') = r.digits;

    UPDATE public.payments y SET client_id = target_client
    FROM public.parcels p
    WHERE y.parcel_id = p.id AND p.client_id = target_client AND y.client_id IS NULL;

    UPDATE public.clients c
      SET total_parcels = totals.parcel_count,
          total_amount_usd = totals.amount,
          total_paid_usd = totals.paid,
          remaining_balance_usd = GREATEST(0, totals.amount - totals.paid)
      FROM (
        SELECT (SELECT COUNT(*) FROM public.parcels WHERE client_id = target_client) AS parcel_count,
               (SELECT COALESCE(SUM(total_cost_usd), 0) FROM public.parcels WHERE client_id = target_client) AS amount,
               (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE client_id = target_client) AS paid
      ) totals
      WHERE c.id = target_client;
  END LOOP;
END;
$$;
