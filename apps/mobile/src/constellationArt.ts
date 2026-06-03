/**
 * Constellation Art — Stellarium-style illustration overlays.
 *
 * Uses anchor points (3 HIP stars per image) to map illustrations
 * onto the sky sphere in equatorial coordinates. The images are
 * from Stellarium's western sky culture (public domain).
 *
 * Each illustration is positioned by finding the 3D positions of its
 * anchor stars and computing an affine transform from image pixels
 * to sky coordinates.
 */

import rawConstellationData from '../assets/constellations/western-index.json';
import starsJson from './data/constellations.json';

// Build HIP → RA/Dec lookup from constellation star data
const hipToRaDec = new Map<number, { ra: number; dec: number }>();
for (const c of starsJson as any[]) {
  for (const line of c.lines) {
    if (line.star1.hipId && line.star1.ra) {
      hipToRaDec.set(line.star1.hipId, { ra: line.star1.ra, dec: line.star1.dec });
    }
    if (line.star2.hipId && line.star2.ra) {
      hipToRaDec.set(line.star2.hipId, { ra: line.star2.ra, dec: line.star2.dec });
    }
  }
}

export interface ConstellationArtEntry {
  /** IAU abbreviation (e.g., 'Aql', 'And') */
  iau: string;
  /** Common name */
  name: string;
  /** Image filename (without path) */
  imageFile: string;
  /** Image size [width, height] */
  imageSize: [number, number];
  /** 3 anchor points: pixel position in image → HIP star ID */
  anchors: Array<{ px: number; py: number; hip: number }>;
  /** Computed: 3D equatorial positions of anchors */
  anchorPositions: Array<{ ra: number; dec: number }> | null;
}

// Parse the Stellarium index into our format
const artEntries: ConstellationArtEntry[] = [];

for (const c of (rawConstellationData as any).constellations) {
  if (!c.image || !c.image.anchors || c.image.anchors.length < 3) continue;

  const anchors = c.image.anchors.slice(0, 3).map((a: any) => ({
    px: a.pos[0],
    py: a.pos[1],
    hip: a.hip,
  }));

  // Look up RA/Dec for each anchor star
  const anchorPositions: Array<{ ra: number; dec: number }> = [];
  let allFound = true;
  for (const anchor of anchors) {
    const pos = hipToRaDec.get(anchor.hip);
    if (pos) {
      anchorPositions.push(pos);
    } else {
      allFound = false;
      break;
    }
  }

  const filename = c.image.file.replace('illustrations/', '');

  artEntries.push({
    iau: c.iau,
    name: c.common_name?.native ?? c.iau,
    imageFile: filename,
    imageSize: c.image.size,
    anchors,
    anchorPositions: allFound ? anchorPositions : null,
  });
}

export const CONSTELLATION_ART: ConstellationArtEntry[] = artEntries;

/**
 * Get all constellation art entries that have valid anchor positions.
 */
export function getValidConstellationArt(): ConstellationArtEntry[] {
  return artEntries.filter(e => e.anchorPositions !== null);
}

/**
 * Compute the center RA/Dec and angular size of a constellation art entry.
 * Used for positioning the textured quad in 3D space.
 */
export function getArtBounds(entry: ConstellationArtEntry): {
  centerRA: number; centerDec: number;
  widthDeg: number; heightDeg: number;
  rotation: number;
} | null {
  if (!entry.anchorPositions || entry.anchorPositions.length < 3) return null;

  const positions = entry.anchorPositions;
  // Compute bounding box in RA/Dec
  const ras = positions.map(p => p.ra);
  const decs = positions.map(p => p.dec);

  let minRA = Math.min(...ras);
  let maxRA = Math.max(...ras);
  const minDec = Math.min(...decs);
  const maxDec = Math.max(...decs);

  // Handle RA wrap-around (e.g., 350° to 10°)
  if (maxRA - minRA > 180) {
    // Wrap: shift values above 180 down
    const shifted = ras.map(r => r > 180 ? r - 360 : r);
    minRA = Math.min(...shifted);
    maxRA = Math.max(...shifted);
  }

  const centerRA = ((minRA + maxRA) / 2 + 360) % 360;
  const centerDec = (minDec + maxDec) / 2;

  // Expand bounds to cover the full image (anchors are inside the image, not at edges)
  // Use the image pixel positions to estimate how much to expand
  const imgW = entry.imageSize[0];
  const imgH = entry.imageSize[1];
  const pxs = entry.anchors.map(a => a.px);
  const pys = entry.anchors.map(a => a.py);
  const minPx = Math.min(...pxs);
  const maxPx = Math.max(...pxs);
  const minPy = Math.min(...pys);
  const maxPy = Math.max(...pys);

  // Scale factor: how much of the image do the anchors span?
  const pxSpan = Math.max(maxPx - minPx, 1);
  const pySpan = Math.max(maxPy - minPy, 1);
  const scaleX = imgW / pxSpan;
  const scaleY = imgH / pySpan;

  const raSpan = maxRA - minRA;
  const decSpan = maxDec - minDec;

  const widthDeg = raSpan * scaleX * 1.1; // 10% padding
  const heightDeg = decSpan * scaleY * 1.1;

  // Compute rotation from anchor positions
  const dx = positions[1].ra - positions[0].ra;
  const dy = positions[1].dec - positions[0].dec;
  const rotation = -Math.atan2(dy, dx) * 180 / Math.PI;

  return { centerRA, centerDec, widthDeg, heightDeg, rotation };
}

// Re-export for backward compatibility
export interface ProjectedArt {
  def: { id: string; name: string; centerRA: number; centerDec: number; widthDeg: number; heightDeg: number; rotation: number; opacity: number; asset: any };
  center: { azimuth: number; altitude: number };
  corners: [{ azimuth: number; altitude: number }, { azimuth: number; altitude: number }, { azimuth: number; altitude: number }, { azimuth: number; altitude: number }];
  visible: boolean;
}

export function getConstellationArt(): ProjectedArt[] {
  return []; // Deprecated — art is now rendered directly in SkyRenderer via skyGroup
}
