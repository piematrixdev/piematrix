/**
 * Milky Way band renderer.
 * 
 * The Milky Way follows the galactic plane — a great circle tilted ~63° 
 * to the celestial equator. We trace it as a series of points along the
 * galactic equator (b=0°) and offset bands (b=±5°, ±10°, ±15°) to create
 * a wide, diffuse band.
 * 
 * The band is brighter toward the galactic center (Sagittarius, RA~18h)
 * and dimmer toward the anticenter (Auriga, RA~6h).
 * 
 * Visibility depends on Bortle scale:
 *   Bortle 1-2: bright, clearly visible
 *   Bortle 3-4: visible but faint
 *   Bortle 5+: not visible (too much light pollution)
 */

import { HorizontalCoordinates, celestialToHorizontal, GeographicCoordinates } from '@virtual-window/astronomy-engine';

// Galactic coordinates to equatorial (RA hours, Dec degrees)
// Using the standard galactic pole: RA=12.85h, Dec=27.13°, l_ascending=33°
const POLE_RA = 12.85; // hours
const POLE_DEC = 27.13; // degrees
const L_ASC = 33; // degrees — galactic longitude of ascending node

const DEG = Math.PI / 180;

function galacticToEquatorial(l: number, b: number): { ra: number; dec: number } {
  const lRad = l * DEG;
  const bRad = b * DEG;
  const poleDecRad = POLE_DEC * DEG;
  const lAscRad = L_ASC * DEG;

  // Convert galactic (l, b) to equatorial (ra, dec)
  const sinDec = Math.sin(bRad) * Math.sin(poleDecRad) +
    Math.cos(bRad) * Math.cos(poleDecRad) * Math.sin(lRad - lAscRad);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = Math.cos(bRad) * Math.cos(lRad - lAscRad);
  const x = Math.sin(bRad) * Math.cos(poleDecRad) -
    Math.cos(bRad) * Math.sin(poleDecRad) * Math.sin(lRad - lAscRad);
  let ra = Math.atan2(y, x) + POLE_RA * 15 * DEG; // POLE_RA in degrees

  // Convert ra from radians to hours
  let raHours = (ra / DEG) / 15;
  raHours = ((raHours % 24) + 24) % 24;

  return { ra: raHours, dec: dec / DEG };
}

export interface MilkyWayPoint {
  pos: HorizontalCoordinates;
  brightness: number; // 0-1, brighter near galactic center
  width: number; // relative width factor
}

/**
 * Get Milky Way band points projected to horizontal coordinates.
 * Returns points along multiple offset bands for a wide, diffuse appearance.
 */
export function getMilkyWayBand(
  observer: GeographicCoordinates,
  lst: number,
  bortle: number,
): MilkyWayPoint[] {
  // Not visible at Bortle 8+
  if (bortle >= 8) return [];

  const points: MilkyWayPoint[] = [];
  const step = 2; // very dense sampling

  // Many thin bands for smooth appearance
  const bands: Array<{ b: number; widthFactor: number }> = [];
  for (let b = -20; b <= 20; b += 2) {
    const dist = Math.abs(b);
    const w = dist <= 4 ? 1.0 : dist <= 8 ? 0.7 : dist <= 14 ? 0.4 : 0.15;
    bands.push({ b, widthFactor: w });
  }

  for (const band of bands) {
    for (let l = 0; l < 360; l += step) {
      const eq = galacticToEquatorial(l, band.b);
      const hz = celestialToHorizontal({ ra: eq.ra, dec: eq.dec }, observer, lst);

      if (hz.altitude < -5) continue;

      // Brightness peaks near galactic center (l ≈ 0° = Sagittarius)
      const centerDist = Math.min(l, 360 - l);
      const baseBrightness = 1.0 - (centerDist / 180) * 0.5;

      // Bortle scaling — visible even at moderate pollution, just dimmer
      const bortleScale = bortle <= 1 ? 1.0 : bortle <= 2 ? 0.85 : bortle <= 3 ? 0.65 :
        bortle <= 4 ? 0.45 : bortle <= 5 ? 0.3 : bortle <= 6 ? 0.18 : 0.1;

      points.push({
        pos: hz,
        brightness: baseBrightness * bortleScale * band.widthFactor,
        width: band.widthFactor,
      });
    }
  }

  return points;
}
