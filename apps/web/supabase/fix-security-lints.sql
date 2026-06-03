-- =====================================================================
-- Supabase database-linter remediation
-- Run this in the Supabase SQL Editor (or via supabase db execute).
--
-- Resolves:
--   1. policy_exists_rls_disabled  -> public.stars
--   2. rls_disabled_in_public      -> public.stars
--   3. rls_disabled_in_public      -> public.spatial_ref_sys
--   4. security_definer_view       -> public.api_key_usage_stats
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 & 2. public.stars
-- Policies already exist; RLS just needs to be turned on. Once enabled,
-- the existing "Stars are viewable by everyone" / insert / update
-- policies become effective and the linter clears.
-- ---------------------------------------------------------------------
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;

-- (Re)assert the public-read + authenticated-write policies so this
-- script is idempotent if you run it on a fresh project.
DROP POLICY IF EXISTS "Stars are viewable by everyone" ON public.stars;
CREATE POLICY "Stars are viewable by everyone"
  ON public.stars FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert stars" ON public.stars;
CREATE POLICY "Authenticated users can insert stars"
  ON public.stars FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update stars" ON public.stars;
CREATE POLICY "Authenticated users can update stars"
  ON public.stars FOR UPDATE
  TO authenticated
  USING (true);


-- ---------------------------------------------------------------------
-- 3. public.spatial_ref_sys (PostGIS reference table)
--
-- This table is owned by `supabase_admin` (the PostGIS extension
-- installs it that way), so a regular project role cannot ALTER it:
--
--   ERROR: 42501: must be owner of table spatial_ref_sys
--
-- This is a documented Supabase / PostGIS false-positive for the
-- `rls_disabled_in_public` lint. The recommended action is to mark
-- the lint as ignored in the Supabase Advisor UI.
--
-- We attempt the ALTER inside an exception-handling block so the rest
-- of the migration still applies even if we lack ownership. If your
-- role HAS been granted ownership (e.g. you're running as
-- supabase_admin via the dashboard SQL editor with elevated rights),
-- this block will succeed.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "spatial_ref_sys is readable by everyone" ON public.spatial_ref_sys';
  EXECUTE $p$
    CREATE POLICY "spatial_ref_sys is readable by everyone"
      ON public.spatial_ref_sys FOR SELECT
      USING (true)
  $p$;

  RAISE NOTICE 'Enabled RLS on public.spatial_ref_sys';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE
      'Skipping spatial_ref_sys: not owner (expected on Supabase). '
      'Mark this lint as ignored in the Advisor UI.';
END
$$;


-- ---------------------------------------------------------------------
-- 4. public.api_key_usage_stats (SECURITY DEFINER view)
--
-- Postgres 15+ supports the `security_invoker` view option, which makes
-- the view enforce the querying user's permissions/RLS instead of the
-- creator's. Supabase runs PG 15+, so this is the recommended fix.
-- ---------------------------------------------------------------------
ALTER VIEW public.api_key_usage_stats SET (security_invoker = true);


-- ---------------------------------------------------------------------
-- Verification: run these to confirm the lints are cleared.
-- ---------------------------------------------------------------------
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname IN ('stars', 'spatial_ref_sys');
--
-- SELECT c.relname, r.reloptions
-- FROM pg_class c
-- LEFT JOIN pg_class r ON r.oid = c.oid
-- WHERE c.relname = 'api_key_usage_stats';
