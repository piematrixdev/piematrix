/**
 * SupportConfigPanel — Edit support & feedback form options.
 * Manages categories, purchase sources shown in the mobile app.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface Config {
  feedback_categories: string[];
  support_categories: string[];
  purchase_sources: string[];
}

const DEFAULTS: Config = {
  feedback_categories: ['General', 'Bug Report', 'Feature Request', 'UI/UX', 'Performance'],
  support_categories: ['General', 'Telescope', 'Binoculars', 'Delivery', 'Purchase', 'Demo'],
  purchase_sources: ['Amazon', 'Website', 'Flipkart', 'Other'],
};

export default function SupportConfigPanel() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable as comma-separated strings
  const [feedbackInput, setFeedbackInput] = useState('');
  const [supportInput, setSupportInput] = useState('');
  const [sourcesInput, setSourcesInput] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('support_config').select('*').maybeSingle();
      if (data) {
        setConfig(data);
        setFeedbackInput(data.feedback_categories.join(', '));
        setSupportInput(data.support_categories.join(', '));
        setSourcesInput(data.purchase_sources.join(', '));
      } else {
        setFeedbackInput(DEFAULTS.feedback_categories.join(', '));
        setSupportInput(DEFAULTS.support_categories.join(', '));
        setSourcesInput(DEFAULTS.purchase_sources.join(', '));
      }
      if (error) setError(error.message);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload = {
      id: 1,
      feedback_categories: feedbackInput.split(',').map(s => s.trim()).filter(Boolean),
      support_categories: supportInput.split(',').map(s => s.trim()).filter(Boolean),
      purchase_sources: sourcesInput.split(',').map(s => s.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('support_config').upsert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div style={styles.muted}>Loading…</div>;

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Support & Feedback Config</h2>
          <p style={styles.sub}>Edit the categories and options shown in the mobile app's support form. Changes are live immediately.</p>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {saved && <div style={styles.success}>Saved successfully ✓</div>}

      <div style={styles.formGrid}>
        <Field label="Feedback Categories (comma separated)">
          <input
            style={ui.input}
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder="General, Bug Report, Feature Request..."
          />
          <div style={styles.hint}>These appear as selectable chips on the Feedback tab</div>
        </Field>

        <Field label="Support Categories (comma separated)">
          <input
            style={ui.input}
            value={supportInput}
            onChange={(e) => setSupportInput(e.target.value)}
            placeholder="General, Telescope, Binoculars, Delivery..."
          />
          <div style={styles.hint}>These appear as selectable chips on the Support tab</div>
        </Field>

        <Field label="Purchase Sources (comma separated)">
          <input
            style={ui.input}
            value={sourcesInput}
            onChange={(e) => setSourcesInput(e.target.value)}
            placeholder="Amazon, Website, Flipkart, Other..."
          />
          <div style={styles.hint}>Users select where they bought the product</div>
        </Field>

        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <button style={ui.primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={styles.preview}>
        <div style={styles.previewTitle}>Preview</div>
        <div style={styles.previewSection}>
          <span style={styles.previewLabel}>Feedback categories:</span>
          <div style={styles.chipPreview}>
            {feedbackInput.split(',').map(s => s.trim()).filter(Boolean).map(c => (
              <span key={c} style={styles.previewChip}>{c}</span>
            ))}
          </div>
        </div>
        <div style={styles.previewSection}>
          <span style={styles.previewLabel}>Support categories:</span>
          <div style={styles.chipPreview}>
            {supportInput.split(',').map(s => s.trim()).filter(Boolean).map(c => (
              <span key={c} style={styles.previewChip}>{c}</span>
            ))}
          </div>
        </div>
        <div style={styles.previewSection}>
          <span style={styles.previewLabel}>Purchase sources:</span>
          <div style={styles.chipPreview}>
            {sourcesInput.split(',').map(s => s.trim()).filter(Boolean).map(c => (
              <span key={c} style={styles.previewChip}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 18 }}><label style={ui.label}>{label}</label>{children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  head: { marginBottom: 24 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0', maxWidth: 520 },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 },
  success: { background: C.greenSoft, border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '10px 14px', color: C.green, fontSize: 13, marginBottom: 16 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 4 },
  hint: { color: C.textFaint, fontSize: 11, marginTop: 6 },
  preview: { marginTop: 32, padding: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 },
  previewTitle: { color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  previewSection: { marginBottom: 14 },
  previewLabel: { color: C.textFaint, fontSize: 12, display: 'block', marginBottom: 6 },
  chipPreview: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  previewChip: { background: 'rgba(212,197,160,0.12)', border: '1px solid rgba(212,197,160,0.25)', borderRadius: 14, padding: '4px 12px', color: C.gold, fontSize: 12 },
};
