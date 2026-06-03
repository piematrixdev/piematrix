-- =====================================================================
-- Supabase database-linter remediation, round 2
--
-- Run this in the Supabase SQL Editor as the project owner.
--
-- Resolves:
--   1. function_search_path_mutable                (30 functions)
--   2. rls_policy_always_true                      (12 policies)
--   3. public_bucket_allows_listing                (4 buckets)
--   4. anon_/authenticated_security_definer_       (14 functions)
--      function_executable
--
-- NOT fixable from SQL (manual):
--   - auth_leaked_password_protection: enable in Dashboard
--     -> Authentication -> Providers -> Email -> "Leaked password protection"
--   - rls_disabled_in_public for public.spatial_ref_sys: PostGIS-owned,
--     ignore in the Database Advisor UI.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Pin search_path on all flagged functions.
--
-- We loop through pg_proc so we don't have to hand-type every signature
-- and so we don't fail on overloads.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  fn_names text[] := ARRAY[
    'generate_referral_code',
    'webhook_follow_created',
    'get_brightest_stars',
    'log_api_key_usage',
    'notify_comment',
    'notify_like',
    'notify_follow',
    'send_event_reminders',
    'add_group_creator_as_owner',
    'trigger_webhooks',
    'get_celestial_info',
    'verify_api_key',
    'generate_api_key_prefix',
    'get_stars_by_magnitude',
    'update_observation_likes_count',
    'notify_sky_alert',
    'webhook_observation_created',
    'notify_mission_complete',
    'webhook_post_created',
    'update_post_comments_count',
    'update_group_member_count',
    'update_observation_comments_count',
    'notify_all_users',
    'update_updated_at_column',
    'update_celestial_info_timestamp',
    'get_stars_in_region',
    'notify_badge_earned',
    'create_notification',
    'webhook_user_created',
    'create_default_notification_preferences'
  ];
BEGIN
  FOR r IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (fn_names)
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      r.nspname, r.proname, r.args
    );
    RAISE NOTICE 'Pinned search_path on %.%(%)', r.nspname, r.proname, r.args;
  END LOOP;
END
$$;


-- ---------------------------------------------------------------------
-- 2. Replace overly-permissive RLS policies.
--
-- Strategy:
--   * "System can insert/update X" policies are leftovers from when
--     SECURITY DEFINER trigger functions were assumed to need them.
--     They don't: in Supabase, those functions run as `postgres`
--     (BYPASSRLS), so the policies are dead weight that just trip
--     the linter. Drop them.
--   * `events.Allow all deletes for authenticated` -> restrict to
--     the event creator (admins can use the service role).
--   * `celestial_info.Allow public insert/update` -> restrict to
--     admins via the existing `public.admin_users` table.
--   * `stars.Authenticated users can insert/update` -> drop. The
--     stars catalog is loaded server-side with the service role.
-- ---------------------------------------------------------------------

-- api_key_logs
DROP POLICY IF EXISTS "System can insert api_key_logs" ON public.api_key_logs;

-- notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- referrals
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

-- user_badges
DROP POLICY IF EXISTS "System can insert badges" ON public.user_badges;

-- user_mission_progress
DROP POLICY IF EXISTS "System can insert mission progress" ON public.user_mission_progress;
DROP POLICY IF EXISTS "System can update mission progress records" ON public.user_mission_progress;

-- webhook_logs
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;

-- stars (admin-managed catalog; drop the broad authenticated policies)
DROP POLICY IF EXISTS "Authenticated users can insert stars" ON public.stars;
DROP POLICY IF EXISTS "Authenticated users can update stars" ON public.stars;

-- events: only the creator can delete (or service role / admin)
DROP POLICY IF EXISTS "Allow all deletes for authenticated" ON public.events;
CREATE POLICY "Event creator can delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- celestial_info: restrict writes to admins listed in public.admin_users
DROP POLICY IF EXISTS "Allow public insert" ON public.celestial_info;
DROP POLICY IF EXISTS "Allow public update" ON public.celestial_info;

CREATE POLICY "Admins can insert celestial_info"
  ON public.celestial_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can update celestial_info"
  ON public.celestial_info FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = (SELECT auth.uid())
    )
  );


-- ---------------------------------------------------------------------
-- 3. Public storage buckets: drop redundant SELECT policies.
--
-- Public buckets serve files via signed-free public URLs. Listing
-- objects is a separate capability that requires a SELECT policy on
-- storage.objects. We don't want anonymous clients enumerating files,
-- so drop those policies.
--
-- These policies live on storage.objects; dropping them does NOT
-- affect public URL access to individual files.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  policy_names text[] := ARRAY[
    'Public can view avatars',
    'Public read access',
    'Public read observation_photos',
    'Allow public read access to post_images',
    'Public read post_images',
    'Public read profile_photos'
  ];
  pname text;
BEGIN
  FOREACH pname IN ARRAY policy_names LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pname);
      RAISE NOTICE 'Dropped storage.objects policy: %', pname;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE
          'Skipped storage.objects policy "%" (insufficient privilege). '
          'Drop it from Dashboard -> Storage -> Policies.', pname;
    END;
  END LOOP;
END
$$;


-- ---------------------------------------------------------------------
-- 4. Lock down SECURITY DEFINER functions that shouldn't be RPC-callable.
--
-- All of these are intended to run only from triggers or trusted
-- server-side code. We revoke EXECUTE from PUBLIC / anon / authenticated;
-- triggers fire regardless of the calling user's EXECUTE privilege, so
-- this doesn't break trigger usage.
--
-- If you legitimately need to invoke any of these via PostgREST,
-- remove it from this list and grant EXECUTE explicitly to the
-- appropriate role instead.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  fn_names text[] := ARRAY[
    'create_default_notification_preferences',
    'create_notification',
    'log_api_key_usage',
    'notify_all_users',
    'notify_badge_earned',
    'notify_comment',
    'notify_follow',
    'notify_like',
    'notify_mission_complete',
    'notify_sky_alert',
    'send_event_reminders',
    'trigger_webhooks',
    'verify_api_key'
  ];
BEGIN
  FOR r IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (fn_names)
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname, r.proname, r.args
    );
    RAISE NOTICE 'Revoked EXECUTE on %.%(%)', r.nspname, r.proname, r.args;
  END LOOP;
END
$$;


-- ---------------------------------------------------------------------
-- Verification queries (uncomment to inspect).
-- ---------------------------------------------------------------------
-- -- Functions still missing search_path:
-- SELECT n.nspname, p.proname, p.proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND (p.proconfig IS NULL OR NOT EXISTS (
--     SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
--   ));
--
-- -- Functions still EXECUTE-able by anon/authenticated:
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authn
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.prosecdef = true;
