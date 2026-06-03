/**
 * Moon_Calculator - Lunar Position and Phase Calculations
 *
 * Computes the Moon's position (RA/Dec), horizontal coordinates (Az/Alt),
 * lunar phase name, illumination percentage, and apparent magnitude using
 * the astronomy-engine npm package.
 *
 * @module moon-calculator
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import * as Astronomy from 'astronomy-engine';
import { celestialToHorizontal } from './coordinate-converter';
import type { GeographicCoordinates } from './index';

/**
 * Valid lunar phase names
 */
export type LunarPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

/**
 * Moon position and phase information
 */
export interface MoonPosition {
  /** Right Ascension in hours (0-24) */
  ra: number;
  /** Declination in degrees (-90 to +90) */
  dec: number;
  /** Horizontal azimuth (0-360) */
  azimuth: number;
  /** Horizontal altitude (-90 to +90) */
  altitude: number;
  /** Current phase name */
  phaseName: LunarPhaseName;
  /** Illumination percentage (0-100) */
  illumination: number;
  /** Phase angle in degrees (0=New, 180=Full) */
  phaseAngle: number;
  /** Apparent magnitude */
  magnitude: number;
  /** True if altitude < 0 */
  isBelowHorizon: boolean;
}

/**
 * Interface for the Moon Calculator
 */
export interface MoonCalculator {
  /**
   * Calculates Moon position and phase for given time and location
   * @param timestamp - Date for position calculation
   * @param observer - Observer's geographic coordinates
   * @param lst - Local Sidereal Time in decimal hours
   * @returns MoonPosition with all calculated values
   */
  calculate(
    timestamp: Date,
    observer: GeographicCoordinates,
    lst: number
  ): MoonPosition;
}


/**
 * Creates an observer object for the astronomy-engine library
 */
function createObserver(coords: GeographicCoordinates): Astronomy.Observer {
  return new Astronomy.Observer(coords.latitude, coords.longitude, 0);
}

/**
 * Calculates the equatorial coordinates (RA/Dec) for the Moon
 * @param date - The date for calculation
 * @param observer - The observer's location
 * @returns Object with ra (in hours) and dec (in degrees)
 */
function calculateMoonEquatorialCoordinates(
  date: Date,
  observer: Astronomy.Observer
): { ra: number; dec: number } {
  // Get equatorial coordinates of the Moon
  // Using true equator and equinox of date, with aberration correction
  const equator = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true);

  return {
    ra: equator.ra,   // Right Ascension in hours (0-24)
    dec: equator.dec, // Declination in degrees (-90 to +90)
  };
}

/**
 * Gets the lunar phase angle (0-360 degrees)
 * Phase angle: 0° = New Moon, 180° = Full Moon
 * @param date - The date for calculation
 * @returns Phase angle in degrees (0-360)
 */
function getMoonPhaseAngle(date: Date): number {
  const phase = Astronomy.MoonPhase(date);
  return phase;
}

/**
 * Determines the lunar phase name from the phase angle
 * Phase angle ranges (centered on each phase):
 * - 337.5-22.5°: New Moon (centered at 0°)
 * - 22.5-67.5°: Waxing Crescent (centered at 45°)
 * - 67.5-112.5°: First Quarter (centered at 90°)
 * - 112.5-157.5°: Waxing Gibbous (centered at 135°)
 * - 157.5-202.5°: Full Moon (centered at 180°)
 * - 202.5-247.5°: Waning Gibbous (centered at 225°)
 * - 247.5-292.5°: Last Quarter (centered at 270°)
 * - 292.5-337.5°: Waning Crescent (centered at 315°)
 * @param phaseAngle - Phase angle in degrees (0-360)
 * @returns Lunar phase name
 */
function getPhaseName(phaseAngle: number): LunarPhaseName {
  // Normalize angle to 0-360 range
  const normalizedAngle = ((phaseAngle % 360) + 360) % 360;

  // Each phase spans 45 degrees, centered on the traditional phase points
  if (normalizedAngle < 22.5 || normalizedAngle >= 337.5) {
    return 'New Moon';
  } else if (normalizedAngle < 67.5) {
    return 'Waxing Crescent';
  } else if (normalizedAngle < 112.5) {
    return 'First Quarter';
  } else if (normalizedAngle < 157.5) {
    return 'Waxing Gibbous';
  } else if (normalizedAngle < 202.5) {
    return 'Full Moon';
  } else if (normalizedAngle < 247.5) {
    return 'Waning Gibbous';
  } else if (normalizedAngle < 292.5) {
    return 'Last Quarter';
  } else {
    return 'Waning Crescent';
  }
}


/**
 * Calculates the Moon's illumination percentage (0-100%)
 * Uses the phase angle to compute illumination fraction
 * @param phaseAngle - Phase angle in degrees (0-360)
 * @returns Illumination percentage (0-100)
 */
function calculateIllumination(phaseAngle: number): number {
  // Illumination is based on the phase angle
  // At 0° (New Moon), illumination is 0%
  // At 180° (Full Moon), illumination is 100%
  // Formula: illumination = (1 - cos(phaseAngle)) / 2 * 100
  const phaseRadians = (phaseAngle * Math.PI) / 180;
  const illumination = ((1 - Math.cos(phaseRadians)) / 2) * 100;
  
  // Clamp to 0-100 range to handle floating point errors
  return Math.max(0, Math.min(100, illumination));
}

/**
 * Calculates the Moon's apparent magnitude based on phase
 * The Moon's magnitude varies from about -12.7 (full) to not visible (new)
 * @param illumination - Illumination percentage (0-100)
 * @returns Apparent magnitude
 */
function calculateMagnitude(illumination: number): number {
  // Full Moon magnitude is approximately -12.7
  // The magnitude increases (gets dimmer) as illumination decreases
  // Using a logarithmic relationship:
  // At 100% illumination: magnitude ≈ -12.7
  // At 50% illumination: magnitude ≈ -10.0
  // At very low illumination: magnitude approaches positive values
  
  if (illumination <= 0) {
    // New Moon - essentially not visible
    return 0;
  }
  
  // Base magnitude at full moon
  const fullMoonMagnitude = -12.7;
  
  // Magnitude adjustment based on illumination
  // Using the formula: mag = fullMoonMag + 2.5 * log10(100 / illumination)
  const magnitudeAdjustment = 2.5 * Math.log10(100 / illumination);
  
  return fullMoonMagnitude + magnitudeAdjustment;
}

/**
 * Creates a Moon Calculator instance
 */
export function createMoonCalculator(): MoonCalculator {
  return {
    calculate(
      timestamp: Date,
      observer: GeographicCoordinates,
      lst: number
    ): MoonPosition {
      const astroObserver = createObserver(observer);
      
      // Calculate equatorial coordinates (RA/Dec)
      const { ra, dec } = calculateMoonEquatorialCoordinates(timestamp, astroObserver);
      
      // Convert to horizontal coordinates (Az/Alt) using existing converter
      const horizontal = celestialToHorizontal(
        { ra, dec },
        observer,
        lst
      );
      
      // Calculate phase information
      const phaseAngle = getMoonPhaseAngle(timestamp);
      const phaseName = getPhaseName(phaseAngle);
      const illumination = calculateIllumination(phaseAngle);
      const magnitude = calculateMagnitude(illumination);
      
      return {
        ra,
        dec,
        azimuth: horizontal.azimuth,
        altitude: horizontal.altitude,
        phaseName,
        illumination,
        phaseAngle,
        magnitude,
        isBelowHorizon: horizontal.altitude < 0,
      };
    },
  };
}

/**
 * Default moon calculator instance
 */
export const moonCalculator = createMoonCalculator();

export default createMoonCalculator;
