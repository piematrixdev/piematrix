/**
 * Star loading — OFFLINE, file-based (no database).
 *
 * Reads the bundled Gaia DR3 Best binary tiers via ./starCatalog.
 * Public API is unchanged so callers (useSkyEngine, SkyRenderer) need
 * no edits: loadStarsProgressively / loadStarsForZoom /
 * loadStarsForMagnitude / getCachedStarCount / fovToMagnitude.
 */

import type { Star } from '@virtual-window/astronomy-engine';
import { loadStarsUpToMagnitude } from './starCatalog';

// Cache of the largest set loaded so far.
let loadedMagnitude = 0;
let cachedStars: Star[] = [];
let isLoading = false;

/**
 * FOV to visible magnitude limit.
 * At wide FOV shows naked-eye stars; at telescope zoom levels shows
 * fainter stars matching what a scope would reveal.
 * FOV 55° → mag 6.5, FOV 20° → mag 8.5, FOV 5° → mag 10.
 */
export function fovToMagnitude(fov: number): number {
  const baseMag = 6.5;
  const defaultFov = 55;
  const magGain = Math.log2(defaultFov / Math.max(fov, 3)) * 1.2;
  const magLoss = Math.max(0, (fov - defaultFov) / 30);
  return Math.min(10, Math.max(3.0, baseMag + magGain - magLoss));
}

/**
 * Effective limiting magnitude — the Stellarium-style realistic model.
 *
 * The naked-eye limit comes from the sky brightness (Bortle scale, passed in
 * as `nakedEyeMag`). At a natural human field of view (~60°) you see exactly
 * down to that limit and no more — this is what keeps the sky from being an
 * unrealistic swarm of stars under light-polluted skies.
 *
 * Zooming in simulates optical aid (binoculars → telescope). Each halving of
 * the FOV below the reference reveals roughly one extra magnitude of fainter
 * stars, capped at +5 over the naked-eye limit so even a deep zoom stays
 * believable. The absolute ceiling matches the deepest catalog tier.
 *
 * @param fov         current field of view (degrees, min screen dimension)
 * @param nakedEyeMag Bortle-derived naked-eye limiting magnitude
 */
export function effectiveLimitingMagnitude(fov: number, nakedEyeMag: number): number {
  const refFov = 60; // natural unaided field of view
  if (fov >= refFov) return nakedEyeMag;
  const aidedBonus = Math.min(5.0, Math.log2(refFov / Math.max(fov, 1)) * 1.0);
  // Cap at 10.0: matches the full L2 tier we preload (192k stars). Going higher
  // would pull the 646k-star L3 tier, too many to render on a phone and far too
  // faint to read; staying at 10 means zoom reveals stars with no reload hitch.
  return Math.min(10.0, nakedEyeMag + aidedBonus);
}

/** Internal: load up to targetMag from the offline catalog, with fallback. */
async function fetchUpToMagnitude(targetMag: number): Promise<Star[]> {
  try {
    const stars = await loadStarsUpToMagnitude(targetMag);
    if (stars.length > 0) return stars;
  } catch (e: any) {
    console.warn('[stars] offline catalog load failed:', e?.message ?? String(e), e?.stack ?? '');
  }
  return FALLBACK_STARS;
}

/**
 * Progressive star loader — loads in phases for fast initial display.
 * Caps at L1 (16k stars, mag ≤ 6.5) for smooth 60fps rendering.
 * L2 (192k) only loads on explicit deep zoom request.
 */
export async function loadStarsProgressively(
  onStars: (stars: Star[], phase: string) => void,
): Promise<void> {
  // Phase 1: bright stars (mag ≤ 4) — instant, tiny tier
  const bright = await fetchUpToMagnitude(4.0);
  if (bright.length > 0) {
    cachedStars = bright;
    loadedMagnitude = 4.0;
    onStars(bright, `${bright.length} bright stars`);
  }

  // Phase 2: naked-eye stars (mag ≤ 6.5) — quick, gives a full sky fast.
  const medium = await fetchUpToMagnitude(6.5);
  if (medium.length > bright.length) {
    cachedStars = medium;
    loadedMagnitude = 6.5;
    onStars(medium, `${medium.length} stars`);
  }

  // Phase 3: full deep catalog (mag ≤ 10 — the entire L2 tier, ~192k stars).
  // Decoded in chunks (see starCatalog) so it never blocks touch. Loading it
  // up front means deep zoom reveals fainter stars instantly with no reload
  // hitch, and the renderer's per-FOV magnitude clip keeps the wide view clean.
  const deep = await fetchUpToMagnitude(10.0);
  if (deep.length > medium.length) {
    cachedStars = deep;
    loadedMagnitude = 10.0;
    onStars(deep, `${deep.length} stars`);
  }
}

/** Load additional stars for a given FOV (zoom level). */
export async function loadStarsForZoom(
  fov: number,
  nakedEyeMag: number,
  onStars: (stars: Star[], phase: string) => void,
): Promise<void> {
  const targetMag = effectiveLimitingMagnitude(fov, nakedEyeMag);
  // Only load deeper tiers if we need more than what's cached
  if (targetMag <= loadedMagnitude || isLoading) return;
  isLoading = true;
  try {
    const stars = await fetchUpToMagnitude(targetMag);
    if (stars.length > cachedStars.length) {
      cachedStars = stars;
      loadedMagnitude = targetMag;
      onStars(stars, `${stars.length} stars (mag ${targetMag.toFixed(1)})`);
    }
  } finally {
    isLoading = false;
  }
}

/** Load stars up to a specific magnitude (triggered by Bortle change). */
export async function loadStarsForMagnitude(
  targetMag: number,
  onStars: (stars: Star[], phase: string) => void,
): Promise<void> {
  if (targetMag <= loadedMagnitude || isLoading) return;
  isLoading = true;
  try {
    const stars = await fetchUpToMagnitude(targetMag);
    if (stars.length > cachedStars.length) {
      cachedStars = stars;
      loadedMagnitude = targetMag;
      onStars(stars, `${stars.length} stars (mag ${targetMag.toFixed(1)})`);
    }
  } finally {
    isLoading = false;
  }
}

export function getCachedStarCount(): number {
  return cachedStars.length;
}

const FALLBACK_STARS: Star[] = [
  { id: 'HIP32349', name: 'Sirius', ra: 6.752, dec: -16.716, magnitude: -1.46, spectralType: 'A' },
  { id: 'HIP30438', name: 'Canopus', ra: 6.399, dec: -52.696, magnitude: -0.74, spectralType: 'F' },
  { id: 'HIP69673', name: 'Arcturus', ra: 14.261, dec: 19.182, magnitude: -0.05, spectralType: 'K' },
  { id: 'HIP91262', name: 'Vega', ra: 18.616, dec: 38.784, magnitude: 0.03, spectralType: 'A' },
  { id: 'HIP24436', name: 'Capella', ra: 5.278, dec: 45.998, magnitude: 0.08, spectralType: 'G' },
  { id: 'HIP24608', name: 'Rigel', ra: 5.242, dec: -8.202, magnitude: 0.13, spectralType: 'B' },
  { id: 'HIP37279', name: 'Procyon', ra: 7.655, dec: 5.225, magnitude: 0.34, spectralType: 'F' },
  { id: 'HIP27989', name: 'Betelgeuse', ra: 5.919, dec: 7.407, magnitude: 0.42, spectralType: 'M' },
  { id: 'HIP97649', name: 'Altair', ra: 19.846, dec: 8.868, magnitude: 0.76, spectralType: 'A' },
  { id: 'HIP21421', name: 'Aldebaran', ra: 4.599, dec: 16.509, magnitude: 0.85, spectralType: 'K' },
  { id: 'HIP65474', name: 'Spica', ra: 13.42, dec: -11.161, magnitude: 0.97, spectralType: 'B' },
  { id: 'HIP80763', name: 'Antares', ra: 16.49, dec: -26.432, magnitude: 1.04, spectralType: 'M' },
  { id: 'HIP37826', name: 'Pollux', ra: 7.755, dec: 28.026, magnitude: 1.14, spectralType: 'K' },
  { id: 'HIP113368', name: 'Fomalhaut', ra: 22.961, dec: -29.622, magnitude: 1.16, spectralType: 'A' },
  { id: 'HIP49669', name: 'Regulus', ra: 10.14, dec: 11.967, magnitude: 1.35, spectralType: 'B' },
  { id: 'HIP102098', name: 'Deneb', ra: 20.69, dec: 45.28, magnitude: 1.25, spectralType: 'A' },
];
