-- =====================================================================
-- Storage bucket for admin-uploaded media (hero images + promo banners)
--
-- Run this in the Supabase SQL Editor AFTER admin-panel.sql
-- (it depends on public.is_app_admin()).
--
-- Creates a PUBLIC bucket `app_media` so the mobile app can load images
-- by URL, but restricts WRITE (insert/update/delete) to admins only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_media', 'app_media', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ---------------------------------------------------------------------
-- Read: anyone can fetch a file by URL (public bucket).
-- We intentionally do NOT add a broad SELECT/list policy — public URL
-- access does not require one, which keeps the bucket from being
-- listable (avoids the public_bucket_allows_listing linter warning).
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- Write: admins only. Scoped to this bucket.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins upload app_media" ON storage.objects;
CREATE POLICY "Admins upload app_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app_media' AND public.is_app_admin());

DROP POLICY IF EXISTS "Admins update app_media" ON storage.objects;
CREATE POLICY "Admins update app_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app_media' AND public.is_app_admin())
  WITH CHECK (bucket_id = 'app_media' AND public.is_app_admin());

DROP POLICY IF EXISTS "Admins delete app_media" ON storage.objects;
CREATE POLICY "Admins delete app_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app_media' AND public.is_app_admin());
