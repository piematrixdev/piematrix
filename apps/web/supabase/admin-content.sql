-- =====================================================================
-- App content (CMS) — editable text strings for the mobile app
--
-- Run this in the Supabase SQL Editor AFTER admin-panel.sql
-- (admin writes depend on public.is_app_admin()).
--
-- A simple key/value store. The mobile app reads every row, caches it,
-- and looks up strings by key with an inline fallback. Admins edit
-- values from the web admin "Content" panel.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.app_content (
  key         text PRIMARY KEY,
  value       text NOT NULL DEFAULT '',
  "group"     text NOT NULL DEFAULT 'general',
  label       text,                -- human-friendly name shown in admin
  description text,                -- hint for admins
  multiline   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;

-- Public read: the app fetches content without auth.
DROP POLICY IF EXISTS "Public read app_content" ON public.app_content;
CREATE POLICY "Public read app_content"
  ON public.app_content FOR SELECT
  USING (true);

-- Admin write.
DROP POLICY IF EXISTS "Admins manage app_content" ON public.app_content;
CREATE POLICY "Admins manage app_content"
  ON public.app_content FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.touch_app_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_app_content ON public.app_content;
CREATE TRIGGER trg_touch_app_content
  BEFORE UPDATE ON public.app_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_content();


-- ---------------------------------------------------------------------
-- Seed default copy. ON CONFLICT DO NOTHING means re-running never
-- overwrites values an admin has already edited.
-- ---------------------------------------------------------------------
INSERT INTO public.app_content (key, value, "group", label, description, multiline) VALUES
  -- Home / hero
  ('home.hero.subtitle',      'Tap to explore what''s above you', 'Home', 'Hero subtitle',      'Shown under the hero title when weather data is unavailable', false),
  ('home.hero.cta',           'Open Sky View',                 'Home', 'Hero button',           'Call-to-action button on the hero', false),
  ('home.greeting.night',     'Clear skies',                   'Home', 'Greeting (late night)', 'Greeting before 5am / after 9pm', false),
  ('home.greeting.morning',   'Good morning',                  'Home', 'Greeting (morning)',    '', false),
  ('home.greeting.afternoon', 'Good afternoon',                'Home', 'Greeting (afternoon)',  '', false),
  ('home.greeting.evening',   'Good evening',                  'Home', 'Greeting (evening)',    '', false),

  -- Home / section titles
  ('home.section.tonight',    'Visible Tonight',               'Home', 'Section: Visible Tonight', '', false),
  ('home.section.gear',       'Curated Gear',                  'Home', 'Section: Curated Gear', '', false),

  -- Home / action cards
  ('home.action.telescope.title', 'Telescope targets',         'Home', 'Action card: telescope title', '', false),
  ('home.action.telescope.desc',  'Find objects for your scope', 'Home', 'Action card: telescope subtitle', '', false),
  ('home.action.shop.title',  'Upgrade your view',             'Home', 'Action card: shop title', '', false),
  ('home.action.shop.desc',   'Telescopes, binoculars & accessories', 'Home', 'Action card: shop subtitle', '', false),
  ('home.action.feedback.title', 'Send Feedback',              'Home', 'Action card: feedback title', '', false),
  ('home.action.feedback.desc',  'Help us improve Pie Matrix', 'Home', 'Action card: feedback subtitle', '', false),

  -- Home / footer
  ('home.footer.marquee',     'Sky is not the limit · Think Beyond · ', 'Home', 'Footer marquee', 'Scrolling text at the bottom of home', false),
  ('home.footer.brand',       'Pie Matrix',                    'Home', 'Footer brand name', '', false),

  -- Branding (used across screens)
  ('brand.name',              'Pie Matrix',                    'Branding', 'App name', '', false),
  ('brand.tagline',           'Your window to the cosmos',     'Branding', 'Tagline', 'Shown on the login screen', false),

  -- Support
  ('support.contact.email',   'support@thepiematrix.com',      'Support', 'Support email', '', false),
  ('support.contact.website', 'thepiematrix.com',              'Support', 'Website', '', false),

  -- Login
  ('login.signin_label',      'Sign in to continue',           'Login', 'Sign-in prompt', '', false)
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------
-- Cleanup: the hero title is now computed from live weather in the app,
-- so these DB-driven title keys are no longer used. Remove them if a
-- previous run seeded them.
-- ---------------------------------------------------------------------
DELETE FROM public.app_content
WHERE key IN ('home.hero.title_night', 'home.hero.title_day');
