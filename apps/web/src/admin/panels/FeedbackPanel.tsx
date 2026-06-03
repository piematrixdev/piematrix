/**
 * FeedbackPanel — read-only view of user feedback submissions.
 * Backed by public.feedback (admin read enforced by RLS).
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface Feedback {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string | null;
  rating: number | null;
  message: string;
  app_version: string | null;
  device_info: string | null;
  created_at: string;
}

export default function FeedbackPanel() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) setError(error.message);
    else setItems((data as Feedback[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return ['all', ...Array.from(set)];
  }, [items]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);

  const avgRating = useMemo(() => {
    const rated = items.filter((i) => typeof i.rating === 'number');
    if (rated.length === 0) return null;
    return (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1);
  }, [items]);

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Feedback</h2>
          <p style={styles.sub}>
            {items.length} submission{items.length === 1 ? '' : 's'}
            {avgRating ? ` · avg rating ${avgRating}★` : ''}
          </p>
        </div>
        <button style={ui.ghostBtn} onClick={load}>Refresh</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.filterRow}>
        {categories.map((c) => (
          <button
            key={c}
            style={{
              ...styles.chip,
              ...(filter === c ? styles.chipActive : {}),
            }}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>No feedback{filter !== 'all' ? ` in "${filter}"` : ''} yet.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map((f) => (
            <div key={f.id} style={styles.item}>
              <div style={styles.itemHead}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {f.category && <span style={styles.catBadge}>{f.category}</span>}
                  {typeof f.rating === 'number' && (
                    <span style={styles.rating}>{'★'.repeat(f.rating)}{'☆'.repeat(Math.max(0, 5 - f.rating))}</span>
                  )}
                </div>
                <span style={styles.date}>
                  {new Date(f.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <p style={styles.message}>{f.message}</p>
              <div style={styles.meta}>
                {f.email && <span>{f.email}</span>}
                {f.app_version && <span>v{f.app_version}</span>}
                {f.device_info && <span>{f.device_info}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  empty: {
    color: C.textFaint, fontSize: 14, padding: 40, textAlign: 'center',
    border: `1px dashed ${C.border}`, borderRadius: 14,
  },
  error: {
    background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
    padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16,
  },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
    padding: '6px 14px', color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  chipActive: { background: C.goldSoft, borderColor: C.gold, color: C.gold },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  item: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 },
  itemHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: {
    background: C.goldSoft, color: C.gold, fontSize: 11, fontWeight: 700,
    padding: '3px 9px', borderRadius: 6, textTransform: 'capitalize',
  },
  rating: { color: C.amber, fontSize: 13, letterSpacing: 1 },
  date: { color: C.textFaint, fontSize: 12 },
  message: { color: C.text, fontSize: 14, lineHeight: 1.5, margin: '0 0 10px', whiteSpace: 'pre-wrap' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: 14, color: C.textFaint, fontSize: 12 },
};
