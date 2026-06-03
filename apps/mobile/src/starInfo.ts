/**
 * Star info utilities — computes detailed information for the object detail panel.
 * Derives constellation membership, formatted coordinates, distance estimates,
 * and spectral class descriptions from existing data.
 */

import rawConstellations from './data/constellations.json';

interface ConstellationData {
  id: string;
  name: string;
  lines: Array<{
    star1: { hipId: number };
    star2: { hipId: number };
  }>;
}

// Build HIP ID → constellation name lookup (once)
const hipToConstellation = new Map<number, string>();
for (const c of rawConstellations as ConstellationData[]) {
  for (const line of c.lines) {
    if (line.star1.hipId) hipToConstellation.set(line.star1.hipId, c.name);
    if (line.star2.hipId) hipToConstellation.set(line.star2.hipId, c.name);
  }
}

/** Get constellation name for a star by its HIP ID */
export function getConstellation(starId: string): string | null {
  const hip = parseInt(starId.replace('HIP', ''), 10);
  if (isNaN(hip)) return null;
  return hipToConstellation.get(hip) ?? null;
}

/** Format RA (decimal hours) as "XXh XXm XX.Xs" */
export function formatRA(raHours: number): string {
  const h = Math.floor(raHours);
  const mFull = (raHours - h) * 60;
  const m = Math.floor(mFull);
  const s = ((mFull - m) * 60).toFixed(1);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(4, '0')}s`;
}

/** Format Dec (decimal degrees) as "±XX° XX' XX.X\"" */
export function formatDec(decDeg: number): string {
  const sign = decDeg >= 0 ? '+' : '-';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  const m = Math.floor(mFull);
  const s = ((mFull - m) * 60).toFixed(1);
  return `${sign}${d}° ${String(m).padStart(2, '0')}' ${String(s).padStart(4, '0')}"`;
}

/** Format Az/Alt as "XXX° XX' XX.X\"" */
export function formatAzAlt(deg: number): string {
  const sign = deg >= 0 ? '' : '-';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  const m = Math.floor(mFull);
  const s = ((mFull - m) * 60).toFixed(1);
  return `${sign}${d}° ${String(m).padStart(2, '0')}' ${String(s).padStart(4, '0')}"`;
}

/** Spectral type descriptions */
const SPECTRAL_DESC: Record<string, string> = {
  O: 'Blue supergiant · >30,000K',
  B: 'Blue-white star · 10,000-30,000K',
  A: 'White star · 7,500-10,000K',
  F: 'Yellow-white star · 6,000-7,500K',
  G: 'Yellow star (Sun-like) · 5,200-6,000K',
  K: 'Orange star · 3,700-5,200K',
  M: 'Red dwarf/giant · 2,400-3,700K',
};

export function getSpectralDescription(type: string): string {
  return SPECTRAL_DESC[type] ?? `Type ${type}`;
}

/** Spectral type colors for the icon */
export const SPECTRAL_COLORS: Record<string, string> = {
  O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff',
  G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
};

/**
 * Estimate distance in light-years from magnitude and spectral type.
 * Uses absolute magnitude estimates per spectral class (main sequence).
 * This is a rough estimate — real distances need parallax data.
 */
const ABS_MAG: Record<string, number> = {
  O: -5.5, B: -1.5, A: 1.5, F: 3.0, G: 4.8, K: 6.5, M: 10.0,
};

export function estimateDistance(magnitude: number, spectralType: string): number | null {
  const absMag = ABS_MAG[spectralType];
  if (absMag === undefined) return null;
  // Distance modulus: m - M = 5 * log10(d/10)
  const d = Math.pow(10, (magnitude - absMag + 5) / 5);
  return Math.round(d * 3.26); // parsecs to light-years
}
