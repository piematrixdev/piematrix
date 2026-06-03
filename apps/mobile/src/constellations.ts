/**
 * Constellation line renderer for mobile.
 * Uses bundled 88-constellation data with embedded RA/Dec coordinates.
 */

import { HorizontalCoordinates, celestialToHorizontal, GeographicCoordinates } from '@virtual-window/astronomy-engine';
import rawData from './data/constellations.json';

interface ConstellationData {
  id: string;
  name: string;
  lines: Array<{
    star1: { hipId: number; ra: number; dec: number };
    star2: { hipId: number; ra: number; dec: number };
  }>;
  centerRA: number;
  centerDec: number;
}

export interface ConstellationSegment {
  id: string;
  name: string;
  start: HorizontalCoordinates;
  end: HorizontalCoordinates;
}

const constellations = rawData as ConstellationData[];

/**
 * Compute visible constellation line segments.
 * RA values in the JSON are in degrees (0-360), celestialToHorizontal expects hours (0-24).
 */
export function getConstellationLines(
  observer: GeographicCoordinates,
  lst: number,
): ConstellationSegment[] {
  const segments: ConstellationSegment[] = [];

  for (const c of constellations) {
    for (const line of c.lines) {
      if (line.star1.ra === 0 && line.star1.dec === 0) continue; // skip empty data

      const start = celestialToHorizontal(
        { ra: line.star1.ra / 15, dec: line.star1.dec }, observer, lst
      );
      const end = celestialToHorizontal(
        { ra: line.star2.ra / 15, dec: line.star2.dec }, observer, lst
      );

      // Show if at least one end is above horizon
      if (start.altitude > -5 || end.altitude > -5) {
        segments.push({ id: c.id, name: c.name, start, end });
      }
    }
  }

  return segments;
}

/**
 * Get constellation label positions.
 */
export function getConstellationLabels(
  observer: GeographicCoordinates,
  lst: number,
): Array<{ id: string; name: string; pos: HorizontalCoordinates }> {
  const labels: Array<{ id: string; name: string; pos: HorizontalCoordinates }> = [];

  for (const c of constellations) {
    if (c.centerRA === 0 && c.centerDec === 0) continue;
    const pos = celestialToHorizontal({ ra: c.centerRA / 15, dec: c.centerDec }, observer, lst);
    if (pos.altitude > 5) {
      labels.push({ id: c.id, name: c.name, pos });
    }
  }

  return labels;
}
