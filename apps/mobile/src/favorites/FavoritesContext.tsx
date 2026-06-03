/**
 * FavoritesContext — Manage favorite celestial objects.
 *
 * Stores favorites locally in AsyncStorage for instant access,
 * and syncs to Supabase user_favorites table when authenticated.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthContext';

export interface FavoriteObject {
  /** Unique identifier: object name or catalog ID (e.g. "M31", "Sirius", "Jupiter") */
  id: string;
  name: string;
  type: string; // "Star", "Planet", "Deep Sky", "Constellation"
  magnitude?: number;
  constellation?: string;
  addedAt: number; // timestamp
}

interface FavoritesContextType {
  favorites: FavoriteObject[];
  isFavorite: (id: string) => boolean;
  addFavorite: (obj: Omit<FavoriteObject, 'addedAt'>) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (obj: Omit<FavoriteObject, 'addedAt'>) => void;
}

const STORAGE_KEY = 'sky_favorites_v1';

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  addFavorite: () => {},
  removeFavorite: () => {},
  toggleFavorite: () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteObject[]>([]);
  const { user } = useAuth();
  const favRef = useRef<FavoriteObject[]>([]);

  // Keep ref in sync
  useEffect(() => { favRef.current = favorites; }, [favorites]);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as FavoriteObject[];
          setFavorites(parsed);
        }
      } catch {}
    })();
  }, []);

  // Sync from Supabase when user logs in
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_favorites')
          .select('object_id, object_name, object_type, magnitude, constellation, added_at')
          .eq('user_id', user.id)
          .order('added_at', { ascending: false });

        if (data && data.length > 0) {
          const remote: FavoriteObject[] = data.map((r: any) => ({
            id: r.object_id,
            name: r.object_name,
            type: r.object_type,
            magnitude: r.magnitude,
            constellation: r.constellation,
            addedAt: new Date(r.added_at).getTime(),
          }));

          // Merge: remote wins for duplicates, keep local-only items
          const merged = new Map<string, FavoriteObject>();
          for (const f of favRef.current) merged.set(f.id, f);
          for (const f of remote) merged.set(f.id, f);
          const mergedArr = Array.from(merged.values()).sort((a, b) => b.addedAt - a.addedAt);

          setFavorites(mergedArr);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedArr));
        }
      } catch {}
    })();
  }, [user?.id]);

  const persist = useCallback(async (next: FavoriteObject[]) => {
    setFavorites(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const addFavorite = useCallback((obj: Omit<FavoriteObject, 'addedAt'>) => {
    const newFav: FavoriteObject = { ...obj, addedAt: Date.now() };
    const next = [newFav, ...favRef.current.filter(f => f.id !== obj.id)];
    persist(next);

    // Sync to Supabase
    if (user?.id) {
      supabase.from('user_favorites').upsert({
        user_id: user.id,
        object_id: obj.id,
        object_name: obj.name,
        object_type: obj.type,
        magnitude: obj.magnitude ?? null,
        constellation: obj.constellation ?? null,
        added_at: new Date().toISOString(),
      }).then(() => {});
    }
  }, [user?.id, persist]);

  const removeFavorite = useCallback((id: string) => {
    const next = favRef.current.filter(f => f.id !== id);
    persist(next);

    // Remove from Supabase
    if (user?.id) {
      supabase.from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('object_id', id)
        .then(() => {});
    }
  }, [user?.id, persist]);

  const isFavorite = useCallback((id: string) => {
    return favRef.current.some(f => f.id === id);
  }, [favorites]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFavorite = useCallback((obj: Omit<FavoriteObject, 'addedAt'>) => {
    if (favRef.current.some(f => f.id === obj.id)) {
      removeFavorite(obj.id);
    } else {
      addFavorite(obj);
    }
  }, [addFavorite, removeFavorite]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
