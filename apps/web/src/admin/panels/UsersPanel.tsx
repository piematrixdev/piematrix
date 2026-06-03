/**
 * UsersPanel — Browse and manage app users.
 * Shows user profiles, onboarding status, and allows admin actions.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ui, FONT_TITLE } from '../adminTheme';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  experience_level: string | null;
  interests: string[] | null;
  onboarding_complete: boolean;
  email_notifications: boolean;
  created_at: string;
}

export default function UsersPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else setUsers((data as UserProfile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = search.trim()
    ? users.filter(u =>
        (u.display_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <div style={styles.head}>
        <div>
          <h2 style={styles.h2}>Users</h2>
          <p style={styles.sub}>{users.length} registered users. Showing most recent 100.</p>
        </div>
        <button style={ui.ghostBtn} onClick={load}>Refresh</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <input
          style={ui.input}
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>No users found.</div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <div style={{ ...styles.col, width: 40 }}></div>
            <div style={{ ...styles.col, flex: 1 }}>Name</div>
            <div style={{ ...styles.col, width: 100 }}>Level</div>
            <div style={{ ...styles.col, width: 100 }}>Onboarded</div>
            <div style={{ ...styles.col, width: 100 }}>Joined</div>
            <div style={{ ...styles.col, width: 60 }}></div>
          </div>
          {filtered.map((u) => (
            <div key={u.id} style={styles.tableRow}>
              <div style={{ ...styles.col, width: 40 }}>
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatar_url} alt="" style={styles.avatar} />
                ) : (
                  <div style={styles.avatarPlaceholder}>{(u.display_name ?? '?')[0]?.toUpperCase()}</div>
                )}
              </div>
              <div style={{ ...styles.col, flex: 1 }}>
                <div style={styles.userName}>{u.display_name ?? 'No name'}</div>
                <div style={styles.userId}>{u.id.slice(0, 12)}…</div>
              </div>
              <div style={{ ...styles.col, width: 100 }}>
                <span style={styles.levelBadge}>{u.experience_level ?? '—'}</span>
              </div>
              <div style={{ ...styles.col, width: 100 }}>
                <span style={{ color: u.onboarding_complete ? C.green : C.textFaint }}>
                  {u.onboarding_complete ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div style={{ ...styles.col, width: 100, color: C.textFaint, fontSize: 12 }}>
                {formatDate(u.created_at)}
              </div>
              <div style={{ ...styles.col, width: 60 }}>
                <button style={ui.ghostBtn} onClick={() => setSelectedUser(u)}>View</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User detail modal */}
      {selectedUser && (
        <div style={styles.modalOverlay} onClick={() => setSelectedUser(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              {selectedUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedUser.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 28, objectFit: 'cover' }} />
              ) : (
                <div style={{ ...styles.avatarPlaceholder, width: 56, height: 56, fontSize: 20, borderRadius: 28 }}>
                  {(selectedUser.display_name ?? '?')[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h3 style={styles.modalTitle}>{selectedUser.display_name ?? 'No name'}</h3>
                <div style={{ color: C.textFaint, fontSize: 12 }}>{selectedUser.id}</div>
              </div>
            </div>

            <div style={styles.detailGrid}>
              <DetailRow label="Experience" value={selectedUser.experience_level ?? 'Not set'} />
              <DetailRow label="Onboarding" value={selectedUser.onboarding_complete ? 'Complete' : 'Incomplete'} />
              <DetailRow label="Notifications" value={selectedUser.email_notifications ? 'Enabled' : 'Disabled'} />
              <DetailRow label="Joined" value={formatDate(selectedUser.created_at)} />
              <DetailRow label="Interests" value={selectedUser.interests?.join(', ') || 'None'} />
            </div>

            <div style={styles.modalActions}>
              <button style={ui.ghostBtn} onClick={() => setSelectedUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT_TITLE },
  sub: { color: C.textFaint, fontSize: 13, margin: '4px 0 0' },
  muted: { color: C.textFaint, fontSize: 14, padding: 20 },
  empty: { color: C.textFaint, fontSize: 14, padding: 40, textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 14 },
  error: { background: C.redSoft, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 },
  table: { border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}` },
  col: { display: 'flex', alignItems: 'center', fontSize: 13 },
  avatar: { width: 32, height: 32, borderRadius: 16, objectFit: 'cover' },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, background: C.goldSoft, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  userName: { color: C.text, fontSize: 14, fontWeight: 600 },
  userId: { color: C.textFaint, fontSize: 11, marginTop: 2 },
  levelBadge: { color: C.gold, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 },
  modal: { background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480 },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: 700, margin: 0 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: 0 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}` },
  detailLabel: { color: C.textFaint, fontSize: 13 },
  detailValue: { color: C.text, fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%' },
};
