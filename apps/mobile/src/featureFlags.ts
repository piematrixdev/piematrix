/**
 * featureFlags — small client for the feature_flags Supabase table.
 *
 * The table is a single-row config (id = 1) toggled from the admin panel.
 * On boot we fetch once, cache the values, and expose a React hook so any
 * screen can gate a feature behind a flag.
 *
 * Defaults are conservative: anything we haven't explicitly enabled is OFF.
 * That way a network failure on first launch can't accidentally expose a
 * feature we wanted hidden.
 */

import { useEffect, useState } from 'react';
import { supabase } from './auth/supabaseClient';

export interface FeatureFlags {
  /** Show "Ask Orion" AI chat in the mobile app. */
  ai_chat_enabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  ai_chat_enabled: false,
};

let cache: FeatureFlags | null = null;
let inflight: Promise<FeatureFlags> | null = null;
const listeners = new Set<(f: FeatureFlags) => void>();

async function fetchFlags(): Promise<FeatureFlags> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('ai_chat_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    const flags: FeatureFlags = {
      ai_chat_enabled: data?.ai_chat_enabled ?? DEFAULTS.ai_chat_enabled,
    };
    cache = flags;
    listeners.forEach((cb) => cb(flags));
    return flags;
  } catch (e) {
    // Network or table missing — fall back to defaults (everything off).
    if (!cache) cache = DEFAULTS;
    return cache;
  }
}

/** Returns the cached flags immediately if available, otherwise defaults. */
export function getFeatureFlags(): FeatureFlags {
  return cache ?? DEFAULTS;
}

/** Force a refresh from the server. */
export function refreshFeatureFlags(): Promise<FeatureFlags> {
  inflight = fetchFlags();
  return inflight;
}

/**
 * React hook — returns the current flags and re-renders when they update.
 * Triggers a single fetch on first mount across all callers.
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(cache ?? DEFAULTS);

  useEffect(() => {
    const cb = (f: FeatureFlags) => setFlags(f);
    listeners.add(cb);

    if (!cache && !inflight) {
      inflight = fetchFlags().finally(() => { inflight = null; });
    } else if (cache) {
      setFlags(cache);
    }

    return () => {
      listeners.delete(cb);
    };
  }, []);

  return flags;
}
