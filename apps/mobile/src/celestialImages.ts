/**
 * Celestial Object Images
 *
 * Strategy: Store image URLs in Supabase for instant reliable loading.
 * Falls back to NASA Images API if not in DB.
 *
 * Supabase table: `celestial_images`
 * CREATE TABLE celestial_images (
 *   id text PRIMARY KEY,          -- e.g. 'M31', 'M42', 'jupiter'
 *   name text,                    -- e.g. 'Andromeda Galaxy'
 *   image_url text NOT NULL,      -- verified working image URL
 *   thumb_url text,               -- smaller thumbnail URL
 *   credit text DEFAULT 'NASA',   -- image credit
 *   created_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE celestial_images ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Public read" ON celestial_images FOR SELECT USING (true);
 *
 * Then populate with:
 * INSERT INTO celestial_images (id, name, image_url) VALUES
 *   ('M31', 'Andromeda Galaxy', 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~thumb.jpg'),
 *   ('M42', 'Orion Nebula', 'https://images-assets.nasa.gov/image/PIA01322/PIA01322~thumb.jpg'),
 *   ... etc
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtc3lsZndwZnRxZGx6b2JvcXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc2NzgsImV4cCI6MjA4NjQwMzY3OH0.xlvx75WroRG-oEhmHhoQJEWiemJ2c_xX4uOprHJm288';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory cache
const imageCache = new Map<string, string>();
let dbLoaded = false;

/**
 * Load all image URLs from Supabase into cache (one query, instant after that).
 */
async function loadFromDb(): Promise<void> {
  if (dbLoaded) return;
  try {
    const { data, error } = await supabase
      .from('celestial_images')
      .select('id, image_url');
    if (!error && data) {
      for (const row of data) {
        imageCache.set(row.id.toUpperCase(), row.image_url);
        imageCache.set(row.id.toLowerCase(), row.image_url);
      }
    }
  } catch {
    // Table might not exist yet — that's fine
  }
  dbLoaded = true;
}

/**
 * Search NASA Images API as fallback.
 */
async function searchNasaImages(query: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(
      `https://images-api.nasa.gov/search?q=${encoded}&media_type=image&page_size=1`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.collection?.items;
    if (!items || items.length === 0) return null;
    const links = items[0]?.links;
    if (!links || links.length === 0) return null;
    return links[0]?.href ?? null;
  } catch {
    return null;
  }
}

// Specific search terms for NASA API fallback
const SEARCH_TERMS: Record<string, string> = {
  M1: 'crab nebula', M8: 'lagoon nebula', M13: 'hercules globular cluster',
  M16: 'eagle nebula pillars', M17: 'omega nebula', M20: 'trifid nebula',
  M27: 'dumbbell nebula', M31: 'andromeda galaxy', M33: 'triangulum galaxy',
  M42: 'orion nebula', M44: 'beehive cluster', M45: 'pleiades star cluster',
  M51: 'whirlpool galaxy', M57: 'ring nebula', M63: 'sunflower galaxy',
  M64: 'black eye galaxy', M81: 'bode galaxy messier 81', M82: 'cigar galaxy',
  M83: 'southern pinwheel galaxy', M87: 'messier 87 jet',
  M92: 'messier 92 globular', M97: 'owl nebula',
  M101: 'pinwheel galaxy', M104: 'sombrero galaxy',
};

/**
 * Get image for a Messier object.
 * Checks: cache → Supabase DB → NASA API fallback
 */
export async function getMessierImage(id: string): Promise<string | null> {
  const key = id.toUpperCase();

  // Check memory cache
  if (imageCache.has(key)) return imageCache.get(key)!;

  // Try loading from DB
  await loadFromDb();
  if (imageCache.has(key)) return imageCache.get(key)!;

  // Fallback to NASA API
  const searchTerm = SEARCH_TERMS[key] ?? `messier ${key.replace('M', '')}`;
  const url = await searchNasaImages(searchTerm);
  if (url) imageCache.set(key, url);
  return url;
}

/**
 * Get image for a planet.
 */
export async function getPlanetImage(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  if (imageCache.has(key)) return imageCache.get(key)!;
  await loadFromDb();
  if (imageCache.has(key)) return imageCache.get(key)!;

  const url = await searchNasaImages(`${name} planet`);
  if (url) imageCache.set(key, url);
  return url;
}

/**
 * Get image for any celestial object.
 */
export async function getCelestialImage(id: string, name?: string): Promise<string | null> {
  if (imageCache.has(id.toUpperCase())) return imageCache.get(id.toUpperCase())!;
  if (imageCache.has(id.toLowerCase())) return imageCache.get(id.toLowerCase())!;

  await loadFromDb();
  if (imageCache.has(id.toUpperCase())) return imageCache.get(id.toUpperCase())!;
  if (imageCache.has(id.toLowerCase())) return imageCache.get(id.toLowerCase())!;

  if (/^M\d+$/i.test(id)) return getMessierImage(id);
  return getPlanetImage(id);
}

/**
 * Batch prefetch images for multiple objects.
 */
export async function prefetchImages(
  objects: Array<{ id: string; name?: string }>,
  limit = 6,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Load DB first (one query gets everything)
  await loadFromDb();

  // Resolve from cache
  const needsApi: Array<{ id: string; name?: string }> = [];
  for (const obj of objects) {
    const cached = imageCache.get(obj.id.toUpperCase()) ?? imageCache.get(obj.id.toLowerCase());
    if (cached) {
      results.set(obj.id, cached);
    } else {
      needsApi.push(obj);
    }
  }

  // Fetch remaining from NASA API (sequential with delay)
  for (const obj of needsApi.slice(0, limit)) {
    try {
      const url = await getCelestialImage(obj.id, obj.name);
      if (url) results.set(obj.id, url);
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

