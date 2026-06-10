/**
 * SkyCalendarPanel — CRUD for sky calendar events (conjunctions, retrogrades,
 * eclipses, meteor showers, sign ingresses, etc.)
 * These show as color-coded dots in the mobile app's calendar.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface SkyCalEvent {
  id: string;
  date: string;
  type: string;
  label: string;
  color: string;
  priority: number;
  active: boolean;
  created_at: string;
}

type Draft = Omit<SkyCalEvent, 'id' | 'created_at'>;

const EVENT_TYPES = [
  'conjunction',
  'opposition',
  'elongation',
  'retrograde',
  'sign_ingress',
  'eclipse',
  'meteor_shower',
  'equinox',
  'solstice',
  'supermoon',
  'planet_alignment',
  'comet',
  'transit',
  'full_moon',
  'new_moon',
  'custom',
];

const TYPE_COLORS: Record<string, string> = {
  conjunction: '#f472b6',
  opposition: '#f97316',
  elongation: '#06b6d4',
  retrograde: '#f43f5e',
  sign_ingress: '#8b5cf6',
  eclipse: '#ef4444',
  meteor_shower: '#4ade80',
  equinox: '#22d3ee',
  solstice: '#eab308',
  supermoon: '#fcd34d',
  planet_alignment: '#818cf8',
  comet: '#2dd4bf',
  transit: '#fb923c',
  full_moon: '#fbbf24',
  new_moon: '#a78bfa',
  custom: '#d4c5a0',
};

const EMPTY_DRAFT: Draft = {
  date: '',
  type: 'conjunction',
  label: '',
  color: TYPE_COLORS.conjunction,
  priority: 1,
  active: true,
};

export default function SkyCalendarPanel() {
  const [events, setEvents] = useState<SkyCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SkyCalEvent | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = async () => {
    setLoading(true);
    const [y, m] = filterMonth.split('-').map(Number);
    const startOfMonth = `${filterMonth}-01`;
    // Get actual last day of the month
    const lastDay = new Date(y, m, 0).getDate();
    const endOfMonth = `${filterMonth}-${String(lastDay).padStart(2, '0')}`;
    const { data, error } = await supabase
      .from('sky_calendar_events')
      .select('*')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: true })
      .order('priority', { ascending: true });
    if (error) setError(error.message);
    else setEvents((data as SkyCalEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterMonth]);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, date: `${filterMonth}-01` });
    setEditing('new');
  };

  const openEdit = (e: SkyCalEvent) => {
    setDraft({
      date: e.date,
      type: e.type,
      label: e.label,
      color: e.color,
      priority: e.priority,
      active: e.active,
    });
    setEditing(e);
  };

  const save = async () => {
    if (!draft.label.trim() || !draft.date) {
      setError('Date and label are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      date: draft.date,
      type: draft.type,
      label: draft.label.trim(),
      color: draft.color || TYPE_COLORS[draft.type] || '#d4c5a0',
      priority: draft.priority,
      active: draft.active,
    };
    const res = editing === 'new'
      ? await supabase.from('sky_calendar_events').insert(payload)
      : await supabase.from('sky_calendar_events').update(payload).eq('id', (editing as SkyCalEvent).id);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (e: SkyCalEvent) => {
    if (!window.confirm(`Delete "${e.label}" on ${e.date}?`)) return;
    await supabase.from('sky_calendar_events').delete().eq('id', e.id);
    load();
  };

  const duplicate = (e: SkyCalEvent) => {
    setDraft({
      date: e.date,
      type: e.type,
      label: e.label,
      color: e.color,
      priority: e.priority,
      active: true,
    });
    setEditing('new');
  };

  const toggleActive = async (e: SkyCalEvent) => {
    await supabase.from('sky_calendar_events').update({ active: !e.active }).eq('id', e.id);
    load();
  };

  // Navigate months
  const prevMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = (() => {
    const [y, m] = filterMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Sky Calendar Events</h2>
          <p style={styles.sub}>Manage astronomical events shown as colored dots in the app calendar. Conjunctions, retrogrades, eclipses, meteor showers, and more.</p>
        </div>
        <button style={ui.primaryBtn} onClick={openNew}>+ Add event</button>
      </div>

      {/* Month navigation */}
      <div style={styles.monthNav}>
        <button style={ui.ghostBtn} onClick={prevMonth}>← Prev</button>
        <span style={styles.monthLabel}>{monthLabel}</span>
        <button style={ui.ghostBtn} onClick={nextMonth}>Next →</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={styles.empty}>No sky events for {monthLabel}. Add some!</div>
      ) : (
        <div style={styles.list}>
          {events.map((e) => (
            <div key={e.id} style={styles.eventRow}>
              <div style={{ ...styles.colorDot, backgroundColor: e.color }} />
              <div style={{ flex: 1 }}>
                <div style={styles.eventLabel}>{e.label}</div>
                <div style={styles.eventMeta}>
                  {e.date} · {e.type.replace(/_/g, ' ')}
                  {!e.active && ' · hidden'}
                </div>
              </div>
              <div style={styles.eventActions}>
                {!e.active && <span style={styles.hiddenTag}>Hidden</span>}
                <button style={ui.ghostBtn} onClick={() => duplicate(e)}>Copy</button>
                <button style={ui.ghostBtn} onClick={() => openEdit(e)}>Edit</button>
                <button style={ui.ghostBtn} onClick={() => toggleActive(e)}>{e.active ? 'Hide' : 'Show'}</button>
                <button style={ui.dangerBtn} onClick={() => remove(e)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Color legend */}
      <div style={styles.legendSection}>
        <div style={styles.legendTitle}>Event Type Colors</div>
        <div style={styles.legendGrid}>
          {EVENT_TYPES.map(t => (
            <div key={t} style={styles.legendItem}>
              <div style={{ ...styles.legendDot, backgroundColor: TYPE_COLORS[t] }} />
              <span style={styles.legendText}>{t.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit modal */}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => !saving && setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editing === 'new' ? 'New Sky Event' : 'Edit Sky Event'}</h3>
            <div style={styles.formGrid}>
              <Field label="Date">
                <input
                  style={ui.input}
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </Field>
              <Field label="Label (what users see)">
                <input
                  style={ui.input}
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="e.g. Venus conjunct Jupiter in Cancer"
                />
              </Field>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Type" style={{ flex: 1 }}>
                  <select
                    style={{ ...ui.input, cursor: 'pointer' }}
                    value={draft.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setDraft({
                        ...draft,
                        type: newType,
                        color: TYPE_COLORS[newType] || draft.color,
                      });
                    }}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority" style={{ width: 100 }}>
                  <input
                    style={ui.input}
                    type="number"
                    min={1}
                    max={10}
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value) || 1 })}
                  />
                </Field>
              </div>
              <Field label="Dot color (hex)">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    style={{ width: 44, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                  />
                  <input
                    style={{ ...ui.input, flex: 1 }}
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    placeholder="#f472b6"
                  />
                  <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: draft.color, border: '2px solid rgba(255,255,255,0.1)' }} />
                </div>
              </Field>
              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                <span>Active (visible in app)</span>
              </label>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.modalActions}>
              <button style={ui.ghostBtn} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button style={ui.primaryBtn} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={style}><label style={ui.label}>{label}</label>{children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0', maxWidth: 520 },
  monthNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  monthLabel: { color: C.text, fontSize: 16, fontWeight: 700, fontFamily: FONT_TITLE, minWidth: 160, textAlign: 'center' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  empty: { color: C.textFaint, fontSize: 14, padding: 40, textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 14 },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  eventRow: { display: 'flex', alignItems: 'center', gap: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' },
  colorDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  eventLabel: { color: C.text, fontSize: 14, fontWeight: 600 },
  eventMeta: { color: C.textFaint, fontSize: 12, marginTop: 2 },
  eventActions: { display: 'flex', gap: 6, alignItems: 'center' },
  hiddenTag: { fontSize: 10, fontWeight: 700, color: C.textFaint, border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px' },
  legendSection: { marginTop: 32, padding: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 },
  legendTitle: { color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  legendGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: C.textDim, fontSize: 12, textTransform: 'capitalize' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 },
  modal: { background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 500, maxHeight: '88vh', overflowY: 'auto' },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: '0 0 20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, fontSize: 14, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
};
