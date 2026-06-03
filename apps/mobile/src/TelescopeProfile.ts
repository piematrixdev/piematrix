/**
 * Telescope Profile — stores user's equipment specs and computes
 * what they can observe based on aperture, focal length, and eyepiece.
 *
 * Key formulas:
 * - Limiting magnitude: 2.7 + 5 * log10(aperture_mm)
 * - Magnification: focal_length / eyepiece_focal_length
 * - True FOV: apparent_FOV / magnification
 * - Max useful magnification: 2 * aperture_mm
 * - Exit pupil: aperture_mm / magnification (should be 1-7mm)
 * - Light gathering: (aperture_mm / 7)^2 times naked eye
 *
 * Supabase table: `telescope_profiles`
 * CREATE TABLE telescope_profiles (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id text NOT NULL,
 *   name text NOT NULL DEFAULT 'My Telescope',
 *   type text NOT NULL DEFAULT 'reflector',
 *   aperture_mm numeric NOT NULL,
 *   focal_length_mm numeric NOT NULL,
 *   eyepiece_fl_mm numeric DEFAULT 25,
 *   eyepiece_afov numeric DEFAULT 50,
 *   barlow numeric DEFAULT 1,
 *   mount_type text DEFAULT 'alt-az',
 *   created_at timestamptz DEFAULT now()
 * );
 */

export type TelescopeType = 'reflector' | 'refractor' | 'catadioptric' | 'binoculars';
export type MountType = 'alt-az' | 'equatorial' | 'dobsonian' | 'handheld';

export interface TelescopeSpec {
  name: string;
  type: TelescopeType;
  /** Primary mirror/lens diameter in mm */
  aperture: number;
  /** Focal length of the telescope in mm */
  focalLength: number;
  /** Eyepiece focal length in mm */
  eyepieceFl: number;
  /** Eyepiece apparent field of view in degrees */
  eyepieceAfov: number;
  /** Barlow multiplier (1 = no barlow, 2 = 2x barlow) */
  barlow: number;
  /** Mount type */
  mount: MountType;
}

export interface TelescopeCapabilities {
  /** Faintest star magnitude visible */
  limitingMagnitude: number;
  /** Current magnification */
  magnification: number;
  /** True field of view in degrees */
  trueFov: number;
  /** Maximum useful magnification */
  maxMagnification: number;
  /** Exit pupil in mm */
  exitPupil: number;
  /** Light gathering power vs naked eye */
  lightGathering: number;
  /** Focal ratio (f/number) */
  focalRatio: number;
  /** Can track objects (equatorial mount) */
  canTrack: boolean;
  /** Suitable for astrophotography */
  suitableForPhoto: boolean;
}

export interface ObservingTarget {
  id: string;
  name: string;
  type: string;
  magnitude: number;
  altitude: number;
  azimuth: number;
  ra: number;   // hours
  dec: number;  // degrees
  /** Whether it fits in the FOV */
  fitsInFov: boolean;
  /** Difficulty: easy, moderate, challenging */
  difficulty: 'easy' | 'moderate' | 'challenging';
  /** Specific tip for this telescope */
  tip: string;
  /** Priority score (higher = better target) */
  score: number;
}

/** Default telescope presets */
export const TELESCOPE_PRESETS: Record<string, TelescopeSpec> = {
  'beginner-reflector': {
    name: '130mm Reflector',
    type: 'reflector',
    aperture: 130,
    focalLength: 650,
    eyepieceFl: 25,
    eyepieceAfov: 52,
    barlow: 1,
    mount: 'equatorial',
  },
  'dobsonian-8': {
    name: '8" Dobsonian',
    type: 'reflector',
    aperture: 203,
    focalLength: 1200,
    eyepieceFl: 25,
    eyepieceAfov: 52,
    barlow: 1,
    mount: 'dobsonian',
  },
  'refractor-80': {
    name: '80mm Refractor',
    type: 'refractor',
    aperture: 80,
    focalLength: 400,
    eyepieceFl: 20,
    eyepieceAfov: 60,
    barlow: 1,
    mount: 'alt-az',
  },
  'binoculars-10x50': {
    name: '10x50 Binoculars',
    type: 'binoculars',
    aperture: 50,
    focalLength: 500,
    eyepieceFl: 50,
    eyepieceAfov: 65,
    barlow: 1,
    mount: 'handheld',
  },
  'sct-8': {
    name: '8" SCT',
    type: 'catadioptric',
    aperture: 203,
    focalLength: 2032,
    eyepieceFl: 25,
    eyepieceAfov: 52,
    barlow: 1,
    mount: 'equatorial',
  },
};

/**
 * Compute telescope capabilities from specs.
 */
export function computeCapabilities(spec: TelescopeSpec): TelescopeCapabilities {
  const effectiveFl = spec.focalLength * spec.barlow;
  const magnification = effectiveFl / spec.eyepieceFl;
  const trueFov = spec.eyepieceAfov / magnification;
  const limitingMagnitude = 2.7 + 5 * Math.log10(spec.aperture);
  const maxMagnification = 2 * spec.aperture;
  const exitPupil = spec.aperture / magnification;
  const lightGathering = Math.pow(spec.aperture / 7, 2);
  const focalRatio = spec.focalLength / spec.aperture;
  const canTrack = spec.mount === 'equatorial';
  const suitableForPhoto = canTrack && spec.aperture >= 80;

  return {
    limitingMagnitude: Math.round(limitingMagnitude * 10) / 10,
    magnification: Math.round(magnification * 10) / 10,
    trueFov: Math.round(trueFov * 100) / 100,
    maxMagnification: Math.round(maxMagnification),
    exitPupil: Math.round(exitPupil * 10) / 10,
    lightGathering: Math.round(lightGathering),
    focalRatio: Math.round(focalRatio * 10) / 10,
    canTrack,
    suitableForPhoto,
  };
}

// Approximate angular sizes of Messier objects in arcminutes
const DSO_SIZES: Record<string, number> = {
  M1: 6, M2: 13, M3: 16, M4: 26, M5: 17, M6: 25, M7: 80,
  M8: 90, M9: 9, M10: 15, M11: 14, M12: 15, M13: 20, M14: 12,
  M15: 12, M16: 35, M17: 40, M18: 9, M19: 14, M20: 28,
  M21: 13, M22: 24, M23: 27, M24: 90, M25: 32, M26: 15,
  M27: 8, M28: 11, M29: 7, M30: 11, M31: 178, M32: 8,
  M33: 73, M34: 35, M35: 28, M36: 12, M37: 24, M38: 21,
  M39: 32, M40: 1, M41: 38, M42: 85, M43: 20, M44: 95,
  M45: 110, M46: 27, M47: 30, M48: 54, M49: 9, M50: 16,
  M51: 11, M52: 13, M53: 13, M54: 9, M55: 19, M56: 7,
  M57: 1.4, M58: 6, M59: 5, M60: 7, M61: 6, M62: 14,
  M63: 13, M64: 10, M65: 10, M66: 9, M67: 30, M68: 12,
  M69: 7, M70: 8, M71: 7, M72: 6, M73: 3, M74: 11,
  M75: 6, M76: 3, M77: 7, M78: 8, M79: 9, M80: 9,
  M81: 27, M82: 11, M83: 13, M84: 6, M85: 7, M86: 9,
  M87: 7, M88: 7, M89: 5, M90: 10, M91: 5, M92: 11,
  M93: 22, M94: 11, M95: 7, M96: 7, M97: 3, M98: 10,
  M99: 5, M100: 7, M101: 29, M102: 6, M103: 6, M104: 9,
  M105: 5, M106: 19, M107: 10, M108: 8, M109: 8, M110: 17,
};

/**
 * Score and filter observing targets based on telescope capabilities.
 */
export function getTelescopeTargets(
  spec: TelescopeSpec,
  visibleDSOs: Array<{ id: string; name: string | null; type: string; magnitude: number; altitude: number; azimuth?: number; ra?: number; dec?: number }>,
  visiblePlanets: Array<{ name: string; magnitude: number; altitude: number; azimuth?: number; ra?: number; dec?: number }>,
): ObservingTarget[] {
  const caps = computeCapabilities(spec);
  const targets: ObservingTarget[] = [];

  // Score DSOs
  for (const dso of visibleDSOs) {
    if (dso.magnitude > caps.limitingMagnitude) continue; // too faint
    if (dso.altitude < 5) continue;

    const angularSize = (DSO_SIZES[dso.id] ?? 10) / 60; // arcmin to degrees
    const fitsInFov = angularSize <= caps.trueFov;

    let difficulty: 'easy' | 'moderate' | 'challenging';
    if (dso.magnitude < 6 && dso.altitude > 20) difficulty = 'easy';
    else if (dso.magnitude < 8 && dso.altitude > 10) difficulty = 'moderate';
    else difficulty = 'challenging';

    // Tip based on telescope type and object
    let tip = '';
    if (!fitsInFov) {
      tip = `Use a lower magnification eyepiece — object is ${Math.round(angularSize * 60)}' wide`;
    } else if (dso.type === 'Galaxy' && caps.magnification < 50) {
      tip = 'Try higher magnification to see structure';
    } else if (dso.type === 'Open Cluster') {
      tip = 'Best at low power — scan slowly across the cluster';
    } else if (dso.type === 'Globular Cluster' && spec.aperture >= 150) {
      tip = 'Try 150x+ to resolve individual stars at the edges';
    } else if (dso.type === 'Planetary Nebula') {
      tip = 'Very small — use high magnification, look for a tiny disc';
    } else if (dso.type === 'Nebula' && spec.aperture < 100) {
      tip = 'Use averted vision — look slightly to the side';
    } else if (dso.altitude < 15) {
      tip = 'Low on horizon — wait for it to rise higher if possible';
    } else {
      tip = `${Math.round(caps.magnification)}x gives a ${caps.trueFov.toFixed(1)}° field`;
    }

    // Score: brightness + altitude + fame + fits-in-fov bonus
    let score = 0;
    score += (caps.limitingMagnitude - dso.magnitude) * 10; // brighter = higher score
    score += Math.min(dso.altitude, 60) * 0.5; // altitude bonus (caps at 60°)
    score += fitsInFov ? 10 : 0;
    score += dso.name ? 15 : 0; // named objects get a boost

    targets.push({
      id: dso.id,
      name: dso.name ?? dso.id,
      type: dso.type,
      magnitude: dso.magnitude,
      altitude: dso.altitude,
      azimuth: dso.azimuth ?? 0,
      ra: dso.ra ?? 0,
      dec: dso.dec ?? 0,
      fitsInFov,
      difficulty,
      tip,
      score,
    });
  }

  // Score planets
  for (const planet of visiblePlanets) {
    if (planet.altitude < 5) continue;

    let tip = '';
    if (planet.name === 'Jupiter' && caps.magnification >= 40) {
      tip = 'Look for cloud bands and up to 4 Galilean moons';
    } else if (planet.name === 'Saturn' && caps.magnification >= 50) {
      tip = 'Rings visible! Look for the Cassini Division at 100x+';
    } else if (planet.name === 'Mars' && caps.magnification >= 100) {
      tip = 'Look for polar ice caps and dark surface markings';
    } else if (planet.name === 'Venus') {
      tip = 'Shows phases like the Moon — currently a crescent or gibbous';
    } else if (planet.name === 'Mercury') {
      tip = 'Catch it quickly — it sets fast after the Sun';
    } else {
      tip = `${Math.round(caps.magnification)}x magnification`;
    }

    targets.push({
      id: planet.name.toLowerCase(),
      name: planet.name,
      type: 'Planet',
      magnitude: planet.magnitude,
      altitude: planet.altitude,
      azimuth: planet.azimuth ?? 0,
      ra: planet.ra ?? 0,
      dec: planet.dec ?? 0,
      fitsInFov: true,
      difficulty: 'easy',
      tip,
      score: 100 + (60 - Math.abs(planet.magnitude)) * 5, // planets always score high
    });
  }

  // Moon is always a great target
  targets.push({
    id: 'moon',
    name: 'Moon',
    type: 'Moon',
    magnitude: -12,
    altitude: 45, // placeholder
    azimuth: 0,
    ra: 0,
    dec: 0,
    fitsInFov: caps.trueFov >= 0.5,
    difficulty: 'easy',
    tip: caps.magnification >= 100
      ? 'Explore craters along the terminator — best detail there'
      : 'Increase magnification to see craters and maria',
    score: 200,
  });

  targets.sort((a, b) => b.score - a.score);
  return targets;
}
