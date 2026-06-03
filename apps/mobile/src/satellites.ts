/**
 * satellites.ts — Real-time satellite tracking via CelesTrak TLEs.
 *
 * Fetches fresh Two-Line Element sets from CelesTrak (free, no API key)
 * for the ~200 brightest naked-eye-visible satellites (ISS, Starlink
 * visible passes, etc.), then feeds them to the existing satellite
 * tracker in @virtual-window/astronomy-engine.
 *
 * CelesTrak updates TLEs every few hours. We fetch once per app session
 * (or every 6 hours if the app stays open).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CELESTRAK_VISUAL_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
const CELESTRAK_STATIONS_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';

const CACHE_KEY = 'celestrak_tles_v1';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface TLEEntry {
  name: string;
  line1: string;
  line2: string;
}

/**
 * Parse raw TLE text (3-line format: name, line1, line2, repeated).
 */
function parseTLEText(text: string): TLEEntry[] {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: TLEEntry[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    // Basic validation: line1 starts with '1 ', line2 starts with '2 '
    if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
      entries.push({ name, line1, line2 });
    }
  }
  return entries;
}

/**
 * Fetch TLEs from CelesTrak. Returns cached data if fresh enough.
 * Falls back to cache on network failure.
 */
export async function fetchSatelliteTLEs(): Promise<TLEEntry[]> {
  // Check cache freshness
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_MAX_AGE_MS) {
        return data as TLEEntry[];
      }
    }
  } catch {}

  // Fetch fresh from CelesTrak (visual group = brightest ~200 satellites)
  try {
    const [visRes, stationsRes] = await Promise.all([
      fetch(CELESTRAK_VISUAL_URL, { headers: { 'Accept': 'text/plain' } }),
      fetch(CELESTRAK_STATIONS_URL, { headers: { 'Accept': 'text/plain' } }),
    ]);

    let entries: TLEEntry[] = [];

    if (visRes.ok) {
      const text = await visRes.text();
      entries = parseTLEText(text);
    }

    if (stationsRes.ok) {
      const text = await stationsRes.text();
      const stations = parseTLEText(text);
      // Merge stations (avoid duplicates by name)
      const names = new Set(entries.map((e) => e.name));
      for (const s of stations) {
        if (!names.has(s.name)) entries.push(s);
      }
    }

    if (entries.length > 0) {
      // Cache for offline / next 6 hours
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: entries })
      ).catch(() => {});
      return entries;
    }
  } catch (e) {
    console.warn('[satellites] CelesTrak fetch failed:', e);
  }

  // Fallback: return cached (even if stale) or empty
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached).data as TLEEntry[];
  } catch {}

  return [];
}
