/**
 * ComingSoonPanel — placeholder for reserved admin sections that will
 * be wired up later (events, users, sky alerts, etc.).
 */

import { C, FONT_TITLE } from '../adminTheme';

export default function ComingSoonPanel({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div>
      <h2 style={styles.h2}>{title}</h2>
      <div style={styles.box}>
        <div style={styles.badge}>Coming soon</div>
        <p style={styles.text}>
          {blurb ?? 'This section is reserved for a future release. The navigation slot is in place so it can be built out without restructuring the panel.'}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { color: C.text, fontSize: 22, fontWeight: 700, margin: '0 0 20px', fontFamily: FONT_TITLE },
  box: {
    border: `1px dashed ${C.border}`,
    borderRadius: 16,
    padding: 48,
    textAlign: 'center',
    background: C.card,
  },
  badge: {
    display: 'inline-block',
    background: C.goldSoft,
    color: C.gold,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    padding: '5px 12px',
    borderRadius: 8,
    marginBottom: 16,
  },
  text: { color: C.textDim, fontSize: 14, lineHeight: 1.6, maxWidth: 440, margin: '0 auto' },
};
