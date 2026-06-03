-- Hero Images table for HomeScreen hero section
-- Allows changing hero images from the backend without app update

CREATE TABLE IF NOT EXISTS hero_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  title text,              -- optional label for admin reference
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE hero_images ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Public read hero images" ON hero_images;
CREATE POLICY "Public read hero images" ON hero_images
  FOR SELECT USING (true);

-- Seed with initial images
INSERT INTO hero_images (image_url, title, priority) VALUES
  ('https://images-assets.nasa.gov/image/PIA23646/PIA23646~orig.jpg', 'Milky Way Center', 1),
  ('https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001738/GSFC_20171208_Archive_e001738~orig.jpg', 'Orion Nebula', 2),
  ('https://images-assets.nasa.gov/image/PIA20061/PIA20061~orig.jpg', 'Andromeda Galaxy', 3),
  ('https://images-assets.nasa.gov/image/PIA17563/PIA17563~orig.jpg', 'Helix Nebula', 4),
  ('https://images-assets.nasa.gov/image/PIA04921/PIA04921~orig.jpg', 'Sombrero Galaxy', 5),
  ('https://images-assets.nasa.gov/image/PIA16613/PIA16613~orig.jpg', 'Carina Nebula', 6);
