/**
 * Gnomonic projection + star sizing for mobile sky renderer.
 */

import { HorizontalCoordinates } from '@virtual-window/astronomy-engine';

const DEG = Math.PI / 180;

export function projectToScreen(
  obj: HorizontalCoordinates,
  view: HorizontalCoordinates,
  fov: number,
  screenW: number,
  screenH: number,
): { x: number; y: number } | null {
  const cAz = view.azimuth * DEG;
  const cAlt = view.altitude * DEG;
  const oAz = obj.azimuth * DEG;
  const oAlt = obj.altitude * DEG;

  const cosc =
    Math.sin(cAlt) * Math.sin(oAlt) +
    Math.cos(cAlt) * Math.cos(oAlt) * Math.cos(oAz - cAz);

  // For all-sky mode (FOV >= 110), use stereographic projection
  if (fov >= 110) {
    // Stereographic from zenith: r = 2*tan(zenithAngle/2)
    const zenithAngle = Math.PI / 2 - oAlt; // 0 at zenith, π/2 at horizon
    if (zenithAngle > Math.PI * 0.95) return null; // skip objects far below horizon

    const r = 2 * Math.tan(zenithAngle / 2);
    const maxR = 2 * Math.tan((Math.PI / 2) / 2); // horizon radius = 2*tan(45°) = 2
    const screenR = Math.min(screenW, screenH) * 0.45; // horizon maps to 45% of screen
    const scale = screenR / maxR;

    // Azimuth: 0=North=up, 90=East=right
    const sx = screenW / 2 + r * Math.sin(oAz) * scale;
    const sy = screenH / 2 - r * Math.cos(oAz) * scale;

    const m = 60;
    if (sx < -m || sx > screenW + m || sy < -m || sy > screenH + m) return null;
    return { x: sx, y: sy };
  }

  // Standard gnomonic projection for normal FOV
  if (cosc <= 0.01) return null;

  const px = (Math.cos(oAlt) * Math.sin(oAz - cAz)) / cosc;
  const py =
    (Math.cos(cAlt) * Math.sin(oAlt) -
      Math.sin(cAlt) * Math.cos(oAlt) * Math.cos(oAz - cAz)) /
    cosc;

  const fovRad = fov * DEG;
  const scale = Math.min(screenW, screenH) / (2 * Math.tan(fovRad / 2));

  const sx = screenW / 2 + px * scale;
  const sy = screenH / 2 - py * scale;

  const m = 40;
  if (sx < -m || sx > screenW + m || sy < -m || sy > screenH + m) return null;

  return { x: sx, y: sy };
}

/**
 * Star size mapping — enhanced for better visual distinction.
 * Returns radius in pixels. Brighter stars are noticeably larger.
 */
export function magnitudeToRadius(mag: number): number {
  if (mag < -1) return 3.5;   // Sirius-class
  if (mag < 0) return 2.8;    // Very bright (Vega, Arcturus)
  if (mag < 1) return 2.3;    // Bright
  if (mag < 2) return 1.8;    // Notable (Polaris)
  if (mag < 3) return 1.4;    // Constellation stars
  if (mag < 4) return 1.0;    // Dim
  if (mag < 5) return 0.7;    // Faint
  return 0.45;                 // Very faint
}

/**
 * Star opacity — brighter stars are more opaque.
 */
export function magnitudeToOpacity(mag: number): number {
  if (mag < 0) return 1.0;
  if (mag < 2) return 0.95;
  if (mag < 3) return 0.85;
  if (mag < 4) return 0.7;
  if (mag < 5) return 0.5;
  return 0.35;
}

export const SPECTRAL_COLORS: Record<string, string> = {
  O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff',
  G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
};
