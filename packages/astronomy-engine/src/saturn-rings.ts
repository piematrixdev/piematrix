/**
 * Saturn Ring Tilt Calculator
 *
 * Computes the tilt of Saturn's rings as seen from Earth.
 * The ring plane is tilted ~26.7° to Saturn's orbital plane, and the
 * apparent tilt varies from 0° (edge-on, rings invisible) to ±26.7°
 * (maximum opening) over Saturn's ~29.5 year orbit.
 *
 * Uses the astronomy-engine npm package for accurate computation.
 *
 * @module saturn-rings
 */

import * as Astronomy from 'astronomy-engine';

/**
 * Saturn ring information as seen from Earth.
 */
export interface SaturnRingInfo {
  /** Tilt of the ring plane toward Earth in degrees.
   *  Positive = north pole tilted toward Earth (rings open from above).
   *  Negative = south pole tilted toward Earth.
   *  Zero = edge-on (rings nearly invisible). */
  tiltDeg: number;

  /** Absolute tilt magnitude (always positive, 0–26.7°) */
  openingAngleDeg: number;

  /** Inner ring radius in Saturn radii */
  innerRadius: number;

  /** Outer ring radius in Saturn radii */
  outerRadius: number;
}

/**
 * Saturn's axial tilt relative to its orbital plane (degrees).
 * Maximum possible ring opening angle: 26.73°.
 */

/**
 * Saturn's north pole direction in J2000 equatorial coordinates.
 * RA = 40.589°, Dec = 83.537° (IAU)
 */
const SATURN_POLE_RA_DEG = 40.589;
const SATURN_POLE_DEC_DEG = 83.537;

/**
 * Computes Saturn ring tilt as seen from Earth at a given time.
 *
 * @param timestamp - Date for the computation
 * @returns SaturnRingInfo with tilt and ring dimensions
 */
export function getSaturnRingTilt(timestamp: Date): SaturnRingInfo {
  // Get Saturn's geocentric equatorial position
  const observer = new Astronomy.Observer(0, 0, 0); // geocentric
  const saturnEq = Astronomy.Equator(Astronomy.Body.Saturn, timestamp, observer, true, true);

  // Direction from Earth to Saturn (unit vector in equatorial coords)
  const raRad = saturnEq.ra * (Math.PI / 12); // hours → radians
  const decRad = saturnEq.dec * (Math.PI / 180);

  // Earth-to-Saturn unit vector
  const ex = Math.cos(decRad) * Math.cos(raRad);
  const ey = Math.cos(decRad) * Math.sin(raRad);
  const ez = Math.sin(decRad);

  // Saturn's north pole unit vector (J2000)
  const poleRaRad = SATURN_POLE_RA_DEG * (Math.PI / 180);
  const poleDecRad = SATURN_POLE_DEC_DEG * (Math.PI / 180);
  const px = Math.cos(poleDecRad) * Math.cos(poleRaRad);
  const py = Math.cos(poleDecRad) * Math.sin(poleRaRad);
  const pz = Math.sin(poleDecRad);

  // The ring tilt (B) is the elevation of Earth above Saturn's ring plane.
  // sin(B) = dot(earth_to_saturn_direction, saturn_pole)
  // But we want the angle from Earth's perspective looking AT Saturn,
  // so we use the negative of the Earth-to-Saturn vector (Saturn-to-Earth).
  const sinB = -(ex * px + ey * py + ez * pz);

  // Clamp for safety
  const clampedSinB = Math.max(-1, Math.min(1, sinB));
  const tiltRad = Math.asin(clampedSinB);
  const tiltDeg = tiltRad * (180 / Math.PI);

  return {
    tiltDeg,
    openingAngleDeg: Math.abs(tiltDeg),
    innerRadius: 1.239, // D ring inner edge in Saturn radii
    outerRadius: 2.27,  // F ring outer edge in Saturn radii
  };
}

/**
 * Returns the ring tilt in radians for direct use in 3D rendering.
 * Positive = rings tilted toward viewer (north pole facing Earth).
 *
 * @param timestamp - Date for the computation
 * @returns Tilt angle in radians
 */
export function getSaturnRingTiltRad(timestamp: Date): number {
  const info = getSaturnRingTilt(timestamp);
  return info.tiltDeg * (Math.PI / 180);
}
