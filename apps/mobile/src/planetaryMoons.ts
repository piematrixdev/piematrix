/**
 * planetaryMoons.ts — Galilean moon positions for Jupiter.
 *
 * Computes the positions of Io, Europa, Ganymede, and Callisto relative
 * to Jupiter using simplified Lieske E2x3 theory. Returns angular offsets
 * in arcseconds from Jupiter's center, suitable for rendering as tiny
 * dots flanking the planet. The renderer scales offsets to be visible
 * at any FOV while preserving relative positions.
 *
 * Also includes Saturn's Titan for good measure (single-moon, simple orbit).
 *
 * Reference: Jean Meeus, "Astronomical Algorithms" (2nd ed.), Chapter 44.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface MoonPosition {
  id: string;
  name: string;
  /** Angular offset from planet center in RA (arcseconds, east positive) */
  dRA: number;
  /** Angular offset from planet center in Dec (arcseconds, north positive) */
  dDec: number;
  /** Apparent magnitude */
  magnitude: number;
  /** Parent planet id */
  parentId: string;
}

/**
 * Compute Julian Day Number from a Date.
 */
function dateToJD(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

/**
 * Galilean moon orbital elements (simplified Lieske E2x3).
 * Each moon: period (days), semi-major axis (Jupiter radii),
 * mean longitude at J2000, magnitude.
 */
const GALILEAN = [
  { id: 'io',       name: 'Io',       period: 1.769137786, a: 5.905, L0: 106.07947, mag: 5.0 },
  { id: 'europa',   name: 'Europa',   period: 3.551181041, a: 9.397, L0: 175.73161, mag: 5.3 },
  { id: 'ganymede', name: 'Ganymede', period: 7.154552870, a: 14.989, L0: 120.55883, mag: 4.6 },
  { id: 'callisto', name: 'Callisto', period: 16.68901840, a: 26.364, L0: 84.44459, mag: 5.7 },
];

// Jupiter's equatorial radius in arcseconds at 1 AU distance
const JUPITER_RADIUS_AU = 7.1492e7 / 1.496e11; // km → AU
// Angular size of Jupiter's radius at distance d (AU): atan(R/d) in arcsec
function jupiterRadiusArcsec(distAU: number): number {
  return Math.atan(JUPITER_RADIUS_AU / distAU) * 206265;
}

/**
 * Compute Galilean moon positions relative to Jupiter.
 *
 * @param date - Current time
 * @param jupiterDistAU - Jupiter's distance from Earth in AU (get from planet calculator)
 * @returns Array of 4 moon positions (angular offsets from Jupiter center)
 */
export function computeGalileanMoons(date: Date, jupiterDistAU: number): MoonPosition[] {
  const jd = dateToJD(date);
  const d = jd - 2451545.0; // days since J2000

  // Jupiter radius in arcsec at current distance
  const rJupArcsec = jupiterRadiusArcsec(jupiterDistAU);

  const moons: MoonPosition[] = [];

  for (const moon of GALILEAN) {
    // Mean longitude (degrees)
    const L = (moon.L0 + (360 / moon.period) * d) % 360;
    const Lrad = L * DEG;

    // Position angle in orbit (simplified — circular, equatorial plane)
    // X = semi-major axis * sin(L), Y = semi-major axis * cos(L) * cos(inclination)
    // For Galilean moons, orbital inclination to line of sight is small (~3°)
    // so we approximate: dRA = a * sin(L), dDec ≈ 0 (edge-on view from Earth)
    const xJupRadii = moon.a * Math.sin(Lrad);
    // Small Y component from Jupiter's axial tilt (~3.1°) and orbital inclination
    const yJupRadii = moon.a * Math.cos(Lrad) * Math.sin(3.1 * DEG);

    // Convert from Jupiter radii to arcseconds
    const dRA = xJupRadii * rJupArcsec;
    const dDec = yJupRadii * rJupArcsec;

    moons.push({
      id: moon.id,
      name: moon.name,
      dRA,
      dDec,
      magnitude: moon.mag,
      parentId: 'jupiter',
    });
  }

  return moons;
}

/**
 * Saturn's Titan — the only moon easily visible in binoculars.
 */
const TITAN = {
  id: 'titan', name: 'Titan',
  period: 15.945, // days
  a: 20.3, // Saturn radii
  L0: 261.0, // mean longitude at J2000 (approx)
  mag: 8.3,
};

const SATURN_RADIUS_AU = 6.0268e7 / 1.496e11;

function saturnRadiusArcsec(distAU: number): number {
  return Math.atan(SATURN_RADIUS_AU / distAU) * 206265;
}

/**
 * Compute Titan's position relative to Saturn.
 */
export function computeTitan(date: Date, saturnDistAU: number): MoonPosition {
  const jd = dateToJD(date);
  const d = jd - 2451545.0;

  const rSatArcsec = saturnRadiusArcsec(saturnDistAU);
  const L = (TITAN.L0 + (360 / TITAN.period) * d) % 360;
  const Lrad = L * DEG;

  const xSatRadii = TITAN.a * Math.sin(Lrad);
  const ySatRadii = TITAN.a * Math.cos(Lrad) * Math.sin(26.7 * DEG); // Saturn's tilt

  return {
    id: TITAN.id,
    name: TITAN.name,
    dRA: xSatRadii * rSatArcsec,
    dDec: ySatRadii * rSatArcsec,
    magnitude: TITAN.mag,
    parentId: 'saturn',
  };
}

/**
 * Get all planetary moons for rendering.
 * Moons are always computed — visibility is handled by the renderer
 * which scales their offsets to be visible at any FOV.
 *
 * @param date - Current time
 * @param planets - Map of planet id → { distAU } (from planet calculator)
 */
export function getVisiblePlanetaryMoons(
  _fov: number,
  date: Date,
  planets: Map<string, { distAU: number }>
): MoonPosition[] {
  const moons: MoonPosition[] = [];

  const jupiter = planets.get('jupiter');
  if (jupiter) {
    moons.push(...computeGalileanMoons(date, jupiter.distAU));
  }

  const saturn = planets.get('saturn');
  if (saturn) {
    moons.push(computeTitan(date, saturn.distAU));
  }

  return moons;
}
