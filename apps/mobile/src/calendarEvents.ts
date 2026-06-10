/**
 * calendarEvents.ts — Fetches sky calendar events from Supabase backend.
 * Moon phases are computed locally (pure math). All other events
 * (conjunctions, retrogrades, eclipses, meteor showers, etc.) come
 * from the `sky_calendar_events` Supabase table, managed via the admin panel.
 *
 * Supabase table: `sky_calendar_events`
 * Columns:
 *   id        uuid (primary key, auto-generated)
 *   date      date NOT NULL
 *   type      text NOT NULL
 *   label     text NOT NULL (e.g. "Venus conjunct Jupiter in Cancer")
 *   color     text NOT NULL (hex color for the dot, e.g. "#f472b6")
 *   priority  integer DEFAULT 1
 *   active    boolean DEFAULT true
 *   created_at timestamptz DEFAULT now()
 *
 * SQL to create:
 *
 * CREATE TABLE sky_calendar_events (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   date date NOT NULL,
 *   type text NOT NULL DEFAULT 'custom',
 *   label text NOT NULL,
 *   color text NOT NULL DEFAULT '#d4c5a0',
 *   priority integer DEFAULT 1,
 *   active boolean DEFAULT true,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * ALTER TABLE sky_calendar_events ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Public read" ON sky_calendar_events FOR SELECT USING (true);
 * CREATE POLICY "Admin write" ON sky_calendar_events FOR ALL USING (
 *   auth.uid() IN (SELECT user_id FROM app_admins)
 * );
 * CREATE INDEX idx_sky_calendar_events_date ON sky_calendar_events(date);
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtc3lsZndwZnRxZGx6b2JvcXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc2NzgsImV4cCI6MjA4NjQwMzY3OH0.xlvx75WroRG-oEhmHhoQJEWiemJ2c_xX4uOprHJm288';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  type: string;
  label: string;
  color: string;
}

// ─── Default colors by event type (used as fallback if DB row has no color) ──

export const EVENT_COLORS: Record<string, string> = {
  new_moon: '#a78bfa',
  full_moon: '#fbbf24',
  first_quarter: '#94a3b8',
  last_quarter: '#94a3b8',
  meteor_shower: '#4ade80',
  conjunction: '#f472b6',
  opposition: '#f97316',
  elongation: '#06b6d4',
  eclipse: '#ef4444',
  equinox: '#22d3ee',
  solstice: '#eab308',
  supermoon: '#fcd34d',
  planet_alignment: '#818cf8',
  comet: '#2dd4bf',
  transit: '#fb923c',
  retrograde: '#f43f5e',
  sign_ingress: '#8b5cf6',
  custom: '#d4c5a0',
};

// ─── Moon Phase Calculation (dynamic, no DB needed) ──────────────────────────

/** Returns the synodic phase age (0–29.53 days) for a given date. */
function moonPhaseAge(date: Date): number {
  const known = new Date(2024, 0, 11, 11, 57); // Known new moon: Jan 11, 2024
  const diff = (date.getTime() - known.getTime()) / (1000 * 60 * 60 * 24);
  return ((diff % 29.53) + 29.53) % 29.53;
}

/** Check if the date is close to a specific phase point within a tolerance. */
function isNearPhase(age: number, target: number, tolerance: number = 0.8): boolean {
  const diff = Math.abs(age - target);
  return diff < tolerance || diff > (29.53 - tolerance);
}

/** Get moon phase events for a given date (computed locally). */
function getMoonPhaseEvents(date: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const age = moonPhaseAge(date);

  if (isNearPhase(age, 0)) {
    events.push({ type: 'new_moon', label: 'New Moon', color: EVENT_COLORS.new_moon });
  } else if (isNearPhase(age, 7.38)) {
    events.push({ type: 'first_quarter', label: 'First Quarter', color: EVENT_COLORS.first_quarter });
  } else if (isNearPhase(age, 14.76)) {
    events.push({ type: 'full_moon', label: 'Full Moon', color: EVENT_COLORS.full_moon });
  } else if (isNearPhase(age, 22.14)) {
    events.push({ type: 'last_quarter', label: 'Last Quarter', color: EVENT_COLORS.last_quarter });
  }

  return events;
}

// ─── Backend Fetching ────────────────────────────────────────────────────────

/** In-memory cache for fetched calendar events. */
let cachedEvents: Map<string, CalendarEvent[]> | null = null;
let cacheStart: string | null = null;
let cacheEnd: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Fetch sky calendar events from Supabase for a date range.
 * Results are cached in memory for 10 minutes.
 */
async function fetchCalendarEvents(startDate: Date, endDate: Date): Promise<Map<string, CalendarEvent[]>> {
  const start = formatDateKey(startDate);
  const end = formatDateKey(endDate);

  // Return cache if fresh and covers the range
  if (cachedEvents && cacheStart && cacheEnd && Date.now() - cacheTimestamp < CACHE_TTL) {
    if (start >= cacheStart && end <= cacheEnd) {
      return cachedEvents;
    }
  }

  try {
    const { data, error } = await supabase
      .from('sky_calendar_events')
      .select('date, type, label, color')
      .eq('active', true)
      .gte('date', start)
      .lte('date', end)
      .order('priority', { ascending: true });

    if (error) {
      console.warn('[CalendarEvents] Fetch error:', error.message);
      return cachedEvents ?? new Map();
    }

    const map = new Map<string, CalendarEvent[]>();
    for (const row of (data ?? [])) {
      const key = row.date;
      const event: CalendarEvent = {
        type: row.type,
        label: row.label,
        color: row.color || EVENT_COLORS[row.type] || EVENT_COLORS.custom,
      };
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }

    // Update cache
    cachedEvents = map;
    cacheStart = start;
    cacheEnd = end;
    cacheTimestamp = Date.now();

    return map;
  } catch (e) {
    console.warn('[CalendarEvents] Failed:', e);
    return cachedEvents ?? new Map();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all sky events for a given date.
 * Combines locally-computed moon phases + backend events.
 * Note: Call `prefetchCalendarEvents()` first for async backend data.
 */
export function getEventsForDate(date: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const key = formatDateKey(date);

  // 1. Moon phases (always available, computed locally)
  events.push(...getMoonPhaseEvents(date));

  // 2. Backend events (from cache — call prefetchCalendarEvents first)
  if (cachedEvents) {
    const backendEvents = cachedEvents.get(key);
    if (backendEvents) {
      events.push(...backendEvents);
    }
  }

  return events;
}

/**
 * Prefetch calendar events for a range (e.g. 30 days) so
 * `getEventsForDate()` can return them synchronously.
 */
export async function prefetchCalendarEvents(startDate: Date, days: number): Promise<void> {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  await fetchCalendarEvents(startDate, endDate);
}

/**
 * Get events for a range of dates. Combines moon phases + cached backend events.
 * For best results, call `prefetchCalendarEvents()` before this.
 */
export function getEventsForRange(startDate: Date, days: number): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const key = formatDateKey(d);
    const events = getEventsForDate(d);
    if (events.length > 0) {
      map.set(key, events);
    }
  }
  return map;
}
