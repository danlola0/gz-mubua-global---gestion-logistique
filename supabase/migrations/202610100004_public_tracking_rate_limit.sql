-- Additive database-backed throttling for the unauthenticated parcel tracking route.
-- Does not change parcel records. Deploy this before the matching Edge Function code.

CREATE TABLE IF NOT EXISTS public.public_track_rate_limits (
  request_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
CREATE INDEX IF NOT EXISTS public_track_rate_limits_window_idx
  ON public.public_track_rate_limits (window_started_at);

ALTER TABLE public.public_track_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_track_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_track_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_public_track_rate_limit(
  p_request_key text,
  p_limit integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_count integer;
DECLARE current_window timestamptz := date_trunc('minute', now());
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.public_track_rate_limits
    WHERE window_started_at < now() - interval '1 day';
  END IF;

  INSERT INTO public.public_track_rate_limits AS limits (request_key, window_started_at, request_count)
  VALUES (md5(COALESCE(p_request_key, 'unknown')), current_window, 1)
  ON CONFLICT (request_key)
  DO UPDATE SET
    request_count = CASE
      WHEN limits.window_started_at < current_window THEN 1
      ELSE limits.request_count + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at < current_window THEN current_window
      ELSE limits.window_started_at
    END
  RETURNING request_count INTO current_count;

  RETURN current_count <= GREATEST(1, LEAST(COALESCE(p_limit, 30), 120));
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_track_rate_limit(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_track_rate_limit(text, integer) TO service_role;
