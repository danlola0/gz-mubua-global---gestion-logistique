-- Additive migration: associate existing application profiles with existing Supabase Auth users.
-- This does not delete, truncate, rename, or rewrite any business tables or records.
-- Review the email match counts before applying this migration in production.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique
  ON public.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Link only unambiguous exact-email matches. Profiles without one unique Auth user
-- remain untouched and can be linked manually after review.
WITH unique_auth_matches AS (
  SELECT lower(btrim(email)) AS normalized_email, min(id::text)::uuid AS auth_user_id
  FROM auth.users
  WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) = 1
), unique_profile_emails AS (
  SELECT lower(btrim(email)) AS normalized_email
  FROM public.users
  WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) = 1
)
UPDATE public.users AS profile
SET auth_user_id = auth_match.auth_user_id
FROM unique_auth_matches AS auth_match
JOIN unique_profile_emails AS profile_email USING (normalized_email)
WHERE lower(btrim(profile.email)) = auth_match.normalized_email
  AND profile.auth_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_my_app_profile()
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
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role,
         u.agency_id, u.agency_name, u.status, u.created_at
  FROM public.users AS u
  WHERE auth.uid() IS NOT NULL
    AND u.auth_user_id = auth.uid()
    AND u.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_app_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_app_profile() TO authenticated;
