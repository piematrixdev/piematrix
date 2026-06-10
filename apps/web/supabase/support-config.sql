-- Support & Feedback configuration table
-- Stores editable categories and purchase sources for the mobile app.
-- Single-row config table — the app reads the one row.
-- Editable from the admin panel.

CREATE TABLE IF NOT EXISTS support_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- single row
  feedback_categories text[] NOT NULL DEFAULT ARRAY['General', 'Bug Report', 'Feature Request', 'UI/UX', 'Performance'],
  support_categories text[] NOT NULL DEFAULT ARRAY['General', 'Telescope', 'Binoculars', 'Delivery', 'Purchase', 'Demo'],
  purchase_sources text[] NOT NULL DEFAULT ARRAY['Amazon', 'Website', 'Flipkart', 'Other'],
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_config ENABLE ROW LEVEL SECURITY;

-- Public read (app can read config)
CREATE POLICY "Public read support_config"
  ON support_config FOR SELECT
  USING (true);

-- Admin write
CREATE POLICY "Admin write support_config"
  ON support_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed the default config row
INSERT INTO support_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Also create feedback table if it doesn't exist, with all needed columns
CREATE TABLE IF NOT EXISTS feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text,
  name text,
  phone text,
  category text,
  rating integer,
  message text,
  type text DEFAULT 'feedback',
  purchase_source text,
  app_version text,
  device_info text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;
CREATE POLICY "Users can insert feedback" ON feedback FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can read own feedback" ON feedback;
CREATE POLICY "Users can read own feedback" ON feedback FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Add columns if table already existed without them
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS type text DEFAULT 'feedback';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS purchase_source text;
