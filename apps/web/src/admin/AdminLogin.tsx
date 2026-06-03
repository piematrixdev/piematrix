/**
 * AdminLogin — email/password sign-in gate for the admin panel.
 * Shown when there is no session, or when the signed-in user is not
 * on the admin allow-list.
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { C, FONT, FONT_TITLE, ui } from './adminTheme';

interface Props {
  /** True when a user is signed in but lacks admin rights. */
  signedInButNotAdmin?: boolean;
  userEmail?: string | null | undefined;
}

export default function AdminLogin({ signedInButNotAdmin, userEmail }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // useAdmin picks up the new session via onAuthStateChange.
    } catch (err: any) {
      setError(err.message ?? 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.logoDot} />
          <span style={styles.brand}>Pie Matrix</span>
        </div>
        <h1 style={styles.title}>Admin Console</h1>

        {signedInButNotAdmin ? (
          <>
            <p style={styles.subtitle}>
              You&apos;re signed in as <strong style={{ color: C.text }}>{userEmail}</strong>,
              but this account doesn&apos;t have admin access.
            </p>
            <p style={styles.hint}>
              Ask an existing admin to add you to the allow-list, then reload.
            </p>
            <button style={{ ...ui.ghostBtn, width: '100%', marginTop: 8 }} onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Sign in with your admin account.</p>
            <form onSubmit={handleSignIn} style={styles.form}>
              <div>
                <label style={ui.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={ui.input}
                  placeholder="you@thepiematrix.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label style={ui.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={ui.input}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <div style={styles.error}>{error}</div>}
              <button type="submit" style={{ ...ui.primaryBtn, width: '100%' }} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
      <span style={styles.footer}>Pie Matrix · SkyWatch Admin</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: C.bg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    padding: 24,
    gap: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: C.bgPanel,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 32,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 },
  logoDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: `linear-gradient(135deg, ${C.gold}, #b89f72)`,
  },
  brand: { color: C.text, fontSize: 16, fontWeight: 700, letterSpacing: -0.2, fontFamily: FONT_TITLE },
  title: { color: C.text, fontSize: 24, fontWeight: 700, margin: '0 0 8px', fontFamily: FONT_TITLE },
  subtitle: { color: C.textDim, fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' },
  hint: { color: C.textFaint, fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  error: {
    background: C.redSoft,
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 8,
    padding: '8px 12px',
    color: C.red,
    fontSize: 13,
  },
  footer: { color: C.textFaint, fontSize: 12 },
};
