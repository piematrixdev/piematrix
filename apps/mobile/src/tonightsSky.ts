/**
 * Tonight's Sky — computes what's visible tonight from the user's location.
 * Pure math, no AI needed. Uses the astronomy engine to predict:
 * - Visible planets and their best viewing times
 * - Moon phase and rise/set
 * - Best Messier objects visible tonight
 * - Active meteor showers
 * - Featured constellations
 */

import {
  GeographicCoordinates, Planet,
  createPlanetCalculator,
  createMoonCalculator,
  createSunCalculator,
  createDeepSkyCatalog,
  createMeteorShowerCatalog,
  celestialToHorizontal,
  calculateLST,
} from '@virtual-window/astronomy-engine';

export interface PlanetEvent {
  name: string;
  magnitude: number;
  altitude: number;
  azimuth: number;
  ra: number;   // hours
  dec: number;  // degrees
  constellation: string;
  description: string;
}

export interface MoonEvent {
  phaseName: string;
  illumination: number;
  altitude: number;
  isUp: boolean;
  description: string;
}

export interface DeepSkyHighlight {
  id: string;
  name: string | null;
  type: string;
  magnitude: number;
  altitude: number;
  azimuth: number;
  ra: number;   // hours
  dec: number;  // degrees
  description: string;
}

export interface MeteorShowerEvent {
  name: string;
  zhr: number;
  daysFromPeak: number;
  isActive: boolean;
  description: string;
}

export interface ConstellationHighlight {
  name: string;
  altitude: number;
  description: string;
}

export interface TonightsSkyData {
  planets: PlanetEvent[];
  moon: MoonEvent | null;
  deepSky: DeepSkyHighlight[];
  meteorShowers: MeteorShowerEvent[];
  constellations: ConstellationHighlight[];
  sunsetTime: string;
  bestViewingTime: string;
  summary: string;
}

// Approximate constellation for a given RA/Dec
function getApproxConstellation(ra: number, dec: number): string {
  // Simplified — map RA ranges to prominent constellations
  const raHours = ra;
  if (raHours >= 0 && raHours < 2) return dec > 20 ? 'Andromeda' : 'Pisces';
  if (raHours >= 2 && raHours < 4) return dec > 20 ? 'Aries' : 'Cetus';
  if (raHours >= 4 && raHours < 6) return dec > 20 ? 'Taurus' : 'Orion';
  if (raHours >= 6 && raHours < 8) return dec > 20 ? 'Gemini' : 'Canis Major';
  if (raHours >= 8 && raHours < 10) return dec > 20 ? 'Cancer' : 'Hydra';
  if (raHours >= 10 && raHours < 12) return dec > 20 ? 'Leo' : 'Virgo';
  if (raHours >= 12 && raHours < 14) return dec > 20 ? 'Coma Berenices' : 'Virgo';
  if (raHours >= 14 && raHours < 16) return dec > 20 ? 'Boötes' : 'Libra';
  if (raHours >= 16 && raHours < 18) return dec > 20 ? 'Hercules' : 'Scorpius';
  if (raHours >= 18 && raHours < 20) return dec > 20 ? 'Lyra' : 'Sagittarius';
  if (raHours >= 20 && raHours < 22) return dec > 20 ? 'Cygnus' : 'Aquarius';
  return dec > 20 ? 'Pegasus' : 'Aquarius';
}

// Named Messier objects for better descriptions
const MESSIER_NAMES: Record<string, string> = {
  M1: 'Crab Nebula', M4: 'Cat\'s Eye Cluster', M6: 'Butterfly Cluster',
  M7: 'Ptolemy Cluster', M8: 'Lagoon Nebula', M11: 'Wild Duck Cluster',
  M13: 'Hercules Cluster', M15: 'Pegasus Cluster', M16: 'Eagle Nebula',
  M17: 'Omega Nebula', M20: 'Trifid Nebula', M22: 'Sagittarius Cluster',
  M27: 'Dumbbell Nebula', M31: 'Andromeda Galaxy', M33: 'Triangulum Galaxy',
  M35: 'Gemini Cluster', M37: 'Auriga Cluster', M42: 'Orion Nebula',
  M44: 'Beehive Cluster', M45: 'Pleiades', M46: 'Puppis Cluster',
  M47: 'Puppis Open Cluster', M51: 'Whirlpool Galaxy', M57: 'Ring Nebula',
  M63: 'Sunflower Galaxy', M64: 'Black Eye Galaxy', M78: 'Orion Reflection Nebula',
  M81: 'Bode\'s Galaxy', M82: 'Cigar Galaxy', M83: 'Southern Pinwheel',
  M92: 'Hercules Globular', M101: 'Pinwheel Galaxy', M104: 'Sombrero Galaxy',
  M110: 'Andromeda Companion',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  Galaxy: 'galaxy',
  Nebula: 'emission nebula',
  'Open Cluster': 'open star cluster',
  'Globular Cluster': 'globular cluster',
  'Planetary Nebula': 'planetary nebula',
};

/**
 * Compute tonight's sky highlights for a given location.
 * Uses current time if it's nighttime, or upcoming evening if daytime.
 */
export function computeTonightsSky(observer: GeographicCoordinates): TonightsSkyData {
  const now = new Date();
  const hour = now.getHours();

  // Determine the best viewing time to compute for:
  // - If currently nighttime (7 PM - 5 AM): use NOW (show what's visible right now)
  // - If daytime (5 AM - 7 PM): use tonight at 10 PM (preview tonight's sky)
  let viewingTime: Date;
  if (hour >= 19 || hour < 5) {
    // It's nighttime — show what's visible RIGHT NOW
    viewingTime = now;
  } else {
    // It's daytime — show what will be visible tonight
    viewingTime = new Date(now);
    viewingTime.setHours(22, 0, 0, 0);
  }

  const lst = calculateLST(observer.longitude, viewingTime);

  // --- Planets ---
  const pc = createPlanetCalculator();
  const planets = pc.calculatePlanetPositions(viewingTime, observer);
  const planetEvents: PlanetEvent[] = [];

  for (const planet of planets) {
    const hz = celestialToHorizontal({ ra: planet.ra, dec: planet.dec }, observer, lst);
    if (hz.altitude > 5) {
      const constellation = getApproxConstellation(planet.ra, planet.dec);
      let desc = '';
      if (planet.magnitude < 0) desc = `Brilliant at magnitude ${planet.magnitude.toFixed(1)}`;
      else if (planet.magnitude < 1) desc = `Bright and easy to spot`;
      else desc = `Visible with clear skies`;

      if (hz.altitude > 45) desc += ', high in the sky';
      else if (hz.altitude > 20) desc += ', well placed for viewing';
      else desc += ', low on the horizon';

      planetEvents.push({
        name: planet.name,
        magnitude: planet.magnitude,
        altitude: hz.altitude,
        azimuth: hz.azimuth,
        ra: planet.ra,
        dec: planet.dec,
        constellation,
        description: desc,
      });
    }
  }
  planetEvents.sort((a, b) => a.magnitude - b.magnitude); // brightest first

  // --- Moon ---
  const mc = createMoonCalculator();
  const moonPos = mc.calculate(viewingTime, observer, lst);
  const moonEvent: MoonEvent = {
    phaseName: moonPos.phaseName,
    illumination: moonPos.illumination,
    altitude: moonPos.altitude,
    isUp: moonPos.altitude > 0,
    description: moonPos.illumination > 80
      ? `Bright ${moonPos.phaseName.toLowerCase()} — may wash out faint objects`
      : moonPos.illumination < 20
        ? `Dark skies — excellent for deep sky viewing`
        : `${Math.round(moonPos.illumination)}% illuminated — moderate conditions`,
  };

  // --- Deep Sky Objects ---
  const dsc = createDeepSkyCatalog();
  const dsoPositions = dsc.getVisibleObjects(observer, lst, 8.0);
  const deepSkyHighlights: DeepSkyHighlight[] = [];

  for (const dso of dsoPositions) {
    if (dso.altitude < 5) continue; // above horizon is enough
    const name = MESSIER_NAMES[dso.object.id] ?? dso.object.name;
    const typeDesc = TYPE_DESCRIPTIONS[dso.object.type] ?? dso.object.type.toLowerCase();
    let desc = name
      ? `The ${name}, a ${typeDesc}`
      : `A ${typeDesc} in the night sky`;
    if (dso.object.magnitude < 5) desc += ' — visible to the naked eye';
    else if (dso.object.magnitude < 7) desc += ' — binocular target';
    else desc += ' — telescope recommended';

    if (dso.altitude < 15) desc += ' (low on horizon)';

    deepSkyHighlights.push({
      id: dso.object.id,
      name: name ?? null,
      type: dso.object.type,
      magnitude: dso.object.magnitude,
      altitude: dso.altitude,
      azimuth: dso.azimuth,
      ra: dso.object.ra,
      dec: dso.object.dec,
      description: desc,
    });
  }
  // Sort by: named/famous objects first, then brightness, then altitude as tiebreaker
  deepSkyHighlights.sort((a, b) => {
    // Prioritize objects with well-known names
    const aFamous = MESSIER_NAMES[a.id] ? 1 : 0;
    const bFamous = MESSIER_NAMES[b.id] ? 1 : 0;
    if (bFamous !== aFamous) return bFamous - aFamous;
    // Then by brightness (lower magnitude = brighter)
    if (Math.abs(a.magnitude - b.magnitude) > 0.5) return a.magnitude - b.magnitude;
    // Then by altitude
    return b.altitude - a.altitude;
  });
  const topDSOs = deepSkyHighlights.slice(0, 6);

  // --- Meteor Showers ---
  const msc = createMeteorShowerCatalog();
  const activeShowers = msc.getActiveShowers(viewingTime);
  const meteorEvents: MeteorShowerEvent[] = activeShowers.map(shower => {
    const daysFromPeak = getDaysFromPeak(shower.peakMonth, shower.peakDay, viewingTime);
    let desc = '';
    if (Math.abs(daysFromPeak) <= 1) desc = `Peak tonight! Up to ${shower.zhr} meteors/hour`;
    else if (daysFromPeak < 0) desc = `Peaks in ${Math.abs(daysFromPeak)} days — activity building`;
    else desc = `${daysFromPeak} days past peak — still active`;
    return {
      name: shower.name,
      zhr: shower.zhr,
      daysFromPeak,
      isActive: true,
      description: desc,
    };
  });

  // --- Constellations ---
  const constellationHighlights = getTopConstellations(observer, lst);

  // --- Sun ---
  const sc = createSunCalculator();
  const sunNow = sc.calculate(now, observer, calculateLST(observer.longitude, now));
  const sunsetTime = sunNow.altitude > 0 ? estimateSunset(observer) : 'Already set';

  // Best viewing time based on current conditions
  let bestViewing: string;
  if (hour >= 19 || hour < 5) {
    bestViewing = 'Right now — sky is dark';
  } else if (moonEvent.illumination > 70) {
    bestViewing = 'After midnight (bright moon early)';
  } else {
    bestViewing = '9 PM – 2 AM';
  }

  // --- Summary ---
  const isLive = hour >= 19 || hour < 5;
  const highlights: string[] = [];
  if (planetEvents.length > 0) highlights.push(`${planetEvents[0].name} visible`);
  if (meteorEvents.length > 0) highlights.push(`${meteorEvents[0].name} active`);
  if (topDSOs.length > 0 && topDSOs[0].name) highlights.push(topDSOs[0].name);
  let summary = highlights.length > 0
    ? highlights.join(' • ')
    : 'Clear skies for stargazing';
  if (isLive) summary = 'Live — ' + summary;

  return {
    planets: planetEvents,
    moon: moonEvent,
    deepSky: topDSOs,
    meteorShowers: meteorEvents,
    constellations: constellationHighlights,
    sunsetTime,
    bestViewingTime: bestViewing,
    summary,
  };
}

function getDaysFromPeak(peakMonth: number, peakDay: number, date: Date): number {
  const year = date.getFullYear();
  const peak = new Date(year, peakMonth - 1, peakDay);
  const diff = (date.getTime() - peak.getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
}

function estimateSunset(observer: GeographicCoordinates): string {
  // Rough estimate based on latitude and time of year
  const now = new Date();
  const month = now.getMonth();
  // Northern hemisphere summer = later sunset
  const latFactor = observer.latitude > 0 ? 1 : -1;
  const summerOffset = Math.sin((month - 3) * Math.PI / 6) * latFactor;
  const baseHour = 18 + summerOffset;
  const h = Math.floor(baseHour);
  const m = Math.round((baseHour - h) * 60);
  return `~${h}:${m.toString().padStart(2, '0')} PM`;
}

function getTopConstellations(observer: GeographicCoordinates, lst: number): ConstellationHighlight[] {
  // Seasonal constellation highlights
  const month = new Date().getMonth();
  const seasonal: Array<{ name: string; ra: number; dec: number; desc: string }> = [];

  // Winter (Dec-Feb)
  if (month >= 11 || month <= 1) {
    seasonal.push({ name: 'Orion', ra: 5.5, dec: 0, desc: 'The Hunter dominates the southern sky' });
    seasonal.push({ name: 'Taurus', ra: 4.5, dec: 16, desc: 'Look for the Pleiades star cluster' });
    seasonal.push({ name: 'Gemini', ra: 7, dec: 22, desc: 'The Twins rise high overhead' });
  }
  // Spring (Mar-May)
  else if (month >= 2 && month <= 4) {
    seasonal.push({ name: 'Leo', ra: 10.5, dec: 12, desc: 'The Lion prowls the southern sky' });
    seasonal.push({ name: 'Virgo', ra: 13, dec: -3, desc: 'Home to many galaxies' });
    seasonal.push({ name: 'Boötes', ra: 14.5, dec: 19, desc: 'Follow the arc to Arcturus' });
  }
  // Summer (Jun-Aug)
  else if (month >= 5 && month <= 7) {
    seasonal.push({ name: 'Scorpius', ra: 16.5, dec: -26, desc: 'Red Antares marks the heart' });
    seasonal.push({ name: 'Sagittarius', ra: 19, dec: -25, desc: 'Points toward the galactic center' });
    seasonal.push({ name: 'Lyra', ra: 18.6, dec: 39, desc: 'Bright Vega in the Summer Triangle' });
  }
  // Autumn (Sep-Nov)
  else {
    seasonal.push({ name: 'Pegasus', ra: 22, dec: 20, desc: 'The Great Square marks autumn skies' });
    seasonal.push({ name: 'Andromeda', ra: 1, dec: 35, desc: 'Home to our nearest galaxy neighbor' });
    seasonal.push({ name: 'Cassiopeia', ra: 1, dec: 60, desc: 'The W-shape near the North Star' });
  }

  const results: ConstellationHighlight[] = [];
  for (const c of seasonal) {
    const hz = celestialToHorizontal({ ra: c.ra, dec: c.dec }, observer, lst);
    if (hz.altitude > 10) {
      results.push({ name: c.name, altitude: hz.altitude, description: c.desc });
    }
  }
  return results;
}
