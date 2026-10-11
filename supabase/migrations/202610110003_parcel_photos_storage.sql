-- Additive migration: Storage bucket for parcel photos uploaded from the app.
-- Uploads go through the Edge API (service_role), which enforces roles; no
-- storage.objects policy is granted to anon/authenticated, so nobody can list
-- or write the bucket directly. Files are readable by their unguessable public URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parcel-photos', 'parcel-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
