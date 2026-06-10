-- Sky Calendar Events table
-- Stores astronomical events shown as color-coded dots in the mobile app calendar.
-- Managed from the admin panel (Sky Calendar section).

CREATE TABLE IF NOT EXISTS sky_calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  label text NOT NULL,
  color text NOT NULL DEFAULT '#d4c5a0',
  priority integer DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sky_calendar_events ENABLE ROW LEVEL SECURITY;

-- Public read (all users can see active events)
DROP POLICY IF EXISTS "Public read sky_calendar_events" ON sky_calendar_events;
CREATE POLICY "Public read sky_calendar_events"
  ON sky_calendar_events FOR SELECT
  USING (true);

-- Admin write (any authenticated user for now — tighten after running admin-panel.sql)
DROP POLICY IF EXISTS "Admin write sky_calendar_events" ON sky_calendar_events;
CREATE POLICY "Admin write sky_calendar_events"
  ON sky_calendar_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_sky_calendar_events_date ON sky_calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_sky_calendar_events_active_date ON sky_calendar_events(active, date);

-- Seed some June 2026 events as examples
INSERT INTO sky_calendar_events (date, type, label, color, priority) VALUES
  ('2026-06-09', 'conjunction', 'Venus conjunct Jupiter in Cancer', '#f472b6', 1),
  ('2026-06-13', 'sign_ingress', 'Venus enters Leo', '#8b5cf6', 2),
  ('2026-06-19', 'conjunction', 'Venus-Jupiter Close Approach', '#f472b6', 1),
  ('2026-06-21', 'solstice', 'Summer Solstice', '#eab308', 1),
  ('2026-06-21', 'sign_ingress', 'Sun enters Cancer', '#8b5cf6', 2),
  ('2026-06-28', 'sign_ingress', 'Mars enters Gemini', '#8b5cf6', 2),
  ('2026-06-29', 'retrograde', 'Mercury Retrograde in Cancer', '#f43f5e', 1),
  ('2026-07-04', 'sign_ingress', 'Venus enters Virgo', '#8b5cf6', 2),
  ('2026-07-21', 'retrograde', 'Mercury Retrograde ends', '#f43f5e', 2),
  ('2026-07-22', 'sign_ingress', 'Sun enters Leo', '#8b5cf6', 2),
  ('2026-07-30', 'meteor_shower', 'Delta Aquariids Peak', '#4ade80', 1),
  ('2026-08-05', 'sign_ingress', 'Mars enters Cancer', '#8b5cf6', 2),
  ('2026-08-12', 'eclipse', 'Total Solar Eclipse', '#ef4444', 1),
  ('2026-08-12', 'meteor_shower', 'Perseids Peak', '#4ade80', 1),
  ('2026-08-28', 'eclipse', 'Partial Lunar Eclipse', '#ef4444', 1),
  ('2026-09-04', 'opposition', 'Neptune at Opposition', '#f97316', 1),
  ('2026-09-13', 'retrograde', 'Jupiter Retrograde begins', '#f43f5e', 1),
  ('2026-09-22', 'equinox', 'September Equinox', '#22d3ee', 1),
  ('2026-10-04', 'opposition', 'Saturn at Opposition', '#f97316', 1),
  ('2026-10-21', 'meteor_shower', 'Orionids Peak', '#4ade80', 1),
  ('2026-11-17', 'opposition', 'Jupiter at Opposition', '#f97316', 1),
  ('2026-11-17', 'meteor_shower', 'Leonids Peak', '#4ade80', 2),
  ('2026-11-19', 'retrograde', 'Mercury Retrograde in Sagittarius', '#f43f5e', 1),
  ('2026-11-21', 'opposition', 'Uranus at Opposition', '#f97316', 1),
  ('2026-11-25', 'supermoon', 'Supermoon', '#fcd34d', 1),
  ('2026-12-09', 'retrograde', 'Mercury Retrograde ends', '#f43f5e', 2),
  ('2026-12-14', 'meteor_shower', 'Geminids Peak', '#4ade80', 1),
  ('2026-12-21', 'solstice', 'December Solstice', '#eab308', 1),
  ('2026-12-24', 'supermoon', 'Supermoon', '#fcd34d', 1);
