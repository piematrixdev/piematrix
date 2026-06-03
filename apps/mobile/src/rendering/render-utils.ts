/**
 * Rendering Utility Functions
 * Shared utilities for star/planet rendering — full-screen rectangular projection
 */

import { SpectralType, HorizontalCoordinates } from '@virtual-window/astronomy-engine';

export const SPECTRAL_COLORS: Record<SpectralType, string> = {
  'O': '#9bb0ff',
  'B': '#aabfff',
  'A': '#cad7ff',
  'F': '#f8f7ff',
  'G': '#fff4ea',
  'K': '#ffd2a1',
  'M': '#ffcc6f',
};

export function magnitudeToRadius(magnitude: number, baseFov: number = 60): number {
  const baseRadius = 3;
  const scaleFactor = Math.pow(2.512, (2 - magnitude) / 2);
  const fovScale = 60 / baseFov;
  return Math.max(1, baseRadius * scaleFactor * fovScale);
}

export function spectralTypeToColor(spectralType: SpectralType): string {
  return SPECTRAL_COLORS[spectralType] || SPECTRAL_COLORS['G'];
}

export function angularDistance(a: HorizontalCoordinates, b: HorizontalCoordinates): number {
  const az1 = a.azimuth * Math.PI / 180;
  const alt1 = a.altitude * Math.PI / 180;
  const az2 = b.azimuth * Math.PI / 180;
  const alt2 = b.altitude * Math.PI / 180;
  const cosDistance = Math.sin(alt1) * Math.sin(alt2) +
                      Math.cos(alt1) * Math.cos(alt2) * Math.cos(az1 - az2);
  return Math.acos(Math.max(-1, Math.min(1, cosDistance))) * 180 / Math.PI;
}

export function isInFieldOfView(
  objectPosition: HorizontalCoordinates,
  viewCenter: HorizontalCoordinates,
  fov: number
): boolean {
  if (objectPosition.altitude < -5) return false;
  const distance = angularDistance(objectPosition, viewCenter);
  // Use diagonal FOV (larger than circular) to avoid clipping corners
  return distance <= fov * 0.85;
}

export function isAboveHorizon(altitude: number): boolean {
  return altitude >= 0;
}

export function getMagnitudeThreshold(fov: number): number {
  return fov < 45 ? 6.0 : 5.0;
}

export function constrainFov(fov: number): number {
  return Math.max(30, Math.min(120, fov));
}

export function shouldShowLabel(magnitude: number): boolean {
  return magnitude < 2.0;
}

/**
 * Converts horizontal coordinates to screen position.
 * Uses gnomonic projection with RECTANGULAR screen bounds (no circular clipping).
 * Objects are visible if they project within the screen rectangle + margin.
 */
export function horizontalToScreen(
  position: HorizontalCoordinates,
  viewCenter: HorizontalCoordinates,
  fov: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } | null {
  // Allow objects slightly below horizon for smooth transitions
  if (position.altitude < -5) return null;

  const centerAz = viewCenter.azimuth * Math.PI / 180;
  const centerAlt = viewCenter.altitude * Math.PI / 180;
  const objAz = position.azimuth * Math.PI / 180;
  const objAlt = position.altitude * Math.PI / 180;

  // Gnomonic projection
  const cosc = Math.sin(centerAlt) * Math.sin(objAlt) +
               Math.cos(centerAlt) * Math.cos(objAlt) * Math.cos(objAz - centerAz);

  if (cosc <= 0.01) return null; // Behind the viewer

  const x = (Math.cos(objAlt) * Math.sin(objAz - centerAz)) / cosc;
  const y = (Math.cos(centerAlt) * Math.sin(objAlt) -
             Math.sin(centerAlt) * Math.cos(objAlt) * Math.cos(objAz - centerAz)) / cosc;

  // Scale: use the shorter dimension for the specified FOV,
  // the longer dimension gets more sky (rectangular, not circular)
  const fovRad = fov * Math.PI / 180;
  const scale = Math.min(screenWidth, screenHeight) / (2 * Math.tan(fovRad / 2));

  const screenX = screenWidth / 2 + x * scale;
  const screenY = screenHeight / 2 - y * scale;

  // Rectangular bounds check with margin for labels/icons
  const margin = 30;
  if (screenX < -margin || screenX > screenWidth + margin ||
      screenY < -margin || screenY > screenHeight + margin) {
    return null;
  }

  return { x: screenX, y: screenY };
}
