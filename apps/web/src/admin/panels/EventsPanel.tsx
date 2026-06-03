/**
 * EventsPanel — CRUD for events/activities that users can RSVP to.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string | null;
  location_url: string | null;
  image_url: string | null;
  type: string;
  max_capacity: number | null;
  price: number;
  currency: string;
  is_online: boolean;
  active: boolean;
}

interface RSVP {
  id: string;
  user_id: string;
  status: string;
  pass_code: string;
  registered_at: string;
}

type Draft = Omit<Event, 'id'>;

const EMPTY_DRAFT: Draft = {
  title: '',
  description: '',
  event_date: '',
  end_date: '',
  location: '',
  location_url: '',
  image_url: '',
  type: 'stargazing',
  max_capacity: null,
  price: 0,
  currency: 'INR',
  is_online: false,
  active: true,
};

const EVENT_TYPES = ['stargazing', 'workshop', 'webinar', 'meetup', 'launch', 'observation', 'other'];

export default function EventsPanel() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Event | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [viewRsvps, setViewRsvps] = useState<{ event: Event; rsvps: RSVP[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });
    if (error) setError(error.message);
    else setEvents((data as Event[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT });
    setEditing('new');
  };

  const openEdit = (e: Event) => {
    setDraft({
      title: e.title,
      description: e.description ?? '',
      event_date: e.event_date ? new Date(e.event_date).toISOString().slice(0, 16) : '',
      end_date: e.end_date ? new Date(e.end_date).toISOString().slice(0, 16) : '',
      location: e.location ?? '',
      location_url: e.location_url ?? '',
      image_url: e.image_url ?? '',
      type: e.type,
      max_capacity: e.max_capacity,
      price: e.price,
      currency: e.currency,
      is_online: e.is_online,
      active: e.active,
    });
    setEditing(e);
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.event_date) {
      setError('Title and date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      ...draft,
      description: draft.description?.trim() || null,
      location: draft.location?.trim() || null,
      location_url: draft.location_url?.trim() || null,
      image_url: draft.image_url?.trim() || null,
      end_date: draft.end_date || null,
      max_capacity: draft.max_capacity || null,
    };
    const res = editing === 'new'
      ? await supabase.from('events').insert(payload)
      : await supabase.from('events').update(payload).eq('id', (editing as Event).id);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (e: Event) => {
    if (!window.confirm(`Delete "${e.title}"? All RSVPs will be lost.`)) return;
    await supabase.from('events').delete().eq('id', e.id);
    load();
  };

  const toggleActive = async (e: Event) => {
    await supabase.from('events').update({ active: !e.active }).eq('id', e.id);
    load();
  };

  const loadRsvps = async (e: Event) => {
    const { data } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', e.id)
      .order('registered_at', { ascending: false });
    setViewRsvps({ event: e, rsvps: (data as RSVP[]) ?? [] });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Events & Activities</h2>
          <p style={styles.sub}>Create events users can RSVP to. Manage registrations and passes.</p>
        </div>
        <button style={ui.primaryBtn} onClick={openNew}>+ New event</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={styles.empty}>No events yet. Create your first one.</div>
      ) : (
        <div style={styles.list}>
          {events.map((e) => (
            <div key={e.id} style={styles.eventRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.eventTitle}>{e.title}</div>
                <div style={styles.eventMeta}>
                  {formatDate(e.event_date)} · {e.type} · {e.is_online ? 'Online' : e.location ?? 'TBD'}
                  {e.price > 0 && ` · ${e.currency} ${e.price}`}
                </div>
              </div>
              <div style={styles.eventActions}>
                {!e.active && <span style={styles.hiddenTag}>Hidden</span>}
                <button style={ui.ghostBtn} onClick={() => loadRsvps(e)}>RSVPs</button>
                <button style={ui.ghostBtn} onClick={() => openEdit(e)}>Edit</button>
                <button style={ui.ghostBtn} onClick={() => toggleActive(e)}>{e.active ? 'Hide' : 'Show'}</button>
                <button style={ui.dangerBtn} onClick={() => remove(e)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RSVP viewer */}
      {viewRsvps && (
        <div style={styles.modalOverlay} onClick={() => setViewRsvps(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>RSVPs — {viewRsvps.event.title}</h3>
            <p style={styles.sub}>{viewRsvps.rsvps.length} registration(s)</p>
            {viewRsvps.rsvps.length === 0 ? (
              <div style={styles.muted}>No RSVPs yet.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>User ID</th>
                    <th style={styles.th}>Pass Code</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {viewRsvps.rsvps.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.user_id.slice(0, 8)}…</td>
                      <td style={{ ...styles.td, fontWeight: 700, letterSpacing: 1 }}>{r.pass_code.toUpperCase()}</td>
                      <td style={styles.td}>{r.status}</td>
                      <td style={styles.td}>{new Date(r.registered_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={styles.modalActions}>
              <button style={ui.ghostBtn} onClick={() => setViewRsvps(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => !saving && setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editing === 'new' ? 'New Event' : 'Edit Event'}</h3>
            <div style={styles.formGrid}>
              <Field label="Title">
                <input style={ui.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </Field>
              <Field label="Description">
                <textarea style={{ ...ui.input, minHeight: 80, resize: 'vertical' }} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Start date/time" style={{ flex: 1 }}>
                  <input style={ui.input} type="datetime-local" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
                </Field>
                <Field label="End date/time" style={{ flex: 1 }}>
                  <input style={ui.input} type="datetime-local" value={draft.end_date ?? ''} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Type" style={{ flex: 1 }}>
                  <select style={{ ...ui.input, cursor: 'pointer' }} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Max capacity" style={{ width: 120 }}>
                  <input style={ui.input} type="number" value={draft.max_capacity ?? ''} onChange={(e) => setDraft({ ...draft, max_capacity: e.target.value ? parseInt(e.target.value) : null })} placeholder="∞" />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Price" style={{ flex: 1 }}>
                  <input style={ui.input} type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value || '0') })} />
                </Field>
                <Field label="Currency" style={{ width: 100 }}>
                  <input style={ui.input} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
                </Field>
              </div>
              <Field label="Location">
                <input style={ui.input} value={draft.location ?? ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Venue name or 'Online'" />
              </Field>
              <Field label="Image URL">
                <input style={ui.input} value={draft.image_url ?? ''} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://..." />
              </Field>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={styles.checkRow}>
                  <input type="checkbox" checked={draft.is_online} onChange={(e) => setDraft({ ...draft, is_online: e.target.checked })} />
                  <span>Online event</span>
                </label>
                <label style={styles.checkRow}>
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                  <span>Active (visible)</span>
                </label>
              </div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.modalActions}>
              <button style={ui.ghostBtn} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button style={ui.primaryBtn} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save event'}</button>
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
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  empty: { color: C.textFaint, fontSize: 14, padding: 40, textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 14 },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  eventRow: { display: 'flex', alignItems: 'center', gap: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' },
  eventTitle: { color: C.text, fontSize: 15, fontWeight: 700 },
  eventMeta: { color: C.textDim, fontSize: 12, marginTop: 4 },
  eventActions: { display: 'flex', gap: 8, alignItems: 'center' },
  hiddenTag: { fontSize: 10, fontWeight: 700, color: C.textFaint, border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 },
  modal: { background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: '0 0 20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, fontSize: 14, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 12 },
  th: { color: C.textFaint, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${C.border}` },
  td: { color: C.textDim, fontSize: 13, padding: '8px 10px', borderBottom: `1px solid ${C.borderSoft}` },
};
