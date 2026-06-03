/**
 * HeroImagesPanel — CRUD for the home-screen hero background images.
 * Backed by public.hero_images (admin writes enforced by RLS).
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';
import ImageInput from '../ImageInput';

interface HeroImage {
  id: string;
  image_url: string;
  title: string | null;
  priority: number;
  active: boolean;
}

type Draft = Omit<HeroImage, 'id'>;

const EMPTY_DRAFT: Draft = { image_url: '', title: '', priority: 0, active: true };

export default function HeroImagesPanel() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HeroImage | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('hero_images')
      .select('*')
      .order('priority', { ascending: true });
    if (error) setError(error.message);
    else setImages((data as HeroImage[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, priority: (images.at(-1)?.priority ?? 0) + 1 });
    setEditing('new');
  };

  const openEdit = (h: HeroImage) => {
    setDraft({ image_url: h.image_url, title: h.title ?? '', priority: h.priority, active: h.active });
    setEditing(h);
  };

  const save = async () => {
    if (!draft.image_url.trim()) {
      setError('Image URL is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...draft, title: draft.title?.trim() || null };
    const res =
      editing === 'new'
        ? await supabase.from('hero_images').insert(payload)
        : await supabase.from('hero_images').update(payload).eq('id', (editing as HeroImage).id);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEditing(null);
    load();
  };

  const remove = async (h: HeroImage) => {
    if (!window.confirm(`Delete this hero image${h.title ? ` ("${h.title}")` : ''}?`)) return;
    const { error } = await supabase.from('hero_images').delete().eq('id', h.id);
    if (error) setError(error.message);
    else load();
  };

  const toggleActive = async (h: HeroImage) => {
    const { error } = await supabase.from('hero_images').update({ active: !h.active }).eq('id', h.id);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Hero Images</h2>
          <p style={styles.sub}>Full-bleed background images shown at the top of the app home screen.</p>
        </div>
        <button style={ui.primaryBtn} onClick={openNew}>+ New image</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : images.length === 0 ? (
        <div style={styles.empty}>No hero images yet.</div>
      ) : (
        <div style={styles.grid}>
          {images.map((h) => (
            <div key={h.id} style={styles.card}>
              <div style={styles.thumbWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.image_url} alt={h.title ?? 'hero'} style={styles.thumb} />
                {!h.active && <div style={styles.inactiveTag}>Hidden</div>}
                <div style={styles.priorityTag}>#{h.priority}</div>
              </div>
              <div style={{ padding: 12 }}>
                <div style={styles.title}>{h.title || 'Untitled'}</div>
                <div style={styles.cardActions}>
                  <button style={ui.ghostBtn} onClick={() => openEdit(h)}>Edit</button>
                  <button style={ui.ghostBtn} onClick={() => toggleActive(h)}>
                    {h.active ? 'Hide' : 'Show'}
                  </button>
                  <button style={ui.dangerBtn} onClick={() => remove(h)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={styles.modalOverlay} onClick={() => !saving && setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editing === 'new' ? 'New hero image' : 'Edit hero image'}</h3>
            <div style={styles.formGrid}>
              <div>
                <label style={ui.label}>Image</label>
                <ImageInput
                  value={draft.image_url}
                  onChange={(url) => setDraft({ ...draft, image_url: url })}
                  folder="heroes"
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={ui.label}>Title (admin reference)</label>
                  <input
                    style={ui.input}
                    value={draft.title ?? ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div style={{ width: 110 }}>
                  <label style={ui.label}>Priority</label>
                  <input
                    style={ui.input}
                    type="number"
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value || '0', 10) })}
                  />
                </div>
              </div>
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
              <button style={ui.primaryBtn} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save image'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' },
  thumbWrap: { position: 'relative', height: 140, background: '#000' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' },
  inactiveTag: {
    position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)',
    color: C.textDim, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
  },
  priorityTag: {
    position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)',
    color: C.gold, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
  },
  title: { color: C.text, fontSize: 14, fontWeight: 600 },
  cardActions: { display: 'flex', gap: 8, marginTop: 12 },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
  },
  modal: {
    background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28,
    width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto',
  },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: '0 0 20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, fontSize: 14, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
};
