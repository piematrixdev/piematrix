-- Seed celestial_images table with verified NASA image URLs
-- Run this in your Supabase SQL Editor
-- All URLs verified from images-api.nasa.gov on 2026-05-20

CREATE TABLE IF NOT EXISTS celestial_images (
  id text PRIMARY KEY,
  name text,
  image_url text NOT NULL,
  credit text DEFAULT 'NASA',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE celestial_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON celestial_images;
CREATE POLICY "Public read" ON celestial_images FOR SELECT USING (true);

-- Clear and re-seed
DELETE FROM celestial_images;

INSERT INTO celestial_images (id, name, image_url, credit) VALUES
-- VERIFIED Messier Objects (from NASA Images API results)
('M1', 'Crab Nebula', 'https://images-assets.nasa.gov/image/PIA03606/PIA03606~medium.jpg', 'NASA/ESA/Hubble'),
('M2', 'Globular Cluster M2', 'https://images-assets.nasa.gov/image/PIA04926/PIA04926~small.jpg', 'NASA/ESA'),
('M5', 'Globular Cluster M5', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001116/GSFC_20171208_Archive_e001116~small.jpg', 'NASA/ESA'),
('M8', 'Lagoon Nebula', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001955/GSFC_20171208_Archive_e001955~medium.jpg', 'NASA/ESA/Hubble'),
('M11', 'Wild Duck Cluster', 'https://images-assets.nasa.gov/image/PIA07878/PIA07878~small.jpg', 'NASA/JPL'),
('M16', 'Eagle Nebula', 'https://images-assets.nasa.gov/image/PIA03096/PIA03096~medium.jpg', 'NASA/ESA/Hubble'),
('M20', 'Trifid Nebula', 'https://images-assets.nasa.gov/image/PIA04220/PIA04220~small.jpg', 'NASA/JPL-Caltech'),
('M27', 'Dumbbell Nebula', 'https://images-assets.nasa.gov/image/PIA04249/PIA04249~small.jpg', 'NASA/ESA/Hubble'),
('M31', 'Andromeda Galaxy', 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg', 'NASA/JPL-Caltech'),
('M33', 'Triangulum Galaxy', 'https://images-assets.nasa.gov/image/PIA25165/PIA25165~medium.jpg', 'NASA/ESA'),
('M42', 'Orion Nebula', 'https://images-assets.nasa.gov/image/PIA04227/PIA04227~small.jpg', 'NASA/ESA/Hubble'),
('M45', 'Pleiades', 'https://images-assets.nasa.gov/image/PIA14096/PIA14096~medium.jpg', 'NASA/JPL-Caltech'),
('M51', 'Whirlpool Galaxy', 'https://images-assets.nasa.gov/image/PIA04230/PIA04230~small.jpg', 'NASA/ESA/Hubble'),
('M57', 'Ring Nebula', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001464/GSFC_20171208_Archive_e001464~small.jpg', 'NASA/ESA/Hubble'),
('M63', 'Sunflower Galaxy', 'https://images-assets.nasa.gov/image/PIA13900/PIA13900~small.jpg', 'NASA/JPL-Caltech'),
('M82', 'Cigar Galaxy', 'https://images-assets.nasa.gov/image/PIA02917/PIA02917~medium.jpg', 'NASA/JPL-Caltech'),
('M83', 'Southern Pinwheel', 'https://images-assets.nasa.gov/image/PIA10374/PIA10374~medium.jpg', 'NASA/JPL-Caltech'),
('M101', 'Pinwheel Galaxy', 'https://images-assets.nasa.gov/image/PIA10968/PIA10968~medium.jpg', 'NASA/ESA/Hubble'),
('M104', 'Sombrero Galaxy', 'https://images-assets.nasa.gov/image/PIA15426/PIA15426~medium.jpg', 'NASA/JPL-Caltech'),

-- PLANETS (verified correct)
('jupiter', 'Jupiter', 'https://images-assets.nasa.gov/image/PIA25726/PIA25726~medium.jpg', 'NASA/JPL-Caltech/SwRI'),
('mars', 'Mars', 'https://images-assets.nasa.gov/image/PIA01253/PIA01253~small.jpg', 'NASA/Hubble'),
('neptune', 'Neptune', 'https://images-assets.nasa.gov/image/PIA02220/PIA02220~thumb.jpg', 'NASA/JPL/Voyager'),
('uranus', 'Uranus', 'https://images-assets.nasa.gov/image/PIA01282/PIA01282~thumb.jpg', 'NASA/Hubble'),
('mercury', 'Mercury', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001625/GSFC_20171208_Archive_e001625~small.jpg', 'NASA/MESSENGER'),
('saturn', 'Saturn', 'https://images-assets.nasa.gov/image/GSFC_20220520_M14162_SaturnMoons/GSFC_20220520_M14162_SaturnMoons~medium.jpg', 'NASA/Cassini');

-- NOTE: Objects not in this table will show a colored dot instead of an image.
-- To add more, search at https://images.nasa.gov and use the URL pattern:
-- https://images-assets.nasa.gov/image/{NASA_ID}/{NASA_ID}~small.jpg
-- Sizes: ~thumb.jpg (small), ~small.jpg (medium), ~medium.jpg (large)


-- CONSTELLATIONS
-- Use id format: const_name (lowercase)
-- These will be fetched via NASA Images API search if not in DB
INSERT INTO celestial_images (id, name, image_url, credit) VALUES
('const_orion', 'Orion', 'https://images-assets.nasa.gov/image/PIA04227/PIA04227~small.jpg', 'NASA/JPL'),
('const_scorpius', 'Scorpius', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001955/GSFC_20171208_Archive_e001955~medium.jpg', 'NASA/ESA'),
('const_sagittarius', 'Sagittarius', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001955/GSFC_20171208_Archive_e001955~medium.jpg', 'NASA/ESA'),
('const_leo', 'Leo', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001280/GSFC_20171208_Archive_e001280~thumb.jpg', 'NASA/ESA'),
('const_taurus', 'Taurus', 'https://images-assets.nasa.gov/image/PIA14096/PIA14096~medium.jpg', 'NASA/JPL-Caltech'),
('const_gemini', 'Gemini', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001547/GSFC_20171208_Archive_e001547~thumb.jpg', 'NASA/ESA'),
('const_lyra', 'Lyra', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001464/GSFC_20171208_Archive_e001464~small.jpg', 'NASA/ESA'),
('const_cygnus', 'Cygnus', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001547/GSFC_20171208_Archive_e001547~thumb.jpg', 'NASA/ESA'),
('const_cassiopeia', 'Cassiopeia', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001547/GSFC_20171208_Archive_e001547~thumb.jpg', 'NASA/ESA'),
('const_pegasus', 'Pegasus', 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg', 'NASA/JPL'),
('const_andromeda', 'Andromeda', 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg', 'NASA/JPL-Caltech'),
('const_virgo', 'Virgo', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001280/GSFC_20171208_Archive_e001280~thumb.jpg', 'NASA/ESA'),
('const_boötes', 'Boötes', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001116/GSFC_20171208_Archive_e001116~small.jpg', 'NASA/ESA'),
('const_hercules', 'Hercules', 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001861/GSFC_20171208_Archive_e001861~thumb.jpg', 'NASA/ESA');
