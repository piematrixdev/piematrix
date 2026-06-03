/**
 * Verify the converted star tiers: read back stars-L0.bin and check the
 * brightest stars decode to sane RA/Dec/mag. L0 is brightest-first.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../mobile/assets/stars');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
console.log('manifest:', JSON.stringify(manifest.tiers.map(t => ({ k: t.key, n: t.count, mb: (t.bytes / 1048576).toFixed(2) }))));

const SPEC = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
const buf = fs.readFileSync(path.join(DIR, 'stars-L0.bin'));
const REC = 16;
const n = buf.length / REC;
console.log(`\nL0 has ${n} stars. Brightest 12:`);
for (let i = 0; i < 12; i++) {
  const o = i * REC;
  const ra = buf.readFloatLE(o);
  const dec = buf.readFloatLE(o + 4);
  const mag = buf.readFloatLE(o + 8);
  const spec = SPEC[buf.readUInt8(o + 12)];
  const r = buf.readUInt8(o + 13), g = buf.readUInt8(o + 14), b = buf.readUInt8(o + 15);
  console.log(`  mag ${mag.toFixed(2)}  RA ${(ra / 15).toFixed(2)}h  Dec ${dec.toFixed(2)}  ${spec}  rgb(${r},${g},${b})`);
}
