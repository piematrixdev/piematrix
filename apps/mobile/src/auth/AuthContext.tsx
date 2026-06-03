/**
 * AuthContext — manages Supabase auth state across the app.
 * Provides user, session, loading state, and sign-out function.
 * Handles deep link auth callbacks (password reset, OAuth).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { registerForPushNotifications } from '../notifications/PushNotificationService';

// Register push token silently — don't block auth flow
const registerPushOnAuth = (userId: string) => {
  registerForPushNotifications(userId).catch(() => {});
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  passwordRecovery: boolean;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  passwordRecovery: false,
  signOut: async () => {},
  updatePassword: async () => ({ error: null }),
  clearPasswordRecovery: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    // Get initial session with timeout fallback
    const timeout = setTimeout(() => {
      // If getSession hangs for 3s, assume no session
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(timeout);
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      // Register push token on sign in or sign up
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && s?.user?.id) {
        registerPushOnAuth(s.user.id);
      }
    });

    // Handle deep links (password reset, OAuth callbacks)
    const handleDeepLink = async (url: string) => {
      if (!url) return;

      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let type: string | null = null;

      // Try hash fragment first (Supabase default format)
      const hashIdx = url.indexOf('#');
      if (hashIdx !== -1) {
        const params = new URLSearchParams(url.substring(hashIdx + 1));
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
        type = params.get('type');
      }

      // Fallback: try query params
      if (!accessToken) {
        const qIdx = url.indexOf('?');
        if (qIdx !== -1) {
          const params = new URLSearchParams(url.substring(qIdx + 1));
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
          type = params.get('type');
        }
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (type === 'recovery') {
          setPasswordRecovery(true);
        }
      } else if (url.includes('reset-password') || url.includes('type=recovery')) {
        // URL opened but no tokens yet — might be a redirect in progress
        // Force check for recovery state
        setPasswordRecovery(true);
      }
    };

    // Check if app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for deep links while app is running
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => { subscription.unsubscribe(); linkSub.remove(); clearTimeout(timeout); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setPasswordRecovery(false);
    return { error };
  };

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{ user, session, loading, passwordRecovery, signOut, updatePassword, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
