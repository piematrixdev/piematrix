/**
 * /admin — Pie Matrix admin console.
 *
 * Fully client-side (the web app is a static export, so there are no
 * server routes). Access is gated by Supabase auth + the app_admins
 * allow-list. RLS is the real authority — the client gate is UX only.
 */

import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useAdmin } from '../src/admin/useAdmin';
import { C, FONT } from '../src/admin/adminTheme';

// Auth-dependent UI must not be server-rendered.
const AdminLogin = dynamic(() => import('../src/admin/AdminLogin'), { ssr: false });
const AdminDashboard = dynamic(() => import('../src/admin/AdminDashboard'), { ssr: false });

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  const { user, isAdmin, role, loading } = useAdmin();

  useEffect(() => setMounted(true), []);

  const splash = (label: string) => (
    <div style={styles.splash}>
      <div style={styles.logoDot} />
      <div style={styles.splashText}>{label}</div>
    </div>
  );

  let body: React.ReactNode;
  if (!mounted || loading) {
    body = splash('Loading admin console…');
  } else if (!user) {
    body = <AdminLogin />;
  } else if (!isAdmin) {
    body = <AdminLogin signedInButNotAdmin userEmail={user.email} />;
  } else {
    body = <AdminDashboard email={user.email ?? null} role={role} />;
  }

  return (
    <>
      <Head>
        <title>Pie Matrix · Admin</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.root}>{body}</div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: C.bg, minHeight: '100vh', fontFamily: FONT },
  splash: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: C.bg,
  },
  logoDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${C.gold}, #b89f72)`,
  },
  splashText: { color: C.textFaint, fontSize: 14 },
};
