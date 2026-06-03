/**
 * Shared design tokens for the Pie Matrix web admin panel.
 * Dark + gold aesthetic, matching the SkyWatch brand.
 */

export const C = {
  bg: '#030308',
  bgPanel: '#0a0a12',
  sidebar: '#07070d',
  card: 'rgba(255,255,255,0.03)',
  cardHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.05)',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.12)',
  gold: '#d4c5a0',
  goldSoft: 'rgba(212,197,160,0.15)',
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.6)',
  textFaint: 'rgba(255,255,255,0.35)',
  green: '#4ade80',
  greenSoft: 'rgba(74,222,128,0.12)',
  red: '#ef4444',
  redSoft: 'rgba(239,68,68,0.12)',
  blue: '#60a5fa',
  amber: '#f59e0b',
  purple: '#a78bfa',
} as const;

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Display / title font — Jost (loaded via _document.tsx). Falls back to FONT. */
export const FONT_TITLE = `'Jost', ${FONT}`;

/** A few commonly reused inline styles. */
export const ui: Record<string, React.CSSProperties> = {
  input: {
    background: C.inputBg,
    border: `1px solid ${C.inputBorder}`,
    borderRadius: 10,
    padding: '10px 14px',
    color: C.text,
    fontSize: 14,
    fontFamily: FONT,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  label: {
    color: C.textDim,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  },
  primaryBtn: {
    background: C.gold,
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    color: '#030308',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  ghostBtn: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 18px',
    color: C.textDim,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  dangerBtn: {
    background: C.redSoft,
    border: `1px solid rgba(239,68,68,0.25)`,
    borderRadius: 8,
    padding: '7px 14px',
    color: C.red,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 20,
  },
};
