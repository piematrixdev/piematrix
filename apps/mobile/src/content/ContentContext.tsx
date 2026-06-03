/**
 * ContentContext — backend-driven copy for the app.
 *
 * Reads every row of public.app_content once on launch, caches it to
 * AsyncStorage for offline / instant subsequent loads, and exposes a
 * `t(key, fallback)` helper. Every call site passes an inline fallback,
 * so the app always renders sensible text even if the network is down
 * or a key hasn't been seeded yet.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../auth/supabaseClient';

type ContentMap = Record<string, string>;

interface ContentContextType {
  /** Look up a key, returning `fallback` if it isn't loaded yet. */
  t: (key: string, fallback: string) => string;
  ready: boolean;
  refresh: () => Promise<void>;
}

const CACHE_KEY = 'app_content_cache_v1';

const ContentContext = createContext<ContentContextType>({
  t: (_key, fallback) => fallback,
  ready: false,
  refresh: async () => {},
});

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<ContentMap>({});
  const [ready, setReady] = useState(false);
  const mapRef = useRef<ContentMap>({});

  const apply = (next: ContentMap) => {
    mapRef.current = next;
    setMap(next);
  };

  const fetchFromServer = async () => {
    const { data, error } = await supabase.from('app_content').select('key, value');
    if (error || !data) return;
    const next: ContentMap = {};
    for (const row of data as Array<{ key: string; value: string }>) {
      next[row.key] = row.value;
    }
    apply(next);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Hydrate instantly from cache (offline-friendly).
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) apply(JSON.parse(cached));
      } catch {}
      if (!cancelled) setReady(true);

      // 2. Refresh from server in the background.
      await fetchFromServer();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const t = (key: string, fallback: string): string => {
    const v = mapRef.current[key];
    return v !== undefined && v !== '' ? v : fallback;
  };

  return (
    <ContentContext.Provider value={{ t, ready, refresh: fetchFromServer }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}
