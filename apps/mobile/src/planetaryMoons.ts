/**
 * planetaryMoons.ts — accurate positions for Jupiter's Galilean moons and
 * Saturn's Titan, expressed as angular offsets from their parent planet.
 *
 * Jupiter's four moons use the high-accuracy `JupiterMoons` ephemeris from
 * astronomy-engine (jovicentric state vectors in the Earth-equatorial J2000
 * frame, EQJ). This matches what planetarium apps such as Stellarium show —
 * the previous home-grown mean-longitude theory drifted by many orbits over
 * the years and produced essentially random positions.
 *
 * Titan still uses a simple circular model (astronomy-engine does not provide
 * Saturn's moons), converted into the same EQJ representation so the renderer
 * can treat every moon identically.
 *
 * Output convention — each moon carries its offset from the planet centre as
 * an angular vector in the EQJ frame, in ARCSECONDS:
 *   ex → component along EQJ X (towards RA 0h, Dec 0°)
 *   ey → component along EQJ Y (towards RA 6h, Dec 0°)
 *   ez → component along EQJ Z (towards the North Celestial Pole)
 * The renderer maps this EQJ vector into the sky the same way it maps stars,
 * so the moon line is correctly oriented (equatorial), and the line-of-sight
 * component gives real depth for occlusion by the planet.
 */

import { JupiterMoons, GeoVector, Body } from 'astronomy-engine';

const DEG = Math.PI / 180;
const ARCSEC_PER_RAD = 206264.806;

export interface MoonPosition {
  id: string;
  name: string;
  /** EQJ angular offset from the planet centre (arcseconds). */
  ex: number;
  ey: number;
  ez: number;
  /** Apparent magnitude */
  magnitude: number;
  /** Parent planet id */
  parentId: string;
}

const GALILEAN_MAG: Record<string, number> = {
  io: 5.0, europa: 5.3, ganymede: 4.6, callisto: 5.7,
};

/**
 * Accurate Galilean moon offsets from Jupiter's centre at `date`.
 * Uses astronomy-engine's jovicentric EQJ state vectors, converted from the
 * linear (AU) offset to an angular (arcsec) offset using Jupiter's current
 * geocentric distance.
 */
export function computeGalileanMoons(date: Date): MoonPosition[] {
  const jm = JupiterMoons(date);
  const jv = GeoVector(Body.Jupiter, date, true);
  const jupDistAU = Math.sqrt(jv.x * jv.x + jv.y * jv.y + jv.z * jv.z) || 5.2;
  // AU → arcsec at Jupiter's distance (small-angle: arc = linear / distance).
  const k = ARCSEC_PER_RAD / jupDistAU;

  const entries: Array<{ id: string; name: string; sv: { x: number; y: number; z: number } }> = [
    { id: 'io', name: 'Io', sv: jm.io },
    { id: 'europa', name: 'Europa', sv: jm.europa },
    { id: 'ganymede', name: 'Ganymede', sv: jm.ganymede },
    { id: 'callisto', name: 'Callisto', sv: jm.callisto },
  ];

  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    ex: e.sv.x * k,
    ey: e.sv.y * k,
    ez: e.sv.z * k,
    magnitude: GALILEAN_MAG[e.id] ?? 5.0,
    parentId: 'jupiter',
  }));
}

// --- Titan (simple circular model, no library support for Saturn moons) ---
const TITAN = {
  period: 15.945, // days
  a: 20.3,        // Saturn radii
  L0: 261.0,      // mean longitude at J2000 (approx)
  mag: 8.3,
};
const SATURN_RADIUS_AU = 6.0268e7 / 1.496e11;
const SATURN_TILT = 26.7 * DEG; // ring/axial tilt to our line of sight

function dateToJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Titan's offset from Saturn, returned in the same EQJ arcsecond convention as
 * the Galilean moons. We build the offset in Saturn's local sky frame (east /
 * north / line-of-sight) then rotate it into EQJ using Saturn's RA/Dec, so the
 * renderer handles it identically.
 *
 * @param date       current time
 * @param satRaHours Saturn's right ascension (hours)
 * @param satDecDeg  Saturn's declination (degrees)
 * @param satDistAU  Saturn's geocentric distance (AU)
 */
export function computeTitan(
  date: Date,
  satRaHours: number,
  satDecDeg: number,
  satDistAU = 9.5,
): MoonPosition {
  const d = dateToJD(date) - 2451545.0;
  const rSatArcsec = Math.atan(SATURN_RADIUS_AU / satDistAU) * ARCSEC_PER_RAD;
  const L = ((TITAN.L0 + (360 / TITAN.period) * d) % 360) * DEG;

  // Local sky-frame offset (arcsec): east (RA), north (Dec), line of sight.
  const east = TITAN.a * Math.sin(L) * rSatArcsec;                       // tangential
  const north = TITAN.a * Math.cos(L) * Math.sin(SATURN_TILT) * rSatArcsec;
  const los = TITAN.a * Math.cos(L) * Math.cos(SATURN_TILT) * rSatArcsec; // +los = away

  // EQJ basis at Saturn's direction.
  const ra = satRaHours * 15 * DEG;
  const dec = satDecDeg * DEG;
  const cr = Math.cos(ra), sr = Math.sin(ra), cd = Math.cos(dec), sd = Math.sin(dec);
  // u = direction to Saturn, eastV = d/dRA, northV = d/dDec (EQJ unit vectors)
  const ux = cd * cr, uy = cd * sr, uz = sd;
  const ex = -sr, ey = cr, ez = 0;
  const nx = -sd * cr, ny = -sd * sr, nz = cd;

  return {
    id: 'titan',
    name: 'Titan',
    ex: east * ex + north * nx + los * ux,
    ey: east * ey + north * ny + los * uy,
    ez: east * ez + north * nz + los * uz,
    magnitude: TITAN.mag,
    parentId: 'saturn',
  };
}
