/**
 * FeatureFlagsPanel — Toggle gated mobile features at runtime.
 *
 * Reads / writes the single-row `feature_flags` table. The mobile app
 * fetches this row on launch and hides UI for any feature that's off.
 *
 * Add new flags here as you add new gated features in the mobile app.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT, FONT_TITLE } from '../adminTheme';

interface Flags {
  ai_chat_enabled: boolean;
}

const DEFAULTS: Flags = {
  ai_chat_enabled: false,
};

interface FlagDef {
  key: keyof Flags;
  title: string;
  description: string;
}

const FLAG_DEFS: FlagDef[] = [
  {
    key: 'ai_chat_enabled',
    title: 'Ask Orion (AI Chat)',
    description:
      'Show the Gemini-powered AI astronomy assistant in the mobile app — entry points on Home and Profile, plus the chat screen itself.',
  },
];

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<Flags>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Flags | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<keyof Flags | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) setError(error.message);
      if (data) setFlags({ ai_chat_enabled: !!data.ai_chat_enabled });
      setLoading(false);
    })();
  }, []);

  const toggle = async (key: keyof Flags) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setSaving(key);
    setError(null);

    const { error } = await supabase
      .from('feature_flags')
      .upsert({ id: 1, [key]: next[key], updated_at: new Date().toISOString() });

    setSaving(null);
    if (error) {
      setError(error.message);
      // Revert on failure.
      setFlags(flags);
      return;
    }
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800);
  };

  if (loading) return <div style={styles.muted}>Loading…</div>;

  return (
    <div>
      <div style={styles.head}>
        <h2 style={styles.h2}>Feature Flags</h2>
        <p style={styles.sub}>
          Toggle gated mobile features. Changes are live on the next app launch — users already in
          the app pick up changes when they reopen it.
        </p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.list}>
        {FLAG_DEFS.map((def) => {
          const on = flags[def.key];
          const isSaving = saving === def.key;
          const justSaved = savedKey === def.key;
          return (
            <div key={def.key} style={styles.row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.rowTitleLine}>
                  <span style={styles.rowTitle}>{def.title}</span>
                  <span style={{ ...styles.statusPill, ...(on ? styles.statusOn : styles.statusOff) }}>
                    {on ? 'Enabled' : 'Disabled'}
                  </span>
                  {justSaved && <span style={styles.savedTag}>Saved ✓</span>}
                </div>
                <div style={styles.rowDesc}>{def.description}</div>
              </div>
              <button
                style={{ ...styles.toggle, ...(on ? styles.toggleOn : styles.toggleOff) }}
                onClick={() => toggle(def.key)}
                disabled={isSaving}
                aria-label={`Toggle ${def.title}`}
              >
                <span style={{ ...styles.knob, ...(on ? styles.knobOn : styles.knobOff) }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  head: { marginBottom: 24 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0', maxWidth: 560 },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  error: {
    background: C.redSoft,
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    color: C.red,
    fontSize: 13,
    marginBottom: 16,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
  },
  rowTitleLine: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: 700, fontFamily: FONT },
  rowDesc: { color: C.textFaint, fontSize: 13, lineHeight: 1.5 },
  statusPill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderRadius: 5,
    padding: '2px 7px',
  },
  statusOn: { background: C.greenSoft, color: C.green, border: '1px solid rgba(74,222,128,0.25)' },
  statusOff: { background: 'rgba(255,255,255,0.04)', color: C.textFaint, border: `1px solid ${C.border}` },
  savedTag: { color: C.green, fontSize: 11, fontWeight: 600 },
  toggle: {
    position: 'relative',
    width: 48,
    height: 28,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s ease',
    padding: 0,
  },
  toggleOn: { background: C.gold },
  toggleOff: { background: 'rgba(255,255,255,0.12)' },
  knob: {
    position: 'absolute',
    top: 3,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#030308',
    transition: 'left 0.15s ease',
  },
  knobOn: { left: 23 },
  knobOff: { left: 3 },
};
