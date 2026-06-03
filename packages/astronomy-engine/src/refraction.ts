/**
 * Atmospheric Refraction
 *
 * Implements the Saemundsson (1986) refraction formula as used by Stellarium.
 * Atmospheric refraction bends light upward near the horizon, making objects
 * appear higher than their true geometric position.
 *
 * At the horizon: ~34 arcminutes (0.57°) correction.
 * At 10° altitude: ~5 arcminutes.
 * At 45°+: negligible (<1 arcminute).
 *
 * @module refraction
 */

/**
 * Computes the atmospheric refraction correction in degrees.
 *
 * Uses the Saemundsson formula (S&T 1986 p70, also in Meeus "Astronomical Algorithms"):
 *   R = 1.02 / tan(h + 10.3/(h + 5.11)) + 0.0019279
 * where h is the apparent altitude in degrees and R is in arcminutes.
 *
 * Standard conditions: pressure 1010 mbar, temperature 10°C.
 *
 * @param altitudeDeg - Geometric altitude in degrees (-90 to +90)
 * @param pressureMbar - Atmospheric pressure in millibars (default: 1010)
 * @param temperatureC - Temperature in Celsius (default: 10)
 * @returns Refraction correction in degrees (always >= 0). Add to geometric altitude to get apparent.
 */
export function refractionCorrection(
  altitudeDeg: number,
  pressureMbar: number = 1010,
  temperatureC: number = 10,
): number {
  // Below -5° geometric altitude, refraction model is unreliable.
  // Smoothly taper to zero below that.
  if (altitudeDeg < -5) return 0;

  // Pressure/temperature scaling factor (standard = 1.0)
  const pFactor = (pressureMbar / 1010) * (283 / (273 + temperatureC));

  // Saemundsson formula — gives refraction in arcminutes
  const h = Math.max(altitudeDeg, -1.5); // clamp to avoid division issues
  const tanArg = (h + 10.3 / (h + 5.11)) * (Math.PI / 180);
  const tanVal = Math.tan(tanArg);

  // Avoid division by zero for extreme values
  if (Math.abs(tanVal) < 1e-10) return 0;

  const refractionArcmin = (1.02 / tanVal + 0.0019279) * pFactor;

  // Convert arcminutes to degrees, clamp to non-negative
  return Math.max(0, refractionArcmin / 60);
}

/**
 * Applies atmospheric refraction to a geometric altitude.
 *
 * @param geometricAltDeg - True geometric altitude in degrees
 * @param pressureMbar - Atmospheric pressure (default: 1010 mbar)
 * @param temperatureC - Temperature (default: 10°C)
 * @returns Apparent (refracted) altitude in degrees
 */
export function applyRefraction(
  geometricAltDeg: number,
  pressureMbar: number = 1010,
  temperatureC: number = 10,
): number {
  const correction = refractionCorrection(geometricAltDeg, pressureMbar, temperatureC);
  return geometricAltDeg + correction;
}

/**
 * Removes atmospheric refraction from an apparent altitude (inverse).
 * Uses iterative approach (converges in 2-3 iterations).
 *
 * @param apparentAltDeg - Apparent (refracted) altitude in degrees
 * @param pressureMbar - Atmospheric pressure (default: 1010 mbar)
 * @param temperatureC - Temperature (default: 10°C)
 * @returns Geometric (true) altitude in degrees
 */
export function removeRefraction(
  apparentAltDeg: number,
  pressureMbar: number = 1010,
  temperatureC: number = 10,
): number {
  // Iterative: find geometric alt such that applyRefraction(geo) ≈ apparent
  let geo = apparentAltDeg;
  for (let i = 0; i < 5; i++) {
    const apparent = applyRefraction(geo, pressureMbar, temperatureC);
    const delta = apparent - apparentAltDeg;
    geo -= delta;
    if (Math.abs(delta) < 0.0001) break; // 0.36 arcsec precision
  }
  return geo;
}
