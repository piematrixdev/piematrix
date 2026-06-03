/**
 * OverviewPanel — at-a-glance counts pulled from the content tables.
 * Read-only; degrades gracefully if a table is missing or blocked.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, FONT_TITLE } from '../adminTheme';

interface Stat {
  key: string;
  label: string;
  table: string;
  accent: string;
  filter?: { column: string; value: unknown };
}

const STATS: Stat[] = [
  { key: 'banners', label: 'Active banners', table: 'promo_banners', accent: C.gold, filter: { column: 'active', value: true } },
  { key: 'heroes', label: 'Active hero images', table: 'hero_images', accent: C.blue, filter: { column: 'active', value: true } },
  { key: 'feedback', label: 'Feedback submissions', table: 'feedback', accent: C.green },
  { key: 'stars', label: 'Stars in catalog', table: 'stars', accent: C.purple },
];

export default function OverviewPanel({ adminEmail }: { adminEmail?: string | null }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number | null> = {};
      await Promise.all(
        STATS.map(async (s) => {
          try {
            let q = supabase.from(s.table).select('*', { count: 'exact', head: true });
            if (s.filter) q = q.eq(s.filter.column, s.filter.value as any);
            const { count, error } = await q;
            next[s.key] = error ? null : count ?? 0;
          } catch {
            next[s.key] = null;
          }
        })
      );
      if (!cancelled) {
        setCounts(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h2 style={styles.h2}>Overview</h2>
      <p style={styles.sub}>
        Welcome back{adminEmail ? `, ${adminEmail}` : ''}. Here&apos;s the state of your content.
      </p>

      <div style={styles.grid}>
        {STATS.map((s) => (
          <div key={s.key} style={styles.statCard}>
            <div style={{ ...styles.accent, background: s.accent }} />
            <div style={styles.statValue}>
              {loading ? '…' : counts[s.key] === null ? '—' : counts[s.key]?.toLocaleString()}
            </div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.note}>
        <strong style={{ color: C.text }}>Note:</strong> counts reflect what your admin account
        can read under row-level security. A dash (—) means the table isn&apos;t reachable yet —
        check that <code style={styles.code}>supabase/admin-panel.sql</code> has been run.
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  statCard: {
    position: 'relative',
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: '22px 20px',
    overflow: 'hidden',
  },
  accent: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%' },
  statValue: { color: C.text, fontSize: 32, fontWeight: 700, letterSpacing: -1 },
  statLabel: { color: C.textDim, fontSize: 13, marginTop: 4 },
  note: {
    marginTop: 28,
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 16,
    color: C.textDim,
    fontSize: 13,
    lineHeight: 1.6,
  },
  code: { background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 5, fontSize: 12 },
};
