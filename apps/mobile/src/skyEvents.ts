/**
 * Sky Events Service — fetches custom events from Supabase backend.
 * 
 * Supabase table: `sky_events`
 * Columns:
 *   id          uuid (primary key, auto-generated)
 *   date        date (the night this event is relevant)
 *   title       text (event title, e.g. "Saturn at Opposition")
 *   description text (detailed description)
 *   type        text (planet, meteor, eclipse, conjunction, comet, iss, custom)
 *   image_url   text (optional — URL to an image/photo)
 *   priority    integer (1=high, 2=medium, 3=low — controls sort order)
 *   created_at  timestamptz (auto)
 * 
 * To create this table in Supabase SQL editor:
 * 
 * CREATE TABLE sky_events (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   date date NOT NULL,
 *   title text NOT NULL,
 *   description text NOT NULL,
 *   type text NOT NULL DEFAULT 'custom',
 *   image_url text,
 *   priority integer DEFAULT 2,
 *   created_at timestamptz DEFAULT now()
 * );
 * 
 * -- Enable RLS and allow public read
 * ALTER TABLE sky_events ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Public read" ON sky_events FOR SELECT USING (true);
 * 
 * -- Index for date queries
 * CREATE INDEX idx_sky_events_date ON sky_events(date);
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtc3lsZndwZnRxZGx6b2JvcXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc2NzgsImV4cCI6MjA4NjQwMzY3OH0.xlvx75WroRG-oEhmHhoQJEWiemJ2c_xX4uOprHJm288';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface SkyEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'planet' | 'meteor' | 'eclipse' | 'conjunction' | 'comet' | 'iss' | 'custom';
  image_url: string | null;
  priority: number;
}

/**
 * Fetch sky events for a specific date from Supabase.
 * Returns events for that date, sorted by priority.
 */
export async function fetchSkyEvents(date: Date): Promise<SkyEvent[]> {
  try {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .from('sky_events')
      .select('*')
      .eq('date', dateStr)
      .order('priority', { ascending: true });

    if (error) {
      console.warn('[SkyEvents] Fetch error:', error.message);
      return [];
    }

    return (data ?? []) as SkyEvent[];
  } catch (e) {
    console.warn('[SkyEvents] Failed:', e);
    return [];
  }
}

/**
 * Fetch sky events for a date range (e.g., this week).
 */
export async function fetchSkyEventsRange(startDate: Date, endDate: Date): Promise<SkyEvent[]> {
  try {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('sky_events')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('priority', { ascending: true });

    if (error) {
      console.warn('[SkyEvents] Range fetch error:', error.message);
      return [];
    }

    return (data ?? []) as SkyEvent[];
  } catch (e) {
    console.warn('[SkyEvents] Range failed:', e);
    return [];
  }
}

/**
 * Fetch upcoming events (next 7 days).
 */
export async function fetchUpcomingEvents(): Promise<SkyEvent[]> {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  return fetchSkyEventsRange(today, nextWeek);
}

// Event type colors for UI
export const EVENT_TYPE_COLORS: Record<string, string> = {
  planet: '#f59e0b',
  meteor: '#4ade80',
  eclipse: '#ef4444',
  conjunction: '#a78bfa',
  comet: '#06b6d4',
  iss: '#60a5fa',
  custom: '#d4c5a0',
};

// Event type icons (emoji fallback)
export const EVENT_TYPE_EMOJI: Record<string, string> = {
  planet: '🪐',
  meteor: '☄️',
  eclipse: '🌑',
  conjunction: '🌟',
  comet: '💫',
  iss: '🛰️',
  custom: '✨',
};


/**
 * NASA Astronomy Picture of the Day (APOD) — free, no key required for DEMO_KEY.
 * Provides a daily space/astronomy photo with explanation.
 * Rate limit: 30 requests/hour with DEMO_KEY, 1000/hour with a free API key.
 * Get a free key at: https://api.nasa.gov/
 */
export interface NasaApod {
  title: string;
  explanation: string;
  url: string; // image URL
  hdurl?: string; // high-res image URL
  date: string; // YYYY-MM-DD
  media_type: 'image' | 'video';
}

const NASA_API_KEY = 'DEMO_KEY'; // Replace with your free key from https://api.nasa.gov/

export async function fetchNasaApod(date?: Date): Promise<NasaApod | null> {
  try {
    const dateStr = date ? date.toISOString().split('T')[0] : '';
    const dateParam = dateStr ? `&date=${dateStr}` : '';
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}${dateParam}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data as NasaApod;
  } catch (e) {
    console.warn('[APOD] Fetch failed:', e);
    return null;
  }
}


/**
 * Weather conditions for stargazing — uses OpenWeatherMap free tier.
 * Key metric: cloud cover percentage (lower = better for stargazing).
 * Free tier: 1000 calls/day. Get key at: https://openweathermap.org/api
 */
export interface StargazingWeather {
  cloudCover: number;       // 0-100%
  humidity: number;         // 0-100%
  temperature: number;      // Celsius
  windSpeed: number;        // m/s
  description: string;      // e.g. "clear sky", "few clouds"
  icon: string;             // weather icon code
  visibility: number;       // meters (max 10000)
  /** Computed stargazing score 0-100 */
  stargazingScore: number;
  /** Human-readable verdict */
  verdict: string;
}

// Free OpenWeatherMap API key — replace with your own from openweathermap.org
const OWM_API_KEY = ''; // Add your key here

export async function fetchStargazingWeather(lat: number, lon: number): Promise<StargazingWeather | null> {
  if (!OWM_API_KEY) return null; // No key configured
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();

    const cloudCover = data.clouds?.all ?? 0;
    const humidity = data.main?.humidity ?? 0;
    const temperature = Math.round(data.main?.temp ?? 0);
    const windSpeed = data.wind?.speed ?? 0;
    const description = data.weather?.[0]?.description ?? 'unknown';
    const icon = data.weather?.[0]?.icon ?? '01n';
    const visibility = data.visibility ?? 10000;

    // Compute stargazing score (0-100, higher = better)
    // Cloud cover is the biggest factor
    let score = 100;
    score -= cloudCover * 0.7;           // Clouds are the #1 enemy
    score -= Math.max(0, humidity - 60) * 0.3; // High humidity = haze
    score -= Math.max(0, windSpeed - 5) * 2;   // Strong wind = turbulence
    score -= Math.max(0, (10000 - visibility) / 500); // Low visibility = haze
    score = Math.max(0, Math.min(100, Math.round(score)));

    let verdict: string;
    if (score >= 80) verdict = 'Excellent — clear skies, perfect for stargazing';
    else if (score >= 60) verdict = 'Good — mostly clear, some haze possible';
    else if (score >= 40) verdict = 'Fair — partial clouds, limited viewing';
    else if (score >= 20) verdict = 'Poor — mostly cloudy, few stars visible';
    else verdict = 'Bad — overcast, not recommended for stargazing';

    return { cloudCover, humidity, temperature, windSpeed, description, icon, visibility, stargazingScore: score, verdict };
  } catch (e) {
    console.warn('[Weather] Fetch failed:', e);
    return null;
  }
}

/**
 * Fetch weather forecast for tonight (uses 3-hour forecast API).
 * Returns conditions at 9 PM local time.
 */
export async function fetchTonightWeather(lat: number, lon: number): Promise<StargazingWeather | null> {
  if (!OWM_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=8&appid=${OWM_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Find the forecast closest to 9 PM tonight
    const tonight = new Date();
    tonight.setHours(21, 0, 0, 0);
    if (tonight.getTime() < Date.now()) tonight.setDate(tonight.getDate() + 1);

    let closest = data.list?.[0];
    let minDiff = Infinity;
    for (const item of data.list ?? []) {
      const diff = Math.abs(item.dt * 1000 - tonight.getTime());
      if (diff < minDiff) { minDiff = diff; closest = item; }
    }

    if (!closest) return null;

    const cloudCover = closest.clouds?.all ?? 0;
    const humidity = closest.main?.humidity ?? 0;
    const temperature = Math.round(closest.main?.temp ?? 0);
    const windSpeed = closest.wind?.speed ?? 0;
    const description = closest.weather?.[0]?.description ?? 'unknown';
    const icon = closest.weather?.[0]?.icon ?? '01n';
    const visibility = closest.visibility ?? 10000;

    let score = 100;
    score -= cloudCover * 0.7;
    score -= Math.max(0, humidity - 60) * 0.3;
    score -= Math.max(0, windSpeed - 5) * 2;
    score -= Math.max(0, (10000 - visibility) / 500);
    score = Math.max(0, Math.min(100, Math.round(score)));

    let verdict: string;
    if (score >= 80) verdict = 'Excellent — clear skies tonight';
    else if (score >= 60) verdict = 'Good — mostly clear tonight';
    else if (score >= 40) verdict = 'Fair — partial clouds expected';
    else if (score >= 20) verdict = 'Poor — mostly cloudy tonight';
    else verdict = 'Overcast — not ideal for stargazing';

    return { cloudCover, humidity, temperature, windSpeed, description, icon, visibility, stargazingScore: score, verdict };
  } catch (e) {
    console.warn('[Weather] Forecast failed:', e);
    return null;
  }
}


/**
 * ── Live sky-condition weather via Open-Meteo ────────────────────────
 *
 * Open-Meteo is free and requires NO API key or signup:
 *   https://open-meteo.com/
 *
 * We use it to tell the user, in plain English, whether the sky is
 * clear right now, the current conditions + temperature, and — if it's
 * cloudy — when the next clear window is expected for stargazing.
 */

export interface SkyWeather extends StargazingWeather {
  /** Short condition word, e.g. "Clear", "Partly cloudy", "Overcast". */
  conditionLabel: string;
  /** True if it's currently daytime at the location. */
  isDay: boolean;
  /** True if the sky is clear enough to observe right now. */
  isClearNow: boolean;
  /** ISO timestamp of the next clear hour, or null if none in range. */
  nextClearAt: string | null;
  /** Human sentence: "Clear right now", "Clears around 11 PM", etc. */
  nextClearText: string;
}

/** Cloud-cover percentage at/under which we call the sky "clear". */
const CLEAR_CLOUD_THRESHOLD = 30;

/** Map a WMO weather code to a short label. */
function wmoLabel(code: number, cloudCover: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Stormy';
  // Fallback by cloud cover
  if (cloudCover <= 30) return 'Clear';
  if (cloudCover <= 60) return 'Partly cloudy';
  return 'Cloudy';
}

function scoreFromConditions(cloudCover: number, humidity: number, windSpeed: number): number {
  let score = 100;
  score -= cloudCover * 0.7;
  score -= Math.max(0, humidity - 60) * 0.3;
  score -= Math.max(0, windSpeed - 5) * 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function verdictFromScore(score: number): string {
  if (score >= 80) return 'Excellent — clear skies, perfect for stargazing';
  if (score >= 60) return 'Good — mostly clear, some haze possible';
  if (score >= 40) return 'Fair — partial clouds, limited viewing';
  if (score >= 20) return 'Poor — mostly cloudy, few stars visible';
  return 'Overcast — not recommended for stargazing';
}

/** Format an hourly local-time ISO string ("2026-05-30T21:00") nicely. */
function formatClearTime(iso: string, now: Date): string {
  const d = new Date(iso);
  const hour = d.getHours();
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (sameDay) return `around ${h12} ${ampm}`;
  if (isTomorrow) return `tomorrow ${h12} ${ampm}`;
  const weekday = d.toLocaleDateString([], { weekday: 'short' });
  return `${weekday} ${h12} ${ampm}`;
}

/**
 * Fetch current sky conditions + a "when will it be clear" outlook.
 * No API key required (Open-Meteo).
 */
export async function fetchSkyWeather(lat: number, lon: number): Promise<SkyWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m` +
      `&hourly=cloud_cover,weather_code,temperature_2m,is_day` +
      `&forecast_days=2&timezone=auto&wind_speed_unit=ms`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const cur = data.current ?? {};
    const cloudCover = Math.round(cur.cloud_cover ?? 0);
    const humidity = Math.round(cur.relative_humidity_2m ?? 0);
    const temperature = Math.round(cur.temperature_2m ?? 0);
    const windSpeed = cur.wind_speed_10m ?? 0;
    const weatherCode = cur.weather_code ?? 0;
    const isDay = (cur.is_day ?? 1) === 1;

    const conditionLabel = wmoLabel(weatherCode, cloudCover);
    const stargazingScore = scoreFromConditions(cloudCover, humidity, windSpeed);
    const verdict = verdictFromScore(stargazingScore);
    const isClearNow = cloudCover <= CLEAR_CLOUD_THRESHOLD;

    // Scan the hourly forecast for the next clear window.
    const now = new Date();
    const times: string[] = data.hourly?.time ?? [];
    const clouds: number[] = data.hourly?.cloud_cover ?? [];
    let nextClearAt: string | null = null;
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i]);
      if (t.getTime() <= now.getTime()) continue; // future hours only
      if ((clouds[i] ?? 100) <= CLEAR_CLOUD_THRESHOLD) {
        nextClearAt = times[i];
        break;
      }
    }

    let nextClearText: string;
    if (isClearNow) {
      nextClearText = isDay
        ? 'Skies are clear — great viewing after dark'
        : 'Clear skies right now — perfect for stargazing';
    } else if (nextClearAt) {
      nextClearText = `Clearing up ${formatClearTime(nextClearAt, now)}`;
    } else {
      nextClearText = 'Staying cloudy for the next day or so';
    }

    return {
      cloudCover,
      humidity,
      temperature,
      windSpeed,
      description: conditionLabel.toLowerCase(),
      icon: '',
      visibility: 10000,
      stargazingScore,
      verdict,
      conditionLabel,
      isDay,
      isClearNow,
      nextClearAt,
      nextClearText,
    };
  } catch (e) {
    console.warn('[SkyWeather] Fetch failed:', e);
    return null;
  }
}

/** Color for a stargazing score, for UI accents. */
export function stargazingScoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#86efac';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}
