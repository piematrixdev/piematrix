/**
 * EmailPanel — Email notifications management with send actions and persistent logs.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';

interface EmailLog {
  id: string;
  type: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  metadata: any;
  sent_at: string;
}

type Tab = 'send' | 'logs' | 'config';

export default function EmailPanel() {
  const [tab, setTab] = useState<Tab>('send');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, today: 0 });

  useEffect(() => {
    if (tab === 'logs') loadLogs();
    loadStats();
  }, [tab]);

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);
    setLogs((data as EmailLog[]) ?? []);
    setLogsLoading(false);
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [totalRes, sentRes, failedRes, todayRes] = await Promise.all([
      supabase.from('email_logs').select('*', { count: 'exact', head: true }),
      supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('email_logs').select('*', { count: 'exact', head: true }).gte('sent_at', today),
    ]);
    setStats({
      total: totalRes.count ?? 0,
      sent: sentRes.count ?? 0,
      failed: failedRes.count ?? 0,
      today: todayRes.count ?? 0,
    });
  };

  const invoke = async (fnName: string, body: any, label: string) => {
    setSending(label);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ type: 'success', message: json.message ?? `Done — ${json.sent ?? 0} sent` });
        loadStats();
        if (tab === 'logs') loadLogs();
      } else {
        setResult({ type: 'error', message: json.error ?? 'Request failed' });
      }
    } catch (e: any) {
      setResult({ type: 'error', message: e.message });
    } finally {
      setSending(null);
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const typeColors: Record<string, string> = {
    'nightly-sky': C.blue,
    'event-rsvp': C.green,
    'event-reminder': C.amber,
    'test': C.purple,
  };

  return (
    <div>
      <h2 style={styles.h2}>Email Notifications</h2>
      <p style={styles.sub}>Send, test, and monitor email delivery.</p>

      {/* Stats row */}
      <div style={styles.statsRow}>
        <StatCard label="Total Sent" value={stats.total} color={C.text} />
        <StatCard label="Delivered" value={stats.sent} color={C.green} />
        <StatCard label="Failed" value={stats.failed} color={C.red} />
        <StatCard label="Today" value={stats.today} color={C.blue} />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['send', 'logs', 'config'] as Tab[]).map(t => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'send' ? 'Send' : t === 'logs' ? 'Logs' : 'Config'}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div style={result.type === 'success' ? styles.success : styles.error}>
          {result.message}
          <button style={styles.dismissBtn} onClick={() => setResult(null)}>×</button>
        </div>
      )}

      {/* Send tab */}
      {tab === 'send' && (
        <div style={styles.sendGrid}>
          <div style={styles.sendCard}>
            <div style={styles.sendIcon}>📧</div>
            <h4 style={styles.sendTitle}>Nightly Sky Email</h4>
            <p style={styles.sendDesc}>Send tonight's sky briefing to all subscribers</p>
            <button
              style={ui.primaryBtn}
              onClick={() => invoke('send-nightly-sky-email', {}, 'nightly')}
              disabled={!!sending}
            >
              {sending === 'nightly' ? 'Sending…' : 'Send to All'}
            </button>
          </div>

          <div style={styles.sendCard}>
            <div style={styles.sendIcon}>🎫</div>
            <h4 style={styles.sendTitle}>Event Reminder</h4>
            <p style={styles.sendDesc}>Remind RSVPs about the next upcoming event</p>
            <button
              style={ui.primaryBtn}
              onClick={async () => {
                const { data } = await supabase.from('events').select('id,title').eq('active', true).gte('event_date', new Date().toISOString()).order('event_date').limit(1);
                if (!data?.[0]) { setResult({ type: 'error', message: 'No upcoming events' }); return; }
                invoke('send-event-email', { type: 'event-reminder', event_id: data[0].id }, 'reminder');
              }}
              disabled={!!sending}
            >
              {sending === 'reminder' ? 'Sending…' : 'Send Reminder'}
            </button>
          </div>

          <div style={styles.sendCard}>
            <div style={styles.sendIcon}>🧪</div>
            <h4 style={styles.sendTitle}>Test Email</h4>
            <p style={styles.sendDesc}>Send a test to any email address</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...ui.input, flex: 1 }}
                placeholder="email@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && testEmail && invoke('send-nightly-sky-email', { test_email: testEmail }, 'test')}
              />
              <button
                style={ui.primaryBtn}
                onClick={() => invoke('send-nightly-sky-email', { test_email: testEmail }, 'test')}
                disabled={!!sending || !testEmail.trim()}
              >
                {sending === 'test' ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div>
          <div style={styles.logsHeader}>
            <span style={styles.logsCount}>{logs.length} recent emails</span>
            <button style={ui.ghostBtn} onClick={loadLogs}>Refresh</button>
          </div>
          {logsLoading ? (
            <div style={styles.muted}>Loading logs…</div>
          ) : logs.length === 0 ? (
            <div style={styles.empty}>No email logs yet. Send your first email above.</div>
          ) : (
            <div style={styles.logsTable}>
              {logs.map((log) => (
                <div key={log.id} style={styles.logRow}>
                  <div style={{ ...styles.logDot, backgroundColor: typeColors[log.type] ?? C.textFaint }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.logEmail}>{log.recipient_email}</div>
                    <div style={styles.logMeta}>
                      {log.type} · {log.subject?.slice(0, 40) ?? '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...styles.logStatus, color: log.status === 'sent' ? C.green : C.red }}>
                      {log.status}
                    </div>
                    <div style={styles.logTime}>{formatTime(log.sent_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config tab */}
      {tab === 'config' && (
        <div style={styles.configSection}>
          <div style={styles.configCard}>
            <h4 style={styles.configTitle}>Email Provider</h4>
            <ConfigRow label="Service" value="Resend" />
            <ConfigRow label="API Key" value="••••••••••• (set via supabase secrets)" />
            <ConfigRow label="Domain" value="thepiematrix.com" />
          </div>
          <div style={styles.configCard}>
            <h4 style={styles.configTitle}>Sender Addresses</h4>
            <ConfigRow label="Sky Notifications" value="sky@thepiematrix.com" />
            <ConfigRow label="Event Emails" value="events@thepiematrix.com" />
          </div>
          <div style={styles.configCard}>
            <h4 style={styles.configTitle}>Schedule</h4>
            <ConfigRow label="Nightly Sky Email" value="Daily at 6:30 PM IST (1:00 PM UTC)" />
            <ConfigRow label="Event Reminders" value="1 day before event (manual trigger)" />
            <ConfigRow label="RSVP Confirmation" value="Immediate on registration" />
          </div>
          <div style={styles.configCard}>
            <h4 style={styles.configTitle}>Edge Functions</h4>
            <ConfigRow label="send-nightly-sky-email" value="Deployed" />
            <ConfigRow label="send-event-email" value="Deployed" />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.configRow}>
      <span style={styles.configLabel}>{label}</span>
      <span style={styles.configValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 24px' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20, textAlign: 'center' },
  empty: { color: C.textFaint, fontSize: 14, padding: 40, textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 14 },

  // Stats
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 700, letterSpacing: -1 },
  statLabel: { color: C.textFaint, fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: C.card, borderRadius: 10, padding: 4, border: `1px solid ${C.border}` },
  tab: { flex: 1, background: 'transparent', border: 'none', borderRadius: 8, padding: '10px 0', color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tabActive: { background: C.goldSoft, color: C.gold },

  // Result
  success: { background: C.greenSoft, border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '12px 16px', color: C.green, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dismissBtn: { background: 'none', border: 'none', color: 'inherit', fontSize: 18, cursor: 'pointer', padding: '0 4px' },

  // Send grid
  sendGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  sendCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 },
  sendIcon: { fontSize: 28, marginBottom: 12 },
  sendTitle: { color: C.text, fontSize: 15, fontWeight: 700, margin: '0 0 6px' },
  sendDesc: { color: C.textFaint, fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 },

  // Logs
  logsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logsCount: { color: C.textFaint, fontSize: 12 },
  logsTable: { border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' },
  logRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}` },
  logDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  logEmail: { color: C.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logMeta: { color: C.textFaint, fontSize: 11, marginTop: 2 },
  logStatus: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  logTime: { color: C.textFaint, fontSize: 11, marginTop: 2 },

  // Config
  configSection: { display: 'flex', flexDirection: 'column', gap: 16 },
  configCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 },
  configTitle: { color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 12px' },
  configRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.borderSoft}` },
  configLabel: { color: C.textFaint, fontSize: 13 },
  configValue: { color: C.textDim, fontSize: 13, fontWeight: 500 },
};
