-- Promo Banners table for HomeScreen slider
-- Run this in Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS promo_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  title text NOT NULL,
  subtitle text,
  link_type text DEFAULT 'screen', -- 'screen' | 'url'
  link_target text,                -- screen name (e.g. 'skywatch', 'shop') or URL
  priority integer DEFAULT 0,      -- lower = shown first
  active boolean DEFAULT true,     -- toggle visibility without deleting
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;

-- Allow public read access (no auth needed for banners)
DROP POLICY IF EXISTS "Public read access" ON promo_banners;
CREATE POLICY "Public read access" ON promo_banners
  FOR SELECT USING (true);

-- Clear old banners and seed with better images
DELETE FROM promo_banners;

INSERT INTO promo_banners (image_url, title, subtitle, link_type, link_target, priority) VALUES
  ('https://images-assets.nasa.gov/image/PIA23646/PIA23646~orig.jpg',
   'Explore the Cosmos', 'AR stargazing at your fingertips', 'screen', 'skywatch', 1),
  ('https://images-assets.nasa.gov/image/PIA20061/PIA20061~orig.jpg',
   'Premium Optics', 'Telescopes & binoculars for every level', 'screen', 'shop', 2),
  ('https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001738/GSFC_20171208_Archive_e001738~orig.jpg',
   'Tonight''s Targets', 'Nebulae, galaxies & star clusters', 'screen', 'telescope', 3),
  ('https://images-assets.nasa.gov/image/PIA16613/PIA16613~orig.jpg',
   'Sky Calendar', 'Upcoming eclipses, conjunctions & meteor showers', 'screen', 'calendar', 4);
