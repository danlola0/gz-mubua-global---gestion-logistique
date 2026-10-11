-- SECURITY CUTOVER: apply ONLY after deploying/testing supabase/functions/api,
-- pointing the frontend at that Edge Function, and verifying all business flows.
-- The Edge API uses Supabase's server-side service_role; the browser must only
-- use Auth + get_my_app_profile(). Applying this before the cutover breaks the
-- current Node/Cloud Run API because it uses the anon key for database queries.
-- This migration changes grants/policies only; it does not change or delete rows.

DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'Public read-write %'
      AND tablename IN (
        'exchange_rates', 'agencies', 'users', 'clients', 'shipments', 'parcels',
        'payments', 'expenses', 'employees', 'salary_payments', 'audit_logs',
        'notifications', 'app_counters'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.exchange_rates, public.agencies, public.users, public.clients,
  public.shipments, public.parcels, public.payments, public.expenses,
  public.employees, public.salary_payments, public.audit_logs,
  public.notifications, public.app_counters
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE
  public.exchange_rates, public.agencies, public.users, public.clients,
  public.shipments, public.parcels, public.payments, public.expenses,
  public.employees, public.salary_payments, public.audit_logs,
  public.notifications, public.app_counters
TO service_role;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- The only direct browser database operation is the narrowly scoped profile RPC.
REVOKE ALL ON FUNCTION public.get_my_app_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_app_profile() TO authenticated;
