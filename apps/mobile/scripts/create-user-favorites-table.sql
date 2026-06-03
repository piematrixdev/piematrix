-- User favorites table for storing favorite celestial objects
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id TEXT NOT NULL,          -- e.g. "M31", "Sirius", "Jupiter"
  object_name TEXT NOT NULL,
  object_type TEXT NOT NULL,        -- "Star", "Planet", "Deep Sky", "Constellation"
  magnitude DOUBLE PRECISION,
  constellation TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, object_id)
);

-- Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites
DROP POLICY IF EXISTS "Users can read own favorites" ON user_favorites;
CREATE POLICY "Users can read own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own favorites
DROP POLICY IF EXISTS "Users can insert own favorites" ON user_favorites;
CREATE POLICY "Users can insert own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
DROP POLICY IF EXISTS "Users can delete own favorites" ON user_favorites;
CREATE POLICY "Users can delete own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Users can update their own favorites (for upsert)
DROP POLICY IF EXISTS "Users can update own favorites" ON user_favorites;
CREATE POLICY "Users can update own favorites" ON user_favorites
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_object ON user_favorites(user_id, object_id);
