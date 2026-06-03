/**
 * AdminDashboard — sidebar shell that hosts the admin panels.
 * Active sections: Overview, Promo Banners, Hero Images, Feedback.
 * Reserved sections render a "coming soon" placeholder for later use.
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { C, FONT, FONT_TITLE } from './adminTheme';
import type { AdminRole } from './useAdmin';
import OverviewPanel from './panels/OverviewPanel';
import PromoBannersPanel from './panels/PromoBannersPanel';
import HeroImagesPanel from './panels/HeroImagesPanel';
import FeedbackPanel from './panels/FeedbackPanel';
import ContentPanel from './panels/ContentPanel';
import EventsPanel from './panels/EventsPanel';
import UsersPanel from './panels/UsersPanel';
import EmailPanel from './panels/EmailPanel';
import PushPanel from './panels/PushPanel';
import ComingSoonPanel from './panels/ComingSoonPanel';

type SectionId =
  | 'overview'
  | 'content'
  | 'banners'
  | 'heroes'
  | 'events'
  | 'feedback'
  | 'users'
  | 'emails'
  | 'push'
  | 'celestial'
  | 'alerts';

interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
  group: string;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: '◎', group: 'Dashboard' },
  { id: 'content', label: 'Content', icon: '✎', group: 'Content' },
  { id: 'banners', label: 'Promo Banners', icon: '▦', group: 'Content' },
  { id: 'heroes', label: 'Hero Images', icon: '◧', group: 'Content' },
  { id: 'events', label: 'Events', icon: '◈', group: 'Engagement' },
  { id: 'feedback', label: 'Feedback', icon: '✦', group: 'Engagement' },
  { id: 'users', label: 'Users', icon: '⊙', group: 'Engagement' },
  { id: 'emails', label: 'Emails', icon: '✉', group: 'Engagement' },
  { id: 'push', label: 'Push Notifications', icon: '⊕', group: 'Engagement' },
  { id: 'celestial', label: 'Celestial Info', icon: '✶', group: 'Reserved', soon: true },
  { id: 'alerts', label: 'Sky Alerts', icon: '✸', group: 'Reserved', soon: true },
];

interface Props {
  email: string | null;
  role: AdminRole | null;
}

export default function AdminDashboard({ email, role }: Props) {
  const [section, setSection] = useState<SectionId>('overview');

  const groups = NAV.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  const renderPanel = () => {
    switch (section) {
      case 'overview':
        return <OverviewPanel adminEmail={email} />;
      case 'content':
        return <ContentPanel />;
      case 'banners':
        return <PromoBannersPanel />;
      case 'heroes':
        return <HeroImagesPanel />;
      case 'feedback':
        return <FeedbackPanel />;
      case 'events':
        return <EventsPanel />;
      case 'users':
        return <UsersPanel />;
      case 'emails':
        return <EmailPanel />;
      case 'push':
        return <PushPanel />;
      case 'celestial':
        return (
          <ComingSoonPanel
            title="Celestial Info"
            blurb="Manage the educational content shown for constellations, planets, and deep-sky objects. Reserved for a later release."
          />
        );
      case 'alerts':
        return (
          <ComingSoonPanel
            title="Sky Alerts"
            blurb="Broadcast meteor showers, eclipses, and special events to all users. Reserved for a later release."
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brandRow}>
          <div style={styles.logoDot} />
          <div>
            <div style={styles.brand}>Pie Matrix</div>
            <div style={styles.brandSub}>Admin Console</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div style={styles.navGroup}>{group}</div>
              {items.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
                    onClick={() => setSection(item.id)}
                  >
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.soon && <span style={styles.soonTag}>soon</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={styles.userBox}>
          <div style={styles.userEmail}>{email}</div>
          <div style={styles.userRole}>{role ?? 'admin'}</div>
          <button style={styles.signOut} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.content}>{renderPanel()}</div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: FONT },
  sidebar: {
    width: 248,
    flexShrink: 0,
    background: C.sidebar,
    borderRight: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    position: 'sticky',
    top: 0,
    height: '100vh',
    boxSizing: 'border-box',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  logoDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: `linear-gradient(135deg, ${C.gold}, #b89f72)`,
    flexShrink: 0,
  },
  brand: { color: C.text, fontSize: 15, fontWeight: 700, letterSpacing: -0.2, fontFamily: FONT_TITLE },
  brandSub: { color: C.textFaint, fontSize: 11, marginTop: 1 },
  nav: { flex: 1, overflowY: 'auto' },
  navGroup: {
    color: C.textFaint,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    padding: '0 8px',
    marginBottom: 8,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 10,
    padding: '9px 10px',
    color: C.textDim,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: FONT,
    marginBottom: 2,
  },
  navItemActive: { background: C.goldSoft, color: C.gold, fontWeight: 700 },
  navIcon: { width: 18, textAlign: 'center', fontSize: 14 },
  soonTag: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.textFaint,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    padding: '1px 5px',
  },
  userBox: {
    borderTop: `1px solid ${C.border}`,
    paddingTop: 16,
    marginTop: 12,
  },
  userEmail: { color: C.textDim, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { color: C.textFaint, fontSize: 11, textTransform: 'capitalize', marginTop: 1, marginBottom: 12 },
  signOut: {
    width: '100%',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    padding: '8px 0',
    color: C.textDim,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  main: { flex: 1, overflowY: 'auto' },
  content: { maxWidth: 980, margin: '0 auto', padding: '40px 36px 80px' },
};
