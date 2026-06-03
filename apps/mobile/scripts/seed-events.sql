-- Seed sample events for testing
-- Run AFTER create-events-table.sql

INSERT INTO public.events (title, description, event_date, end_date, location, location_url, image_url, type, max_capacity, price, currency, is_online, active) VALUES

-- Upcoming stargazing night
(
  'Full Moon Observation Night',
  'Join us for a guided observation of the full moon through our premium telescopes. Learn about lunar maria, craters, and the best techniques for lunar photography. Suitable for all experience levels.',
  '2026-06-15 19:30:00+05:30',
  '2026-06-15 22:00:00+05:30',
  'Nandi Hills, Bangalore',
  'https://maps.google.com/?q=Nandi+Hills+Bangalore',
  'https://images-assets.nasa.gov/image/PIA12235/PIA12235~orig.jpg',
  'stargazing',
  30,
  0,
  'INR',
  false,
  true
),

-- Workshop
(
  'Astrophotography Masterclass',
  'A hands-on workshop covering deep sky imaging with DSLR and dedicated astro cameras. Topics include polar alignment, stacking, processing in PixInsight, and choosing the right gear. Bring your own camera!',
  '2026-06-22 16:00:00+05:30',
  '2026-06-22 19:00:00+05:30',
  'Pie Matrix Studio, Indiranagar',
  NULL,
  'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001738/GSFC_20171208_Archive_e001738~orig.jpg',
  'workshop',
  20,
  1499,
  'INR',
  false,
  true
),

-- Online webinar
(
  'Choosing Your First Telescope',
  'Not sure which telescope to buy? Join our expert panel as they break down refractors vs reflectors, aperture myths, and the best scopes for every budget. Live Q&A included.',
  '2026-06-28 20:00:00+05:30',
  '2026-06-28 21:30:00+05:30',
  'Online (Zoom)',
  NULL,
  'https://images-assets.nasa.gov/image/PIA17563/PIA17563~orig.jpg',
  'webinar',
  NULL,
  0,
  'INR',
  true,
  true
),

-- Meetup
(
  'Stargazers Meetup — Coorg',
  'A weekend getaway for amateur astronomers. Dark skies, great company, and telescopes provided. We''ll observe the Milky Way core, Jupiter''s moons, and hunt for deep sky objects together.',
  '2026-07-05 18:00:00+05:30',
  '2026-07-06 06:00:00+05:30',
  'Coorg, Karnataka',
  'https://maps.google.com/?q=Coorg+Karnataka',
  'https://images-assets.nasa.gov/image/PIA23646/PIA23646~orig.jpg',
  'meetup',
  15,
  2999,
  'INR',
  false,
  true
),

-- Product launch
(
  'Pie Matrix Pro Scope — Launch Event',
  'Be the first to see our new 8" Dobsonian telescope. Live demo, first-look pricing, and exclusive launch-day discounts for attendees. Refreshments provided.',
  '2026-07-12 17:00:00+05:30',
  '2026-07-12 20:00:00+05:30',
  'Pie Matrix HQ, Bangalore',
  NULL,
  'https://images-assets.nasa.gov/image/PIA04921/PIA04921~orig.jpg',
  'launch',
  50,
  0,
  'INR',
  false,
  true
),

-- Observation night
(
  'Saturn Opposition Night',
  'Saturn is at its closest and brightest! View the rings in stunning detail through our 12" scope. We''ll also spot Titan and the Cassini Division. Clear skies expected.',
  '2026-07-20 20:00:00+05:30',
  '2026-07-20 23:00:00+05:30',
  'Savandurga Hill, Bangalore',
  'https://maps.google.com/?q=Savandurga+Hill',
  'https://images-assets.nasa.gov/image/PIA20061/PIA20061~orig.jpg',
  'observation',
  25,
  499,
  'INR',
  false,
  true
);
