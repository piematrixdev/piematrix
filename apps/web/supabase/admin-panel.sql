-- =====================================================================
-- Admin panel backing schema
--
-- Run this in the Supabase SQL Editor.
--
-- Creates:
--   * public.app_admins         — allow-list of admin users (keyed to auth.users)
--   * public.is_app_admin()      — helper used by RLS policies + the client
--   * admin write policies on promo_banners / hero_images / celestial_info
--   * admin read policy on feedback
--
-- After running, grant yourself admin with (replace the email):
--   INSERT INTO public.app_admins (user_id, email)
--   SELECT id, email FROM auth.users WHERE email = 'you@thepiematrix.com'
--   ON CONFLICT (user_id) DO NOTHING;
-- =====================================================================


-- ---------------------------------------------------------------------
-- Admin allow-list
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  role       text NOT NULL DEFAULT 'admin'
             CHECK (role IN ('admin', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- A signed-in user may read ONLY their own admin row. Enough for the
-- client to answer "am I an admin?" without exposing the full list.
DROP POLICY IF EXISTS "Users can read own admin row" ON public.app_admins;
CREATE POLICY "Users can read own admin row"
  ON public.app_admins FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------
-- Helper: is the current user an admin?
--
-- SECURITY INVOKER (default) so it runs under the caller's RLS. The
-- caller can see their own app_admins row, so EXISTS resolves correctly.
-- search_path is pinned to satisfy the database linter.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE a.user_id = (SELECT auth.uid())
  );
$$;


-- ---------------------------------------------------------------------
-- promo_banners — admins get full write access
-- (table created by apps/mobile/scripts/seed-promo-banners.sql)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage promo_banners" ON public.promo_banners;
CREATE POLICY "Admins manage promo_banners"
  ON public.promo_banners FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());


-- ---------------------------------------------------------------------
-- hero_images — admins get full write access
-- (table created by apps/mobile/scripts/create-hero-images-table.sql)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage hero_images" ON public.hero_images;
CREATE POLICY "Admins manage hero_images"
  ON public.hero_images FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());


-- ---------------------------------------------------------------------
-- feedback — admins can read all submissions (users keep their own
-- read/insert policies from create-feedback-table.sql)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all feedback" ON public.feedback;
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (public.is_app_admin());


-- ---------------------------------------------------------------------
-- Grant yourself admin access (EDIT the email, then uncomment & run):
-- ---------------------------------------------------------------------
-- INSERT INTO public.app_admins (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'you@thepiematrix.com'
-- ON CONFLICT (user_id) DO NOTHING;
