/**
 * PromoBannersPanel — CRUD for the home-screen promo banner carousel.
 * Backed by public.promo_banners (admin writes enforced by RLS).
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';
import ImageInput from '../ImageInput';

interface Banner {
  id: string;
  image_url: string;
  title: string;
  subtitle: string | null;
  link_type: string | null;
  link_target: string | null;
  priority: number;
  active: boolean;
}

type Draft = Omit<Banner, 'id'>;

const EMPTY_DRAFT: Draft = {
  image_url: '',
  title: '',
  subtitle: '',
  link_type: 'screen',
  link_target: '',
  priority: 0,
  active: true,
};

const SCREEN_TARGETS = ['skywatch', 'shop', 'telescope', 'calendar', 'support'];

export default function PromoBannersPanel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('promo_banners')
      .select('*')
      .order('priority', { ascending: true });
    if (error) setError(error.message);
    else setBanners((data as Banner[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, priority: (banners.at(-1)?.priority ?? 0) + 1 });
    setEditing('new');
  };

  const openEdit = (b: Banner) => {
    setDraft({
      image_url: b.image_url,
      title: b.title,
      subtitle: b.subtitle ?? '',
      link_type: b.link_type ?? 'screen',
      link_target: b.link_target ?? '',
      priority: b.priority,
      active: b.active,
    });
    setEditing(b);
  };

  const save = async () => {
    if (!draft.image_url.trim() || !draft.title.trim()) {
      setError('Image URL and title are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...draft, subtitle: draft.subtitle?.trim() || null };
    const res =
      editing === 'new'
        ? await supabase.from('promo_banners').insert(payload)
        : await supabase.from('promo_banners').update(payload).eq('id', (editing as Banner).id);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEditing(null);
    load();
  };

  const remove = async (b: Banner) => {
    if (!window.confirm(`Delete banner "${b.title}"? This can't be undone.`)) return;
    const { error } = await supabase.from('promo_banners').delete().eq('id', b.id);
    if (error) setError(error.message);
    else load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase
      .from('promo_banners')
      .update({ active: !b.active })
      .eq('id', b.id);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Promo Banners</h2>
          <p style={styles.sub}>The carousel on the app home screen. Lower priority shows first.</p>
        </div>
        <button style={ui.primaryBtn} onClick={openNew}>+ New banner</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : banners.length === 0 ? (
        <div style={styles.empty}>No banners yet. Create your first one.</div>
      ) : (
        <div style={styles.grid}>
          {banners.map((b) => (
            <div key={b.id} style={styles.bannerCard}>
              <div style={styles.thumbWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image_url} alt={b.title} style={styles.thumb} />
                {!b.active && <div style={styles.inactiveTag}>Hidden</div>}
                <div style={styles.priorityTag}>#{b.priority}</div>
              </div>
              <div style={{ padding: 14 }}>
                <div style={styles.bannerTitle}>{b.title}</div>
                {b.subtitle && <div style={styles.bannerSub}>{b.subtitle}</div>}
                <div style={styles.linkRow}>
                  <span style={styles.linkBadge}>
                    {b.link_type ?? 'none'}{b.link_target ? ` → ${b.link_target}` : ''}
                  </span>
                </div>
                <div style={styles.cardActions}>
                  <button style={ui.ghostBtn} onClick={() => openEdit(b)}>Edit</button>
                  <button style={ui.ghostBtn} onClick={() => toggleActive(b)}>
                    {b.active ? 'Hide' : 'Show'}
                  </button>
                  <button style={ui.dangerBtn} onClick={() => remove(b)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={styles.modalOverlay} onClick={() => !saving && setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {editing === 'new' ? 'New banner' : 'Edit banner'}
            </h3>
            <div style={styles.formGrid}>
              <Field label="Image">
                <ImageInput
                  value={draft.image_url}
                  onChange={(url) => setDraft({ ...draft, image_url: url })}
                  folder="banners"
                />
              </Field>
              <Field label="Title">
                <input
                  style={ui.input}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="Subtitle">
                <input
                  style={ui.input}
                  value={draft.subtitle ?? ''}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                />
              </Field>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Link type" style={{ flex: 1 }}>
                  <select
                    style={{ ...ui.input, cursor: 'pointer' }}
                    value={draft.link_type ?? 'screen'}
                    onChange={(e) => setDraft({ ...draft, link_type: e.target.value })}
                  >
                    <option value="screen">screen</option>
                    <option value="url">url</option>
                    <option value="none">none</option>
                  </select>
                </Field>
                <Field label="Priority" style={{ width: 110 }}>
                  <input
                    style={ui.input}
                    type="number"
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({ ...draft, priority: parseInt(e.target.value || '0', 10) })
                    }
                  />
                </Field>
              </div>
              {draft.link_type !== 'none' && (
                <Field label={draft.link_type === 'screen' ? 'Target screen' : 'Target URL'}>
                  {draft.link_type === 'screen' ? (
                    <select
                      style={{ ...ui.input, cursor: 'pointer' }}
                      value={draft.link_target ?? ''}
                      onChange={(e) => setDraft({ ...draft, link_target: e.target.value })}
                    >
                      <option value="">— select —</option>
                      {SCREEN_TARGETS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={ui.input}
                      value={draft.link_target ?? ''}
                      onChange={(e) => setDraft({ ...draft, link_target: e.target.value })}
                      placeholder="https://…"
                    />
                  )}
                </Field>
              )}
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
              <button style={ui.ghostBtn} onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button style={ui.primaryBtn} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={ui.label}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  empty: {
    color: C.textFaint,
    fontSize: 14,
    padding: 40,
    textAlign: 'center',
    border: `1px dashed ${C.border}`,
    borderRadius: 14,
  },
  error: {
    background: C.redSoft,
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    color: C.red,
    fontSize: 13,
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  bannerCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumbWrap: { position: 'relative', height: 150, background: '#000' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' },
  inactiveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(0,0,0,0.7)',
    color: C.textDim,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
  },
  priorityTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: 'rgba(0,0,0,0.7)',
    color: C.gold,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
  },
  bannerTitle: { color: C.text, fontSize: 15, fontWeight: 700 },
  bannerSub: { color: C.textDim, fontSize: 13, marginTop: 2 },
  linkRow: { marginTop: 10 },
  linkBadge: {
    display: 'inline-block',
    background: C.goldSoft,
    color: C.gold,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
  },
  cardActions: { display: 'flex', gap: 8, marginTop: 14 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24,
  },
  modal: {
    background: C.bgPanel,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 28,
    width: '100%',
    maxWidth: 460,
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: '0 0 20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, fontSize: 14, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
};
