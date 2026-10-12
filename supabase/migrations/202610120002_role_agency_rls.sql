-- Role- and agency-scoped READ access enforced by Postgres Row Level Security.
-- Requires 202610120001_client_accounts.sql (users.client_id, parcels.sender_client_id).
-- Additive: creates helper functions, SELECT grants and SELECT policies only.
-- Writes stay closed to anon/authenticated: they go through the Edge API
-- (service_role + transactional RPCs), which re-checks role and agency.
--
--   admin          : everything
--   china_team     : parcels of its China agency, shipments departing from it
--   kinshasa_team  : parcels/shipments destined to its agency
--   cashier        : payments/expenses of its agency, parcels of its agency (to collect)
--   client         : its own client file, parcels (recipient or sender) and payments
--   (staff)        : shared client directory, agencies, exchange rates

-- 1. Who is calling? (SECURITY DEFINER: reads public.users without recursion through RLS)
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.role::text FROM public.users u
  WHERE auth.uid() IS NOT NULL AND u.auth_user_id = auth.uid() AND u.status = 'active' LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.app_agency_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.agency_id::text FROM public.users u
  WHERE auth.uid() IS NOT NULL AND u.auth_user_id = auth.uid() AND u.status = 'active' LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.app_client_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.client_id::text FROM public.users u
  WHERE auth.uid() IS NOT NULL AND u.auth_user_id = auth.uid() AND u.status = 'active' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.app_role(), public.app_agency_id(), public.app_client_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role(), public.app_agency_id(), public.app_client_id() TO authenticated, service_role;

-- 2. Read grants for signed-in users; rows are then filtered by the policies below.
GRANT SELECT ON TABLE
  public.agencies, public.users, public.clients, public.parcels, public.shipments,
  public.payments, public.expenses, public.employees, public.salary_payments,
  public.audit_logs, public.notifications, public.exchange_rates
TO authenticated;

-- 3. Policies (idempotent).
DROP POLICY IF EXISTS scoped_read_exchange_rates ON public.exchange_rates;
CREATE POLICY scoped_read_exchange_rates ON public.exchange_rates FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) IS NOT NULL);

DROP POLICY IF EXISTS scoped_read_agencies ON public.agencies;
CREATE POLICY scoped_read_agencies ON public.agencies FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) IS NOT NULL);

DROP POLICY IF EXISTS scoped_read_users ON public.users;
CREATE POLICY scoped_read_users ON public.users FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
    OR (auth_user_id = auth.uid() AND (SELECT public.app_role()) IS NOT NULL)  -- own row, active accounts only
  );

DROP POLICY IF EXISTS scoped_read_clients ON public.clients;
CREATE POLICY scoped_read_clients ON public.clients FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) IN ('admin', 'china_team', 'kinshasa_team', 'cashier')
    OR ((SELECT public.app_role()) = 'client' AND id = (SELECT public.app_client_id()))
  );

DROP POLICY IF EXISTS scoped_read_parcels ON public.parcels;
CREATE POLICY scoped_read_parcels ON public.parcels FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
    OR ((SELECT public.app_role()) = 'china_team' AND china_agency_id = (SELECT public.app_agency_id()))
    OR ((SELECT public.app_role()) = 'kinshasa_team' AND destination_agency_id = (SELECT public.app_agency_id()))
    OR ((SELECT public.app_role()) = 'cashier' AND (SELECT public.app_agency_id()) IN (china_agency_id, destination_agency_id))
    OR ((SELECT public.app_role()) = 'client' AND (SELECT public.app_client_id()) IN (client_id, sender_client_id))
  );

DROP POLICY IF EXISTS scoped_read_shipments ON public.shipments;
CREATE POLICY scoped_read_shipments ON public.shipments FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
    OR ((SELECT public.app_role()) = 'china_team' AND departure_agency_id = (SELECT public.app_agency_id()))
    OR ((SELECT public.app_role()) = 'kinshasa_team' AND destination_agency_id = (SELECT public.app_agency_id()))
  );

DROP POLICY IF EXISTS scoped_read_payments ON public.payments;
CREATE POLICY scoped_read_payments ON public.payments FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
    OR ((SELECT public.app_role()) = 'cashier' AND agency_id = (SELECT public.app_agency_id()))
    OR ((SELECT public.app_role()) = 'client' AND client_id = (SELECT public.app_client_id()))
  );

DROP POLICY IF EXISTS scoped_read_expenses ON public.expenses;
CREATE POLICY scoped_read_expenses ON public.expenses FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
    OR ((SELECT public.app_role()) = 'cashier' AND agency_id = (SELECT public.app_agency_id()))
  );

DROP POLICY IF EXISTS scoped_read_employees ON public.employees;
CREATE POLICY scoped_read_employees ON public.employees FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) = 'admin');

DROP POLICY IF EXISTS scoped_read_salary_payments ON public.salary_payments;
CREATE POLICY scoped_read_salary_payments ON public.salary_payments FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) = 'admin');

DROP POLICY IF EXISTS scoped_read_audit_logs ON public.audit_logs;
CREATE POLICY scoped_read_audit_logs ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT public.app_role()) = 'admin');

DROP POLICY IF EXISTS scoped_read_notifications ON public.notifications;
CREATE POLICY scoped_read_notifications ON public.notifications FOR SELECT TO authenticated
  USING (
    (SELECT public.app_role()) = 'admin'
      AND target_role IN ('ALL', 'admin')
    -- Staff: notifications about a parcel only if that parcel is visible to them
    -- (the subquery is itself filtered by the parcels policy, i.e. by agency).
    OR (SELECT public.app_role()) IN ('china_team', 'kinshasa_team', 'cashier')
      AND target_role IN ('ALL', (SELECT public.app_role()))
      AND (parcel_tracking IS NULL OR parcel_tracking IN (SELECT p.tracking_number FROM public.parcels p))
    OR (SELECT public.app_role()) = 'client'
      AND target_role IN ('ALL', 'client')
      AND parcel_tracking IN (SELECT p.tracking_number FROM public.parcels p)
  );
