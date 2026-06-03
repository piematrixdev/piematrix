/**
 * PushPanel — Send push notifications to app users from the admin panel.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';

const SCREEN_TARGETS = [
  { value: 'home', label: 'Home' },
  { value: 'skywatch', label: 'Sky View' },
  { value: 'shop', label: 'Shop' },
  { value: 'calendar', label: 'Sky Calendar' },
  { value: 'events', label: 'Events' },
  { value: 'telescope', label: 'Telescope' },
];

export default function PushPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [screen, setScreen] = useState('home');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [recentPushes, setRecentPushes] = useState<any[]>([]);

  useEffect(() => {
    // Get active token count
    supabase.from('push_tokens').select('*', { count: 'exact', head: true }).eq('active', true)
      .then(({ count }) => setTokenCount(count ?? 0));
    // Get recent push logs
    supabase.from('email_logs').select('*').eq('type', 'push-broadcast').order('sent_at', { ascending: false }).limit(10)
      .then(({ data }) => setRecentPushes(data ?? []));
  }, []);

  const sendPush = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ type: 'error', message: 'Title and body are required' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), data: { screen } }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ type: 'success', message: `Sent to ${json.sent} devices (${json.failed} failed)` });
        setTitle('');
        setBody('');
        // Refresh logs
        const { data } = await supabase.from('email_logs').select('*').eq('type', 'push-broadcast').order('sent_at', { ascending: false }).limit(10);
        setRecentPushes(data ?? []);
      } else {
        setResult({ type: 'error', message: json.error ?? 'Failed to send' });
      }
    } catch (e: any) {
      setResult({ type: 'error', message: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2 style={styles.h2}>Push Notifications</h2>
      <p style={styles.sub}>Send push notifications to all app users instantly.</p>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: C.green }}>{tokenCount}</div>
          <div style={styles.statLabel}>Active Devices</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: C.blue }}>{recentPushes.length}</div>
          <div style={styles.statLabel}>Recent Broadcasts</div>
        </div>
      </div>

      {/* Compose */}
      <div style={styles.composeCard}>
        <h3 style={styles.composeTitle}>Compose Notification</h3>

        <div style={styles.formGrid}>
          <div>
            <label style={ui.label}>Title</label>
            <input
              style={ui.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tonight's Sky is Clear"
              maxLength={50}
            />
            <div style={styles.charCount}>{title.length}/50</div>
          </div>

          <div>
            <label style={ui.label}>Body</label>
            <textarea
              style={{ ...ui.input, minHeight: 70, resize: 'vertical' }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Jupiter and Saturn are visible tonight. Open the app to find them!"
              maxLength={150}
            />
            <div style={styles.charCount}>{body.length}/150</div>
          </div>

          <div>
            <label style={ui.label}>Open Screen (on tap)</label>
            <select
              style={{ ...ui.input, cursor: 'pointer' }}
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
            >
              {SCREEN_TARGETS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview */}
        <div style={styles.preview}>
          <div style={styles.previewLabel}>Preview</div>
          <div style={styles.previewCard}>
            <div style={styles.previewIcon} />
            <div>
              <div style={styles.previewTitle}>{title || 'Notification Title'}</div>
              <div style={styles.previewBody}>{body || 'Notification body text...'}</div>
            </div>
          </div>
        </div>

        {result && (
          <div style={result.type === 'success' ? styles.success : styles.error}>
            {result.message}
          </div>
        )}

        <button
          style={{ ...ui.primaryBtn, width: '100%', marginTop: 16, padding: '14px 0' }}
          onClick={sendPush}
          disabled={sending || !title.trim() || !body.trim()}
        >
          {sending ? 'Sending…' : `Send to ${tokenCount} devices`}
        </button>
      </div>

      {/* Recent broadcasts */}
      {recentPushes.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={styles.recentTitle}>Recent Broadcasts</h4>
          <div style={styles.recentList}>
            {recentPushes.map((p) => (
              <div key={p.id} style={styles.recentRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.recentSubject}>{p.subject}</div>
                  <div style={styles.recentMeta}>
                    {p.recipient_email} · {new Date(p.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ ...styles.recentStatus, color: p.status === 'sent' ? C.green : C.amber }}>
                  {p.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 24px' },

  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 },
  statCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 700, letterSpacing: -1 },
  statLabel: { color: C.textFaint, fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  composeCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 },
  composeTitle: { color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 18px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 16 },
  charCount: { color: C.textFaint, fontSize: 11, textAlign: 'right', marginTop: 4 },

  preview: { marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` },
  previewLabel: { color: C.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  previewCard: { display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 },
  previewIcon: { width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${C.gold}, #b89f72)`, flexShrink: 0 },
  previewTitle: { color: C.text, fontSize: 14, fontWeight: 700 },
  previewBody: { color: C.textDim, fontSize: 13, marginTop: 3, lineHeight: 1.4 },

  success: { background: C.greenSoft, border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '12px 16px', color: C.green, fontSize: 13, marginTop: 16 },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13, marginTop: 16 },

  recentTitle: { color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 12px' },
  recentList: { border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' },
  recentRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}` },
  recentSubject: { color: C.text, fontSize: 13, fontWeight: 600 },
  recentMeta: { color: C.textFaint, fontSize: 11, marginTop: 3 },
  recentStatus: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
};
