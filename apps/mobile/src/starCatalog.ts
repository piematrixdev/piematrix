/**
 * starCatalog — offline, file-based star catalog reader.
 *
 * Reads the bundled binary tiers produced by
 * apps/web/scripts/build-gaia-binary.js (Gaia DR3 Best, 646k stars).
 * No network, no database — the tiers ship inside the app bundle.
 *
 * Tier files (apps/mobile/assets/stars/):
 *   stars-L0.bin  mag ≤ 4.0   (913 stars)
 *   stars-L1.bin  mag ≤ 6.5   (16,761)
 *   stars-L2.bin  mag ≤ 10.0  (192,179)
 *   stars-L3.bin  mag ≤ 14.0  (646,398)   ← optional / premium
 *
 * Record (little-endian, 16 bytes):
 *   float32 ra (deg) · float32 dec (deg) · float32 mag
 *   uint8 specClass(0..6 → O,B,A,F,G,K,M) · uint8 r · uint8 g · uint8 b
 */

import { Asset } from 'expo-asset';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import type { Star } from '@virtual-window/astronomy-engine';

const REC_BYTES = 16;
const SPEC = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const;

// Static require() so Metro bundles each tier as an asset.
// Using .db extension (in Metro's default assetExts) for compatibility.
const TIER_MODULES: Record<string, number> = {
  L0: require('../assets/stars/stars-L0.db'),
  L1: require('../assets/stars/stars-L1.db'),
  L2: require('../assets/stars/stars-L2.db'),
  L3: require('../assets/stars/stars-L3.db'),
};

interface TierDef {
  key: string;
  maxMag: number;
}

// Ordered brightest → faintest. Must match the converter's tiers.
const TIERS: TierDef[] = [
  { key: 'L0', maxMag: 4.0 },
  { key: 'L1', maxMag: 6.5 },
  { key: 'L2', maxMag: 10.0 },
  { key: 'L3', maxMag: 14.0 },
];

// Cache of decoded stars per tier so we never re-read a file.
const tierCache = new Map<string, Star[]>();

/** Decode one tier's binary buffer into Star[] (RA stored in HOURS for the renderer). */
function decodeTier(bytes: Uint8Array, tierKey: string): Star[] {
  // Ensure correct byte alignment for the DataView.
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.byteLength / REC_BYTES);
  const stars: Star[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * REC_BYTES;
    const raDeg = dv.getFloat32(o, true);
    const dec = dv.getFloat32(o + 4, true);
    const mag = dv.getFloat32(o + 8, true);
    const spec = dv.getUint8(o + 12);
    stars[i] = {
      id: `G${tierKey}-${i}`,
      name: null,
      ra: raDeg / 15, // degrees → hours (renderer expects hours)
      dec,
      magnitude: mag,
      spectralType: (SPEC[spec] ?? 'G') as any,
    };
  }
  return stars;
}

/** Load + decode a single tier (cached). */
async function loadTier(tierKey: string): Promise<Star[]> {
  const cached = tierCache.get(tierKey);
  if (cached) return cached;

  const mod = TIER_MODULES[tierKey];
  const asset = Asset.fromModule(mod);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;

  const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const bytes = Buffer.from(b64, 'base64');
  const stars = decodeTier(bytes, tierKey);
  tierCache.set(tierKey, stars);
  return stars;
}

/**
 * Load all stars up to (and including) the tier whose maxMag covers
 * `targetMag`, then trim to exactly targetMag. Tiers are cumulative —
 * each higher tier already contains the brighter stars — so we just
 * load the smallest tier that reaches targetMag.
 */
export async function loadStarsUpToMagnitude(targetMag: number): Promise<Star[]> {
  // Pick the smallest tier whose maxMag >= targetMag (else the deepest).
  let chosen = TIERS[TIERS.length - 1];
  for (const t of TIERS) {
    if (t.maxMag >= targetMag) {
      chosen = t;
      break;
    }
  }
  const stars = await loadTier(chosen.key);
  // Each tier is a superset capped at its maxMag; trim to the request.
  if (targetMag >= chosen.maxMag) return stars;
  return stars.filter((s) => s.magnitude <= targetMag);
}

export function getTierForMagnitude(targetMag: number): string {
  for (const t of TIERS) if (t.maxMag >= targetMag) return t.key;
  return TIERS[TIERS.length - 1].key;
}
