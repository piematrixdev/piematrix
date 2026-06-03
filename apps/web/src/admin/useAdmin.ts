/**
 * useAdmin — resolves the current Supabase session and whether the
 * signed-in user is an app admin.
 *
 * Backed by the `public.app_admins` allow-list (see
 * supabase/admin-panel.sql). RLS guarantees a user can only ever read
 * their own admin row, and all admin writes are enforced by RLS via
 * `public.is_app_admin()` — so this client check is for UX gating only;
 * the database is the real authority.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export type AdminRole = 'admin' | 'editor';

export interface AdminState {
  user: User | null;
  isAdmin: boolean;
  role: AdminRole | null;
  loading: boolean;
}

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({
    user: null,
    isAdmin: false,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const resolve = async (user: User | null) => {
      if (!user) {
        if (!cancelled) {
          setState({ user: null, isAdmin: false, role: null, loading: false });
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('app_admins')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          setState({ user, isAdmin: false, role: null, loading: false });
        } else {
          setState({
            user,
            isAdmin: true,
            role: (data.role as AdminRole) ?? 'admin',
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ user, isAdmin: false, role: null, loading: false });
        }
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => resolve(session?.user ?? null))
      .catch(() => {
        if (!cancelled) {
          setState({ user: null, isAdmin: false, role: null, loading: false });
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((p) => ({ ...p, loading: true }));
      resolve(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
