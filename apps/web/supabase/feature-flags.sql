-- Feature flags configuration table.
-- Single-row config the mobile app reads on boot to decide which features
-- to expose. Toggle from the admin panel ("Feature Flags").
--
-- Add new columns here as you add new gated features.

CREATE TABLE IF NOT EXISTS feature_flags (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- single row
  ai_chat_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- If the table already exists from a previous migration, make sure the
-- column is there.
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS ai_chat_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public read so unauthenticated/anon mobile clients can fetch the flags.
DROP POLICY IF EXISTS "Public read feature_flags" ON feature_flags;
CREATE POLICY "Public read feature_flags"
  ON feature_flags FOR SELECT
  USING (true);

-- Admin write — gated by RLS at the auth layer (admin allow-list elsewhere).
DROP POLICY IF EXISTS "Admin write feature_flags" ON feature_flags;
CREATE POLICY "Admin write feature_flags"
  ON feature_flags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed the single config row. AI chat is OFF by default; flip it on from
-- the admin panel when ready.
INSERT INTO feature_flags (id, ai_chat_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Force OFF for testing (idempotent).
UPDATE feature_flags SET ai_chat_enabled = false, updated_at = now() WHERE id = 1;
