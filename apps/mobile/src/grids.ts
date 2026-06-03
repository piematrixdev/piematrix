/**
 * Sky grid generators — horizon line, altitude grid, azimuth grid, equatorial grid.
 * Returns arrays of line segments in horizontal coordinates for projection.
 */

import { HorizontalCoordinates, celestialToHorizontal, GeographicCoordinates } from '@virtual-window/astronomy-engine';

export interface GridLine {
  points: HorizontalCoordinates[];
  label?: string;
  labelPos?: HorizontalCoordinates;
}

/** Horizon line at altitude=0, full 360° circle */
export function getHorizonLine(): GridLine {
  const points: HorizontalCoordinates[] = [];
  for (let az = 0; az <= 360; az += 2) {
    points.push({ azimuth: az % 360, altitude: 0 });
  }
  return { points };
}

/** Cardinal direction markers on the horizon */
export function getCardinalMarkers(): Array<{ label: string; pos: HorizontalCoordinates }> {
  return [
    { label: 'N', pos: { azimuth: 0, altitude: 0 } },
    { label: 'NE', pos: { azimuth: 45, altitude: 0 } },
    { label: 'E', pos: { azimuth: 90, altitude: 0 } },
    { label: 'SE', pos: { azimuth: 135, altitude: 0 } },
    { label: 'S', pos: { azimuth: 180, altitude: 0 } },
    { label: 'SW', pos: { azimuth: 225, altitude: 0 } },
    { label: 'W', pos: { azimuth: 270, altitude: 0 } },
    { label: 'NW', pos: { azimuth: 315, altitude: 0 } },
  ];
}

/** Altitude grid — circles at 15°, 30°, 45°, 60°, 75° altitude */
export function getAltitudeGrid(): GridLine[] {
  const lines: GridLine[] = [];
  for (const alt of [15, 30, 45, 60, 75]) {
    const points: HorizontalCoordinates[] = [];
    for (let az = 0; az <= 360; az += 3) {
      points.push({ azimuth: az % 360, altitude: alt });
    }
    lines.push({
      points,
      label: `${alt}°`,
      labelPos: { azimuth: 0, altitude: alt },
    });
  }
  return lines;
}

/** Azimuth grid — lines from horizon to zenith at every 30° azimuth */
export function getAzimuthGrid(): GridLine[] {
  const lines: GridLine[] = [];
  const labels: Record<number, string> = {
    0: 'N', 30: '30°', 60: '60°', 90: 'E', 120: '120°', 150: '150°',
    180: 'S', 210: '210°', 240: '240°', 270: 'W', 300: '300°', 330: '330°',
  };
  for (let az = 0; az < 360; az += 30) {
    const points: HorizontalCoordinates[] = [];
    for (let alt = 0; alt <= 90; alt += 2) {
      points.push({ azimuth: az, altitude: alt });
    }
    lines.push({
      points,
      label: labels[az],
      labelPos: { azimuth: az, altitude: 5 },
    });
  }
  return lines;
}

/**
 * Equatorial grid — RA/Dec lines projected to horizontal coordinates.
 * RA lines (hour circles) at every 2h, Dec lines at every 15°.
 */
export function getEquatorialGrid(
  observer: GeographicCoordinates,
  lst: number,
): GridLine[] {
  const lines: GridLine[] = [];

  // RA hour circles (vertical lines in equatorial frame)
  for (let raH = 0; raH < 24; raH += 2) {
    const points: HorizontalCoordinates[] = [];
    for (let dec = -80; dec <= 80; dec += 3) {
      const hz = celestialToHorizontal({ ra: raH, dec }, observer, lst);
      if (hz.altitude > -10) points.push(hz);
    }
    if (points.length > 2) {
      lines.push({
        points,
        label: `${raH}h`,
        labelPos: celestialToHorizontal({ ra: raH, dec: 0 }, observer, lst),
      });
    }
  }

  // Dec circles (horizontal lines in equatorial frame)
  for (const dec of [-60, -30, 0, 30, 60]) {
    const points: HorizontalCoordinates[] = [];
    for (let raH = 0; raH <= 24; raH += 0.25) {
      const hz = celestialToHorizontal({ ra: raH, dec }, observer, lst);
      if (hz.altitude > -10) points.push(hz);
    }
    if (points.length > 2) {
      const label = dec === 0 ? 'Eq' : `${dec > 0 ? '+' : ''}${dec}°`;
      lines.push({
        points,
        label,
        labelPos: celestialToHorizontal({ ra: lst, dec }, observer, lst),
      });
    }
  }

  return lines;
}
