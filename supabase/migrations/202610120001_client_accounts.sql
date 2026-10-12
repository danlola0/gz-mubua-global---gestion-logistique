-- Additive migration: client self-service accounts linked to existing client records.
-- No existing row is rewritten or deleted.
--
-- Security model: a client account (public.users, role 'client') is linked to exactly
-- one public.clients row through users.client_id, only by the Edge API after:
--   1. Supabase Auth has verified the e-mail address (email_confirmed_at), and
--   2. either the verified e-mail equals the e-mail recorded by an agent on the client
--      record, or the client entered a one-time activation code issued by an agent,
--   3. and in both cases the phone number entered matches the client record.
-- Matching on name or phone alone never grants access.

-- 1. Account <-> client record link (one account per client record).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS client_id varchar(50) REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_client_id_unique
  ON public.users (client_id) WHERE client_id IS NOT NULL;

-- 2. A client can be the sender of a parcel as well as its recipient (client_id).
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS sender_client_id varchar(50) REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_client_name varchar(150);
CREATE INDEX IF NOT EXISTS idx_parcels_sender_client_id ON public.parcels (sender_client_id);

-- 3. One-time activation codes issued by agents (only a SHA-256 hash is stored).
CREATE TABLE IF NOT EXISTS public.client_activation_codes (
  id varchar(50) PRIMARY KEY,
  client_id varchar(50) NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_auth_user uuid,
  created_by varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_activation_codes_client_idx ON public.client_activation_codes (client_id);
CREATE INDEX IF NOT EXISTS client_activation_codes_hash_idx ON public.client_activation_codes (code_hash);
ALTER TABLE public.client_activation_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_activation_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.client_activation_codes TO service_role;

-- 4. Atomic link: refuses duplicates and consumes the activation code once.
CREATE OR REPLACE FUNCTION public.link_client_account_transaction(
  p_auth_user_id uuid,
  p_email text,
  p_client_id varchar,
  p_code_id varchar,
  p_user_id varchar,
  audit_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.clients%ROWTYPE;
  created public.users%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.clients WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE client_id = p_client_id) THEN
    RAISE EXCEPTION 'CLIENT_ALREADY_LINKED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'AUTH_ALREADY_LINKED';
  END IF;

  IF p_code_id IS NOT NULL THEN
    UPDATE public.client_activation_codes
      SET used_at = now(), used_by_auth_user = p_auth_user_id
      WHERE id = p_code_id AND client_id = p_client_id AND used_at IS NULL AND expires_at > now();
    IF NOT FOUND THEN RAISE EXCEPTION 'CODE_INVALID'; END IF;
  END IF;

  INSERT INTO public.users (id, username, full_name, email, phone, role, agency_id, agency_name, status, created_at, auth_user_id, client_id)
  VALUES (p_user_id, 'client-' || lower(target.code), target.full_name, lower(p_email), target.phone, 'client',
          NULL, NULL, 'active', now(), p_auth_user_id, p_client_id)
  RETURNING * INTO created;

  INSERT INTO public.audit_logs SELECT (jsonb_populate_record(NULL::public.audit_logs, audit_data)).*;
  RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.link_client_account_transaction(uuid, text, varchar, varchar, varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_client_account_transaction(uuid, text, varchar, varchar, varchar, jsonb) TO service_role;

-- 5. Expose client_id in the signed-in profile (return type changes, so recreate).
DROP FUNCTION IF EXISTS public.get_my_app_profile();
CREATE FUNCTION public.get_my_app_profile()
RETURNS TABLE (
  id varchar,
  username varchar,
  full_name varchar,
  email varchar,
  phone varchar,
  role varchar,
  agency_id varchar,
  agency_name varchar,
  status varchar,
  created_at timestamptz,
  client_id varchar
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role,
         u.agency_id, u.agency_name, u.status, u.created_at, u.client_id
  FROM public.users AS u
  WHERE auth.uid() IS NOT NULL
    AND u.auth_user_id = auth.uid()
    AND u.status = 'active'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_app_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_app_profile() TO authenticated;
