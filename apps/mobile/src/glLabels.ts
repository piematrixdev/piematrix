/**
 * GL-native text labels using Poppins Light font glyphs.
 *
 * Each glyph is variable-width x 36px, rendered from Poppins Light
 * with soft anti-aliased edges. Proportional spacing — each character
 * uses its actual measured width for tight, natural letter spacing.
 */

import * as THREE from 'three';
import { GLYPH_H, GLYPH_DATA, decodeGlyph } from './fontAtlasData';

const LETTER_GAP = 1; // 1px gap between characters

// Cache decoded glyphs
const glyphCache = new Map<string, { w: number; pixels: Uint8Array }>();

function getGlyph(ch: string): { w: number; pixels: Uint8Array } | null {
  if (glyphCache.has(ch)) return glyphCache.get(ch)!;

  const entry = GLYPH_DATA[ch] ?? GLYPH_DATA[ch.toUpperCase()] ?? GLYPH_DATA[' '];
  if (!entry) return null;

  const pixels = decodeGlyph(entry.d);
  const result = { w: entry.w, pixels };
  glyphCache.set(ch, result);
  return result;
}

function parseColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Create a Three.js Sprite with proportionally-spaced Poppins Light text.
 */
export function createTextSprite(
  text: string,
  color: string = '#ffffff',
  worldScale: number = 3.0,
): THREE.Sprite {
  const chars = text.split('');
  const [cr, cg, cb] = parseColor(color);

  // Measure total width
  const glyphs: Array<{ w: number; pixels: Uint8Array }> = [];
  let totalW = 0;
  for (const ch of chars) {
    const g = getGlyph(ch);
    if (!g) continue;
    glyphs.push(g);
    totalW += g.w + LETTER_GAP;
  }
  totalW -= LETTER_GAP; // no gap after last char
  if (totalW <= 0) totalW = 1;

  const PAD = 2;
  const texW = totalW + PAD * 2;
  const texH = GLYPH_H + PAD * 2;

  const data = new Uint8Array(texW * texH * 4);

  let xCursor = PAD;
  for (const g of glyphs) {
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < g.w; col++) {
        const alpha = g.pixels[row * g.w + col];
        if (alpha === 0) continue;

        const px = xCursor + col;
        const py = texH - 1 - (PAD + row); // flip Y

        if (px >= 0 && px < texW && py >= 0 && py < texH) {
          const idx = (py * texW + px) * 4;
          data[idx] = cr;
          data[idx + 1] = cg;
          data[idx + 2] = cb;
          data[idx + 3] = Math.min(255, Math.round(alpha * 1.4));
        }
      }
    }
    xCursor += g.w + LETTER_GAP;
  }

  const texture = new THREE.DataTexture(data, texW, texH, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(mat);
  const aspect = texW / texH;
  sprite.scale.set(worldScale * aspect, worldScale, 1);
  sprite.renderOrder = 5;
  return sprite;
}
