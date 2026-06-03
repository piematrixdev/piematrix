/**
 * ContentPanel — edit the mobile app's copy (public.app_content).
 *
 * Loads every content row, groups them, and lets admins edit values
 * inline. Only changed rows are saved. New keys can be added too.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface ContentRow {
  key: string;
  value: string;
  group: string;
  label: string | null;
  description: string | null;
  multiline: boolean;
  updated_at: string;
}

export default function ContentPanel() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('app_content')
      .select('*')
      .order('group', { ascending: true })
      .order('key', { ascending: true });
    if (error) setError(error.message);
    else {
      setRows((data as ContentRow[]) ?? []);
      setEdits({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        (r.label ?? '').toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const groups = useMemo(() => {
    const map: Record<string, ContentRow[]> = {};
    for (const r of filtered) (map[r.group] ||= []).push(r);
    return map;
  }, [filtered]);

  const valueOf = (r: ContentRow) => (r.key in edits ? edits[r.key] : r.value);
  const isDirty = (r: ContentRow) => r.key in edits && edits[r.key] !== r.value;

  const save = async (r: ContentRow) => {
    setSavingKey(r.key);
    setError(null);
    const { error } = await supabase
      .from('app_content')
      .update({ value: valueOf(r) })
      .eq('key', r.key);
    setSavingKey(null);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, value: valueOf(r) ?? '' } : x)));
    setEdits((prev) => {
      const next = { ...prev };
      delete next[r.key];
      return next;
    });
    setSavedKey(r.key);
    setTimeout(() => setSavedKey((k) => (k === r.key ? null : k)), 1500);
  };

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Content</h2>
          <p style={styles.sub}>
            Edit the text shown throughout the mobile app. Changes appear on next app launch.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={ui.ghostBtn} onClick={load}>Refresh</button>
          <button style={ui.primaryBtn} onClick={() => setShowNew(true)}>+ New key</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <input
        style={{ ...ui.input, marginBottom: 22 }}
        placeholder="Search keys, labels, or values…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={styles.empty}>
          No content rows. Run <code style={styles.code}>supabase/admin-content.sql</code> to seed defaults.
        </div>
      ) : (
        Object.entries(groups).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 28 }}>
            <div style={styles.groupTitle}>{group}</div>
            <div style={styles.groupCard}>
              {items.map((r) => (
                <div key={r.key} style={styles.row}>
                  <div style={styles.rowMeta}>
                    <div style={styles.rowLabel}>{r.label || r.key}</div>
                    <div style={styles.rowKey}>{r.key}</div>
                    {r.description && <div style={styles.rowDesc}>{r.description}</div>}
                  </div>
                  <div style={styles.rowField}>
                    {r.multiline ? (
                      <textarea
                        style={{ ...ui.input, minHeight: 76, resize: 'vertical', fontFamily: 'inherit' }}
                        value={valueOf(r)}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        style={ui.input}
                        value={valueOf(r)}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.key]: e.target.value }))}
                      />
                    )}
                    <div style={styles.rowActions}>
                      {savedKey === r.key && <span style={styles.saved}>✓ Saved</span>}
                      {isDirty(r) && (
                        <>
                          <button
                            style={ui.ghostBtn}
                            onClick={() =>
                              setEdits((p) => {
                                const n = { ...p };
                                delete n[r.key];
                                return n;
                              })
                            }
                          >
                            Reset
                          </button>
                          <button
                            style={ui.primaryBtn}
                            onClick={() => save(r)}
                            disabled={savingKey === r.key}
                          >
                            {savingKey === r.key ? 'Saving…' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showNew && <NewKeyModal onClose={() => setShowNew(false)} onCreated={load} existing={rows.map((r) => r.key)} />}
    </div>
  );
}

function NewKeyModal({
  onClose,
  onCreated,
  existing,
}: {
  onClose: () => void;
  onCreated: () => void;
  existing: string[];
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [group, setGroup] = useState('general');
  const [label, setLabel] = useState('');
  const [multiline, setMultiline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const k = key.trim();
    if (!k) {
      setError('Key is required.');
      return;
    }
    if (existing.includes(k)) {
      setError('That key already exists.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('app_content').insert({
      key: k,
      value,
      group: group.trim() || 'general',
      label: label.trim() || null,
      multiline,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={() => !saving && onClose()}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>New content key</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={ui.label}>Key</label>
            <input
              style={ui.input}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. home.hero.title_night"
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={ui.label}>Group</label>
              <input style={ui.input} value={group} onChange={(e) => setGroup(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={ui.label}>Label</label>
              <input style={ui.input} value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Value</label>
            {multiline ? (
              <textarea
                style={{ ...ui.input, minHeight: 76, resize: 'vertical', fontFamily: 'inherit' }}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <input style={ui.input} value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </div>
          <label style={styles.checkRow}>
            <input type="checkbox" checked={multiline} onChange={(e) => setMultiline(e.target.checked)} />
            <span>Multiline (long text)</span>
          </label>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.modalActions}>
          <button style={ui.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={ui.primaryBtn} onClick={create} disabled={saving}>
            {saving ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </div>
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
  code: { background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 5, fontSize: 12 },
  error: {
    background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
    padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16,
  },
  groupTitle: {
    color: C.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10, marginLeft: 2,
  },
  groupCard: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '230px 1fr',
    gap: 18,
    padding: 16,
    borderBottom: `1px solid ${C.borderSoft}`,
    alignItems: 'start',
  },
  rowMeta: { paddingTop: 4 },
  rowLabel: { color: C.text, fontSize: 14, fontWeight: 600 },
  rowKey: { color: C.textFaint, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  rowDesc: { color: C.textFaint, fontSize: 12, marginTop: 6, lineHeight: 1.4 },
  rowField: { display: 'flex', flexDirection: 'column', gap: 8 },
  rowActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, minHeight: 4 },
  saved: { color: C.green, fontSize: 13, fontWeight: 600 },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
  },
  modal: {
    background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28,
    width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto',
  },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: '0 0 20px' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, fontSize: 14, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
};
