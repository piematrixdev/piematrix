/**
 * starNames.ts — match Gaia catalog stars to their traditional names.
 *
 * The bundled Gaia DR3 binary tiers don't carry traditional star names
 * ("Sirius", "Vega", …), only auto-generated IDs like "GL0-1234". This
 * module provides a position-based lookup against a 140-star IAU/Bayer
 * named-star catalog so we can show the proper name when the user taps
 * a recognisable star, falling back to the Gaia ID otherwise.
 */

import rawNamedStars from './data/named-stars.json';

export interface NamedStar {
  id: string;       // HIP catalog id, e.g. "HIP32349"
  name: string;     // Traditional / IAU name, e.g. "Sirius"
  ra: number;       // hours (J2000.0)
  dec: number;      // degrees (J2000.0)
  magnitude: number;
  spectralType?: string;
}

const NAMED_STARS: NamedStar[] = (rawNamedStars as { stars: NamedStar[] }).stars;

/** The full bright named-star catalog (IAU/Bayer names with RA/Dec/magnitude). */
export function getNamedStarCatalog(): NamedStar[] {
  return NAMED_STARS;
}

/**
 * Find the named star closest to the given equatorial coordinates.
 *
 * Returns null if no named star is within `toleranceArcmin` of the query
 * position, or if the magnitude difference is too large (so a bright
 * named star isn't accidentally matched to a faint nearby Gaia star).
 *
 * @param raHours  RA in decimal hours
 * @param decDeg   Declination in degrees
 * @param mag      Magnitude of the queried star (used as a sanity check)
 * @param toleranceArcmin  Match radius (default ~3' = 0.05°)
 */
export function findStarName(
  raHours: number,
  decDeg: number,
  mag: number,
  toleranceArcmin = 3,
): NamedStar | null {
  const queryRaDeg = raHours * 15;
  const tolDeg = toleranceArcmin / 60;
  const tolDegSq = tolDeg * tolDeg;
  const cosD = Math.cos((decDeg * Math.PI) / 180);

  let best: NamedStar | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < NAMED_STARS.length; i++) {
    const ns = NAMED_STARS[i];

    // Quick magnitude reject — same physical star shouldn't differ by
    // more than ~0.5 mag between catalogs (proper motion + epoch ≈ noise).
    if (Math.abs(ns.magnitude - mag) > 0.7) continue;

    // Wrap RA delta to (-180, 180] degrees.
    let dRA = ns.ra * 15 - queryRaDeg;
    if (dRA > 180) dRA -= 360;
    else if (dRA < -180) dRA += 360;

    // Cosine-corrected angular distance (small-angle approximation).
    const dRAcorr = dRA * cosD;
    const dDec = ns.dec - decDeg;
    const distSq = dRAcorr * dRAcorr + dDec * dDec;

    if (distSq < tolDegSq && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = ns;
    }
  }

  return best;
}

/**
 * Resolve a star to a display name.
 *
 *   - if the catalog already provided a name, use it
 *   - else look up by position in the named-star catalog
 *   - else fall back to the catalog id (e.g. "GL2-1234")
 */
export function resolveStarName(
  catalogName: string | null | undefined,
  catalogId: string,
  raHours: number,
  decDeg: number,
  mag: number,
): string {
  if (catalogName && catalogName.trim()) return catalogName;
  const found = findStarName(raHours, decDeg, mag);
  if (found) return found.name;
  return catalogId;
}
