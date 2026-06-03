/**
 * build-gaia-binary.js
 *
 * Converts the Gaia DR3 Best catalog (Gaia Sky binary v3, 646,400 stars)
 * into compact, offline binary tiers for the mobile app — no database.
 *
 * Input : catalog-gaia-dr3-best/catalog/gaia-dr3-best/particles/particles_000000.bin
 * Output: apps/mobile/assets/stars/
 *           manifest.json            — tier list + counts + format spec
 *           stars-L0.bin             — mag ≤ 4.0   (brightest)
 *           stars-L1.bin             — mag ≤ 6.5   (naked eye)
 *           stars-L2.bin             — mag ≤ 10.0  (binocular)
 *           stars-L3.bin             — mag ≤ 14.0  (deep / premium)
 *           names.json               — id → display name for bright stars
 *
 * Per-star output record (little-endian, 16 bytes), matching what the
 * RN loader will read into typed arrays:
 *   float32 ra        (degrees, 0..360)
 *   float32 dec       (degrees, -90..90)
 *   float32 mag       (apparent G magnitude)
 *   uint8   specClass (0..6 -> O,B,A,F,G,K,M)
 *   uint8   r, g, b   (precomputed sRGB star color)
 *
 * Run: node apps/web/scripts/build-gaia-binary.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(
  __dirname,
  '../../../catalog-gaia-dr3-best/catalog/gaia-dr3-best/particles/particles_000000.bin'
);
const OUT_DIR = path.join(__dirname, '../../mobile/assets/stars');

const RAD2DEG = 180 / Math.PI;

// Magnitude tiers (upper bound inclusive). L3 is the full set.
const TIERS = [
  { key: 'L0', maxMag: 4.0 },
  { key: 'L1', maxMag: 6.5 },
  { key: 'L2', maxMag: 10.0 },
  { key: 'L3', maxMag: 14.0 },
];

const REC_BYTES = 16;

// ── Color: derive spectral class + RGB from Gaia BP-RP-ish color proxy ──
// The Gaia Sky file packs an RGBA color float; rather than unpack it, we
// estimate spectral class from absolute/apparent characteristics is not
// reliable, so we map using a B-V-like value when available. Here we use
// a robust fallback: temperature-free classing via the packed color's
// red/blue ratio. To keep it simple and stable we approximate by mag-
// independent default 'G' and refine using the stored color channel.
//
// We decode the packed float color (IEEE754 reinterpreted as RGBA8888,
// Gaia Sky convention) to get an sRGB triplet, then bucket to a class.
const SPEC_CLASSES = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

// Classify by (R - B) of the star's sRGB color. Hot stars are blue
// (R-B strongly negative), cool stars red (R-B strongly positive).
// Thresholds calibrated against anchor stars: Spica/Rigel (B) ≈ -55..-74,
// Vega/Sirius (A) ≈ -30, Procyon (F) ≈ -10, Capella (G) ≈ +20,
// Arcturus/Aldebaran (K) ≈ +60, Betelgeuse (M) ≈ +100.
function rbToSpecClass(R, B) {
  const d = R - B;
  if (d <= -70) return 0;   // O
  if (d <= -52) return 1;   // B
  if (d <= -34) return 2;   // A
  if (d <= -5) return 3;    // F
  if (d <= 35) return 4;    // G
  if (d <= 80) return 5;    // K
  return 6;                 // M
}

// Unpack Gaia Sky's packed color float. It is stored big-endian in the
// file; the 4 bytes are ABGR (libgdx Color.toFloatBits convention):
//   byte0 = A, byte1 = B, byte2 = G, byte3 = R
function unpackColorBytes(colOff, buf) {
  const A = buf.readUInt8(colOff);
  const B = buf.readUInt8(colOff + 1);
  const G = buf.readUInt8(colOff + 2);
  const R = buf.readUInt8(colOff + 3);
  return [R, G, B];
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('❌ Gaia particle file not found at:', SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const buf = fs.readFileSync(SRC);
  const marker = buf.readUInt32BE(0);
  const version = buf.readUInt32BE(4);
  const count = buf.readUInt32BE(8);
  console.log(`📖 Gaia Sky binary v${version}, ${count.toLocaleString()} stars (marker ${marker.toString(16)})`);

  // Collect parsed stars: {ra,dec,mag,spec,r,g,b}
  // We stream once, bucket by tier later.
  const stars = [];
  const names = {}; // id -> name (only bright stars, mag <= 6.5)

  let off = 12;
  let bad = 0;
  for (let i = 0; i < count; i++) {
    const x = buf.readDoubleBE(off); off += 8;
    const y = buf.readDoubleBE(off); off += 8;
    const z = buf.readDoubleBE(off); off += 8;
    off += 12; // vx,vy,vz
    off += 12; // muA,muD,rv
    const appmag = buf.readFloatBE(off); off += 4;
    off += 4;  // absmag
    const colOff = off;
    off += 4;  // col (packed ABGR float)
    off += 4;  // size
    off += 4;  // extra int
    const idHi = buf.readUInt32BE(off); const idLo = buf.readUInt32BE(off + 4); off += 8;
    const id = (BigInt(idHi) << 32n) | BigInt(idLo >>> 0);
    const nameLen = buf.readInt32BE(off); off += 4;
    if (nameLen < 0 || nameLen > 4000) { bad++; break; }
    let name = '';
    for (let c = 0; c < nameLen; c++) { name += String.fromCharCode(buf.readUInt16BE(off)); off += 2; }

    if (!isFinite(appmag)) { continue; }

    const r = Math.sqrt(x * x + y * y + z * z);
    if (r === 0) continue;
    let ra = Math.atan2(x, z) * RAD2DEG; if (ra < 0) ra += 360;
    const dec = Math.asin(y / r) * RAD2DEG;

    const [cr, cg, cb] = unpackColorBytes(colOff, buf);
    const spec = rbToSpecClass(cr, cb);

    stars.push({ ra, dec, mag: appmag, spec, r: cr, g: cg, b: cb });

    // Keep readable names for bright stars only (strip to the nicest token).
    if (appmag <= 6.5 && name) {
      const display = pickDisplayName(name);
      if (display) names[ra.toFixed(4) + ',' + dec.toFixed(4)] = display;
    }

    if (i % 100000 === 0) process.stdout.write(`\r  parsed ${i.toLocaleString()}/${count.toLocaleString()}`);
  }
  process.stdout.write(`\r  parsed ${stars.length.toLocaleString()} stars                         \n`);
  if (bad) console.warn(`  ⚠️  stopped early on malformed record`);

  // Sort by magnitude ascending so each tier file is brightest-first
  stars.sort((a, b) => a.mag - b.mag);

  const manifest = { format: 'skywatch-stars-v1', recordBytes: REC_BYTES, fields: ['ra:f32', 'dec:f32', 'mag:f32', 'spec:u8', 'r:u8', 'g:u8', 'b:u8'], tiers: [] };

  for (const tier of TIERS) {
    const subset = stars.filter((s) => s.mag <= tier.maxMag);
    const out = Buffer.alloc(subset.length * REC_BYTES);
    let o = 0;
    for (const s of subset) {
      out.writeFloatLE(s.ra, o); o += 4;
      out.writeFloatLE(s.dec, o); o += 4;
      out.writeFloatLE(s.mag, o); o += 4;
      out.writeUInt8(s.spec, o); o += 1;
      out.writeUInt8(s.r, o); o += 1;
      out.writeUInt8(s.g, o); o += 1;
      out.writeUInt8(s.b, o); o += 1;
    }
    const fname = `stars-${tier.key}.bin`;
    fs.writeFileSync(path.join(OUT_DIR, fname), out);
    manifest.tiers.push({ key: tier.key, maxMag: tier.maxMag, count: subset.length, file: fname, bytes: out.length });
    console.log(`  ✅ ${fname}: ${subset.length.toLocaleString()} stars, ${(out.length / 1024 / 1024).toFixed(2)} MB`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'names.json'), JSON.stringify(names));
  console.log(`\n🎉 Done. Output in ${OUT_DIR}`);
  console.log(`   manifest.json + ${manifest.tiers.length} tiers + names.json (${Object.keys(names).length} named)`);
}

// Gaia names look like "mu. Sgr|13 Sgr|HIP 89341". Prefer a proper name
// token (no catalog prefix) if present, else the Bayer/Flamsteed token.
function pickDisplayName(raw) {
  const tokens = raw.split('|').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  // A "proper" name has no catalog prefix and no leading number.
  const proper = tokens.find((t) => !/^(HIP|HD|HR|TYC|Gaia|HYG)\b/i.test(t) && !/^\d/.test(t) && !/[A-Z][a-z]{2}$/.test(t));
  return proper || tokens[0];
}

main();
