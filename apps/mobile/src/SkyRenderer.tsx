/**
 * SkyRenderer — Three.js sky dome via expo-gl.
 * Stars with glow/twinkle, constellations, shader-based sun/moon/planets/DSOs,
 * ground, horizon — all GPU-rendered at 60fps.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { View, Dimensions, PixelRatio } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, loadTextureAsync } from 'expo-three';
import * as THREE from 'three';
import type { Star, Planet, HorizontalCoordinates, MoonPosition, SunPosition, DeepSkyPosition } from '@virtual-window/astronomy-engine';
import { getSaturnRingTiltRad } from '@virtual-window/astronomy-engine';
import { createTextSprite } from './glLabels';
import { effectiveLimitingMagnitude } from './stars';
import { computeGalileanMoons, computeTitan } from './planetaryMoons';
import { getGroundAsset, DEFAULT_GROUND_ID } from './grounds';
import rawConstellationData from './data/constellations.json';
import constellationBoundaries from './data/constellation-boundaries.json';

// Full name → IAU 3-letter abbreviation for boundary lookup
const CONST_NAME_TO_IAU: Record<string, string> = {
  Andromeda:'And',Antlia:'Ant',Apus:'Aps',Aquarius:'Aqr',Aquila:'Aql',Ara:'Ara',Aries:'Ari',
  Auriga:'Aur',Boötes:'Boo',Bootes:'Boo',Caelum:'Cae',Camelopardalis:'Cam',Cancer:'Cnc',
  'Canes Venatici':'CVn',CanesMajor:'CMa','Canis Major':'CMa','Canis Minor':'CMi',
  Capricornus:'Cap',Carina:'Car',Cassiopeia:'Cas',Centaurus:'Cen',Cepheus:'Cep',Cetus:'Cet',
  Chamaeleon:'Cha',Circinus:'Cir',Columba:'Col','Coma Berenices':'Com','Corona Australis':'CrA',
  'Corona Borealis':'CrB',Corvus:'Crv',Crater:'Crt',Crux:'Cru',Cygnus:'Cyg',Delphinus:'Del',
  Dorado:'Dor',Draco:'Dra',Equuleus:'Equ',Eridanus:'Eri',Fornax:'For',Gemini:'Gem',Grus:'Gru',
  Hercules:'Her',Horologium:'Hor',Hydra:'Hya',Hydrus:'Hyi',Indus:'Ind',Lacerta:'Lac',Leo:'Leo',
  'Leo Minor':'LMi',Lepus:'Lep',Libra:'Lib',Lupus:'Lup',Lynx:'Lyn',Lyra:'Lyr',Mensa:'Men',
  Microscopium:'Mic',Monoceros:'Mon',Musca:'Mus',Norma:'Nor',Octans:'Oct',Ophiuchus:'Oph',
  Orion:'Ori',Pavo:'Pav',Pegasus:'Peg',Perseus:'Per',Phoenix:'Phe',Pictor:'Pic',Pisces:'Psc',
  'Piscis Austrinus':'PsA',Puppis:'Pup',Pyxis:'Pyx',Reticulum:'Ret',Sagitta:'Sge',
  Sagittarius:'Sgr',Scorpius:'Sco',Sculptor:'Scl',Scutum:'Sct',Serpens:'Ser',Sextans:'Sex',
  Taurus:'Tau',Telescopium:'Tel',Triangulum:'Tri','Triangulum Australe':'TrA',Tucana:'Tuc',
  'Ursa Major':'UMa','Ursa Minor':'UMi',Vela:'Vel',Virgo:'Vir',Volans:'Vol',Vulpecula:'Vul',
};

// Constellation art PNG assets — all 85 constellations
const CONST_ART_PNG: Record<string, any> = {
  andromeda: require('../assets/constellations-png/andromeda.png'),
  antlia: require('../assets/constellations-png/antlia.png'),
  apus: require('../assets/constellations-png/apus.png'),
  aquarius: require('../assets/constellations-png/aquarius.png'),
  aquila: require('../assets/constellations-png/aquila.png'),
  ara: require('../assets/constellations-png/ara.png'),
  aries: require('../assets/constellations-png/aries.png'),
  auriga: require('../assets/constellations-png/auriga.png'),
  bootes: require('../assets/constellations-png/bootes.png'),
  caelum: require('../assets/constellations-png/caelum.png'),
  camelopardalis: require('../assets/constellations-png/camelopardalis.png'),
  cancer: require('../assets/constellations-png/cancer.png'),
  'canes-venatici': require('../assets/constellations-png/canes-venatici.png'),
  'canis-major': require('../assets/constellations-png/canis-major.png'),
  'canis-minor': require('../assets/constellations-png/canis-minor.png'),
  capricornus: require('../assets/constellations-png/capricornus.png'),
  cassiopeia: require('../assets/constellations-png/cassiopeia.png'),
  centaurus: require('../assets/constellations-png/centaurus.png'),
  cepheus: require('../assets/constellations-png/cepheus.png'),
  cetus: require('../assets/constellations-png/cetus.png'),
  chamaeleon: require('../assets/constellations-png/chamaeleon.png'),
  circinus: require('../assets/constellations-png/circinus.png'),
  columba: require('../assets/constellations-png/columba.png'),
  'coma-berenices': require('../assets/constellations-png/coma-berenices.png'),
  'corona-australis': require('../assets/constellations-png/corona-australis.png'),
  'corona-borealis': require('../assets/constellations-png/corona-borealis.png'),
  corvus: require('../assets/constellations-png/corvus.png'),
  crater: require('../assets/constellations-png/crater.png'),
  crux: require('../assets/constellations-png/crux.png'),
  cygnus: require('../assets/constellations-png/cygnus.png'),
  delphinus: require('../assets/constellations-png/delphinus.png'),
  dorado: require('../assets/constellations-png/dorado.png'),
  draco: require('../assets/constellations-png/draco.png'),
  equuleus: require('../assets/constellations-png/equuleus.png'),
  eridanus: require('../assets/constellations-png/eridanus.png'),
  fornax: require('../assets/constellations-png/fornax.png'),
  gemini: require('../assets/constellations-png/gemini.png'),
  grus: require('../assets/constellations-png/grus.png'),
  hercules: require('../assets/constellations-png/hercules.png'),
  hydra: require('../assets/constellations-png/hydra.png'),
  lacerta: require('../assets/constellations-png/lacerta.png'),
  'leo-minor': require('../assets/constellations-png/leo-minor.png'),
  leo: require('../assets/constellations-png/leo.png'),
  lepus: require('../assets/constellations-png/lepus.png'),
  libra: require('../assets/constellations-png/libra.png'),
  lupus: require('../assets/constellations-png/lupus.png'),
  lynx: require('../assets/constellations-png/lynx.png'),
  lyra: require('../assets/constellations-png/lyra.png'),
  monoceros: require('../assets/constellations-png/monoceros.png'),
  musca: require('../assets/constellations-png/musca.png'),
  norma: require('../assets/constellations-png/norma.png'),
  octans: require('../assets/constellations-png/octans.png'),
  ophiuchus: require('../assets/constellations-png/ophiuchus.png'),
  orion: require('../assets/constellations-png/orion.png'),
  pavo: require('../assets/constellations-png/pavo.png'),
  pegasus: require('../assets/constellations-png/pegasus.png'),
  perseus: require('../assets/constellations-png/perseus.png'),
  phoenix: require('../assets/constellations-png/phoenix.png'),
  pisces: require('../assets/constellations-png/pisces.png'),
  'piscis-austrinus': require('../assets/constellations-png/piscis-austrinus.png'),
  sagitta: require('../assets/constellations-png/sagitta.png'),
  sagittarius: require('../assets/constellations-png/sagittarius.png'),
  scorpius: require('../assets/constellations-png/scorpius.png'),
  sculptor: require('../assets/constellations-png/sculptor.png'),
  scutum: require('../assets/constellations-png/scutum.png'),
  taurus: require('../assets/constellations-png/taurus.png'),
  triangulum: require('../assets/constellations-png/triangulum.png'),
  'triangulum-australe': require('../assets/constellations-png/triangulum-australe.png'),
  tucana: require('../assets/constellations-png/tucana.png'),
  'ursa-major': require('../assets/constellations-png/ursa-major.png'),
  'ursa-minor': require('../assets/constellations-png/ursa-minor.png'),
  virgo: require('../assets/constellations-png/virgo.png'),
  volans: require('../assets/constellations-png/volans.png'),
  vulpecula: require('../assets/constellations-png/vulpecula.png'),
  sextans: require('../assets/constellations-png/sextans.png'),
  hydrus: require('../assets/constellations-png/hydrus.png'),
  indus: require('../assets/constellations-png/indus.png'),
  mensa: require('../assets/constellations-png/mensa.png'),
  microscopium: require('../assets/constellations-png/microscopium.png'),
  pictor: require('../assets/constellations-png/pictor.png'),
  pyxis: require('../assets/constellations-png/pyxis.png'),
  reticulum: require('../assets/constellations-png/reticulum.png'),
  telescopium: require('../assets/constellations-png/telescopium.png'),
  horologium: require('../assets/constellations-png/horologium.png'),
  horlogium: require('../assets/constellations-png/horologium.png'),
  vela: require('../assets/constellations-png/vela.png'),
  carina: require('../assets/constellations-png/carina.png'),
  puppis: require('../assets/constellations-png/puppis.png'),
  argonavis: require('../assets/constellations-png/carina.png'),
};

// Constellation center positions are computed from anchor stars at runtime
// (see western-index.json for image anchors).

const { width: W, height: H } = Dimensions.get('window');
const R = 500; // Large sky sphere for realistic depth perception
const CR = R - 10; // Celestial object radius

const PLANET_COLORS: Record<string, [number, number, number]> = {
  mercury: [0.69, 0.63, 0.56], venus: [1.0, 0.91, 0.69], mars: [1.0, 0.4, 0.2],
  jupiter: [0.83, 0.65, 0.42], saturn: [0.92, 0.84, 0.65], uranus: [0.53, 0.8, 0.87], neptune: [0.33, 0.4, 0.87],
};

const DSO_COLORS: Record<string, [number, number, number]> = {
  Galaxy: [0.7, 0.5, 1.0], Nebula: [1.0, 0.35, 0.55], 'Open Cluster': [0.5, 0.85, 1.0],
  'Globular Cluster': [1.0, 0.85, 0.4], 'Planetary Nebula': [0.3, 1.0, 0.75],
};

// --- Planet glow: makes a distant planet read as a glowing star point ---
const PLANET_GLOW_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0; // 0 at center .. 1 at plane edge
    // Tight bright core + soft wide halo (additive) — a star-like glow.
    float core = exp(-d * d * 28.0);
    float halo = exp(-d * d * 4.0) * 0.45;
    float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.7 + core * 0.8), a);
  }
`;

// --- Reusable billboard shader material factory ---
function makeBillboardSprite(
  size: number,
  fragmentShader: string,
  uniforms: Record<string, { value: any }> = {},
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// --- Sun fragment shader: white-hot core, limb darkening, corona rays, outer glow ---
const SUN_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Solar disc with limb darkening
    float discR = 0.08;
    float disc = smoothstep(discR, discR * 0.6, d);
    float limb = 1.0 - 0.6 * pow(d / discR, 2.0);
    limb = clamp(limb, 0.0, 1.0);
    vec3 discColor = mix(vec3(1.0, 0.95, 0.7), vec3(1.0), limb) * disc;

    // Inner corona — bright warm glow
    float corona1 = exp(-d * d * 80.0) * 0.9;
    // Mid corona
    float corona2 = exp(-d * d * 20.0) * 0.4;
    // Outer halo
    float corona3 = exp(-d * d * 5.0) * 0.15;

    // Subtle radial rays
    float angle = atan(c.y, c.x);
    float rays = 0.5 + 0.5 * sin(angle * 12.0 + uTime * 0.3);
    rays = rays * 0.5 + 0.5;
    float rayMask = exp(-d * d * 12.0) * 0.12 * rays;

    vec3 coronaColor = vec3(1.0, 0.92, 0.6) * corona1
                     + vec3(1.0, 0.8, 0.4) * corona2
                     + vec3(1.0, 0.65, 0.3) * corona3
                     + vec3(1.0, 0.85, 0.5) * rayMask;

    vec3 col = discColor + coronaColor;
    float alpha = disc + corona1 + corona2 + corona3 + rayMask;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

// --- Moon fragment shader: phase-accurate with realistic surface ---
const MOON_FRAG = `
  uniform float uPhaseAngle;  // 0=New, 180=Full (degrees)
  uniform float uIllumination; // 0-1
  varying vec2 vUv;

  // Simple hash for procedural texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Moon disc radius
    float discR = 0.15;
    if (d > discR + 0.02) {
      // Outer glow only
      float glow = exp(-(d - discR) * (d - discR) * 200.0) * 0.1 * uIllumination;
      if (glow < 0.005) discard;
      gl_FragColor = vec4(vec3(0.9, 0.87, 0.8) * glow, glow);
      return;
    }

    float disc = smoothstep(discR, discR - 0.003, d);
    if (disc < 0.01) discard;

    // UV on the moon disc (-1 to 1)
    vec2 uv = c / discR;
    float r = length(uv);
    if (r > 1.0) discard;

    // 3D sphere: compute z from x,y
    float z = sqrt(1.0 - r * r);

    // --- Phase lighting ---
    // uPhaseAngle = position angle from moon to sun (degrees)
    // uIllumination = fraction of moon lit (0-1)
    // Light comes from the right for waxing (phase 0-180)
    // cos(phase) determines how much of the front is lit
    // At phase 90° (first quarter): half lit
    // Light direction based on sun's position angle relative to moon
    // uPhaseAngle here is actually the position angle (bearing from moon to sun)
    // 0° = sun above, 90° = sun to the right, -90° = sun to the left
    float angle = uPhaseAngle * 3.14159 / 180.0;
    // Light comes FROM the sun direction
    float lightX = sin(angle);   // horizontal component
    float lightY = cos(angle);   // vertical component
    // Compute lighting on the sphere
    float lighting = uv.x * lightX + uv.y * lightY;
    // The illumination fraction determines how much of the disc is lit
    // At 50% illumination, the terminator is at the center
    // Shift the terminator based on illumination
    float termShift = (uIllumination - 0.5) * 2.0; // -1 to 1
    lighting += termShift * z;

    // Sharp-ish terminator with slight softness
    float shadow = smoothstep(-0.01, 0.03, lighting);

    // --- Surface texture ---
    // Multiple octaves of noise for realistic lunar surface
    vec2 texUV = uv * 4.0 + vec2(2.5, 1.8); // offset to avoid symmetry
    float n1 = noise(texUV * 2.0);
    float n2 = noise(texUV * 5.0);
    float n3 = noise(texUV * 12.0);

    // Large dark maria
    float maria = smoothstep(0.35, 0.65, n1) * 0.25;

    // Medium craters
    float craters = n2 * 0.15;

    // Fine detail
    float detail = n3 * 0.08;

    float surface = 0.75 - maria + craters - detail;
    surface = clamp(surface, 0.4, 0.95);

    // Limb darkening
    float limb = 0.6 + 0.4 * z;

    // Final lit color
    vec3 moonColor = vec3(0.85, 0.82, 0.76) * surface * limb * shadow;

    // Dark side: earthshine (very dim blue-grey)
    vec3 darkSide = vec3(0.03, 0.035, 0.05) * (1.0 - shadow) * z;
    moonColor += darkSide;

    // Apply disc mask
    moonColor *= disc;
    float alpha = disc;

    gl_FragColor = vec4(moonColor, alpha);
  }
`;

// --- Planet fragment shader: solid disc with limb darkening + color glow ---
const PLANET_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Planet disc
    float discR = 0.15;
    float disc = smoothstep(discR, discR - 0.02, d);

    // Limb darkening
    float limb = 1.0 - 0.4 * pow(d / discR, 1.5);
    limb = clamp(limb, 0.0, 1.0);

    // Slight 3D shading — light from upper-left
    float shade = 0.8 + 0.2 * dot(normalize(c + vec2(0.03)), vec2(-0.7, 0.7));
    shade = clamp(shade, 0.5, 1.1);

    vec3 discColor = uColor * limb * shade * disc;

    // Glow
    float glow = exp(-d * d * 40.0) * 0.3;
    float outerGlow = exp(-d * d * 10.0) * 0.08;
    vec3 glowColor = uColor * (glow + outerGlow);

    vec3 col = discColor + glowColor;
    float alpha = disc * 0.95 + glow + outerGlow;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

// --- DSO fragment shaders — distinct per type ---

// Galaxy: elongated elliptical shape with spiral hint and bright core
const DSO_GALAXY_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    // Elongate slightly to suggest elliptical shape
    c.x *= 1.6;
    float d = length(c);

    // Bright compact core
    float core = exp(-d * d * 120.0) * 0.9;
    // Disc/bulge
    float bulge = exp(-d * d * 25.0) * 0.4;
    // Faint outer halo
    float halo = exp(-d * d * 6.0) * 0.12;

    // Subtle spiral arm hint via angular modulation
    float angle = atan(c.y, c.x);
    float spiral = 0.5 + 0.5 * sin(angle * 2.0 + d * 12.0);
    float armMod = spiral * exp(-d * d * 12.0) * 0.15;

    float intensity = core + bulge + halo + armMod;
    vec3 col = uColor * intensity;
    // Warm core tint
    col += vec3(0.15, 0.08, 0.0) * core;

    float alpha = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Nebula: diffuse irregular cloud with color variation
const DSO_NEBULA_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Irregular cloud shape using noise
    vec2 nUv = c * 5.0 + vec2(3.7, 2.1);
    float n1 = noise(nUv);
    float n2 = noise(nUv * 2.3 + vec2(1.4, 0.8));
    float cloudShape = n1 * 0.6 + n2 * 0.4;

    // Base radial falloff
    float falloff = exp(-d * d * 10.0);
    // Modulate by cloud noise for irregular edges
    float nebula = falloff * (0.5 + cloudShape * 0.7);

    // Bright inner region
    float inner = exp(-d * d * 40.0) * 0.6;

    float intensity = inner + nebula * 0.5;
    vec3 col = uColor * intensity;
    // Color variation in the cloud
    col += vec3(0.1, -0.05, 0.15) * nebula * cloudShape;

    float alpha = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Open Cluster: subtle dashed circle marker — real stars form the visual cluster
const DSO_OPEN_CLUSTER_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Thin circle outline to mark the cluster region
    float ringR = 0.35;
    float ringW = 0.015;
    float ring = smoothstep(ringW, 0.0, abs(d - ringR)) * 0.35;

    // Dashed effect via angle
    float angle = atan(c.y, c.x);
    float dash = step(0.3, fract(angle * 2.0 / 3.14159));
    ring *= dash;

    // Tiny center dot as position marker
    float dot = exp(-d * d * 400.0) * 0.4;

    float intensity = ring + dot;
    vec3 col = uColor * intensity;

    float alpha = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Globular Cluster: subtle concentrated dot marker — dense core is visible from star data
const DSO_GLOBULAR_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Soft circle outline
    float ringR = 0.3;
    float ringW = 0.02;
    float ring = smoothstep(ringW, 0.0, abs(d - ringR)) * 0.3;

    // Small crosshair at center
    float crossH = smoothstep(0.015, 0.0, abs(c.y)) * smoothstep(0.12, 0.0, abs(c.x)) * 0.3;
    float crossV = smoothstep(0.015, 0.0, abs(c.x)) * smoothstep(0.12, 0.0, abs(c.y)) * 0.3;
    float cross = (crossH + crossV) * step(d, 0.12);

    float intensity = ring + cross;
    vec3 col = uColor * intensity;

    float alpha = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Planetary Nebula: ring/shell structure with hot central star
const DSO_PLANETARY_FRAG = `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);

    // Hot central star — tiny bright point
    float star = exp(-d * d * 600.0) * 1.0;

    // Ring/shell structure
    float ringR = 0.18;
    float ringW = 0.06;
    float ring = exp(-pow(d - ringR, 2.0) / (2.0 * ringW * ringW)) * 0.7;

    // Inner cavity glow
    float cavity = exp(-d * d * 50.0) * 0.2;

    // Faint outer halo
    float halo = exp(-d * d * 5.0) * 0.06;

    float intensity = star + ring + cavity + halo;
    vec3 col = uColor * ring + vec3(0.8, 0.9, 1.0) * star + uColor * 0.5 * cavity + uColor * halo;

    float alpha = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Map type to shader
const DSO_SHADERS: Record<string, string> = {
  Galaxy: DSO_GALAXY_FRAG,
  Nebula: DSO_NEBULA_FRAG,
  'Open Cluster': DSO_OPEN_CLUSTER_FRAG,
  'Globular Cluster': DSO_GLOBULAR_FRAG,
  'Planetary Nebula': DSO_PLANETARY_FRAG,
};

// Size multipliers per type (some objects should appear larger)
const DSO_SIZE_MULT: Record<string, number> = {
  Galaxy: 1.4,
  Nebula: 1.6,
  'Open Cluster': 1.0,
  'Globular Cluster': 0.9,
  'Planetary Nebula': 0.9,
};

interface Props {
  azimuth: number;
  altitude: number;
  fov: number;
  /** Direct FOV ref — GL loop reads at 60fps for smooth zoom */
  fovRef?: React.MutableRefObject<number>;
  /** Direct sensor ref — GL loop reads this at 60fps, bypassing React */
  pointingRef?: React.MutableRefObject<{ azimuth: number; altitude: number; quaternion: [number, number, number, number]; ready: boolean }>;
  /** Direct manual position ref — GL loop reads at 60fps for smooth panning */
  manualPosRef?: React.MutableRefObject<{ azimuth: number; altitude: number }>;
  arMode?: boolean;
  /** Ref callback: SkyRenderer writes a project function here for tap detection */
  projectRef?: React.MutableRefObject<((az: number, alt: number, r?: number) => { x: number; y: number } | null) | null>;
  stars: Star[];
  starPositions: Map<string, HorizontalCoordinates>;
  planets: Planet[];
  planetPositions: Map<string, HorizontalCoordinates>;
  moonPosition: MoonPosition | null;
  sunPosition: SunPosition | null;
  deepSkyPositions: Map<string, DeepSkyPosition>;
  satellitePositions: Map<string, any>; // SatellitePosition objects from the tracker
  /** Predicted satellite positions 1s into the future — used for smooth interpolation. */
  satellitePositionsNextRef?: React.MutableRefObject<Map<string, any>>;
  /** Timestamps of the prev/next satellite snapshots (ms epoch). */
  satelliteTimeRef?: React.MutableRefObject<{ prev: number; next: number }>;
  sunAltitude: number;
  constellationSegments: Array<{ start: HorizontalCoordinates; end: HorizontalCoordinates }>;
  constellationLabels: Array<{ id: string; name: string; pos: HorizontalCoordinates }>;
  dataVersion: number;
  showAtmosphere: boolean;
  showGround: boolean;
  showLayers: {
    planets: boolean; moon: boolean; sun: boolean; constellations: boolean;
    deepSky: boolean; satellites: boolean; meteors: boolean; labels: boolean;
    horizon: boolean; altGrid: boolean; azGrid: boolean; eqGrid: boolean; milkyWay: boolean;
    atmosphere: boolean; ground: boolean; constellationBounds?: boolean;
  };
  /** IAU abbreviation of the selected constellation (e.g. 'Cyg') — shows its boundary */
  selectedConstellationId?: string | null;
  /** Local Sidereal Time in hours (0-24) */
  lst: number;
  /** Observer latitude in degrees */
  observerLatitude: number;
  /** Bortle-derived naked-eye limiting magnitude (sky brightness limit) */
  limitingMag: number;
  /** Red night vision mode */
  redMode?: boolean;
  /** Selected ground texture id (see grounds.ts) */
  groundId?: string;
  /** Currently selected object ref (for showing orbital path — bypasses React render) */
  selectedObjectRef?: React.MutableRefObject<{ name: string | null; type: string | null }>;
}

/**
 * Convert horizontal coordinates (azimuth, altitude in degrees) to world Cartesian.
 * World frame: +X = East, +Y = Zenith, +Z = South.
 */
function hz2v(az: number, alt: number, r = R): [number, number, number] {
  const a = (az * Math.PI) / 180;
  const e = (alt * Math.PI) / 180;
  return [r * Math.cos(e) * Math.sin(a), r * Math.sin(e), -r * Math.cos(e) * Math.cos(a)];
}

/**
 * Convert equatorial coordinates (RA in DEGREES, Dec in degrees) to local 3D
 * position in the celestial frame used inside skyGroup.
 *
 * Celestial frame inside skyGroup (Y-up convention to match Three.js):
 *   +X = vernal equinox (RA=0)
 *   +Y = North Celestial Pole
 *   +Z = RA = 18h direction
 *
 * After skyGroup applies its sidereal rotation, this point lands at the
 * correct horizontal-frame position automatically.
 */
function raDecDegToCart(raDeg: number, decDeg: number, r: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const cd = Math.cos(dec);
  return [r * cd * Math.cos(ra), r * Math.sin(dec), -r * cd * Math.sin(ra)];
}

/**
 * Set the sky-group rotation that converts equatorial → horizontal frame.
 *
 * Derivation (verified):
 *   v_horiz = R_X(φ - π/2) · R_Y(-π/2 - L) · v_equatorial
 * where φ = observer latitude (rad), L = LST (rad).
 *
 * In Three.js Euler order 'XYZ' (rotation = X then Y then Z),
 * this is rotation.set(φ - π/2, -π/2 - L, 0, 'XYZ').
 */
function applySkyRotation(group: THREE.Group, latRad: number, lstRad: number) {
  group.rotation.set(latRad - Math.PI / 2, -Math.PI / 2 - lstRad, 0, 'XYZ');
}

const SPEC: Record<string, number> = {
  O: 0x9bb0ff, B: 0xaabfff, A: 0xcad7ff, F: 0xf8f7ff,
  G: 0xfff4ea, K: 0xffd2a1, M: 0xffcc6f,
};

// Reusable origin vector for billboard facing — avoids per-frame allocation.
const BILLBOARD_ORIGIN = new THREE.Vector3(0, 0, 0);

/**
 * Build a local orthonormal frame at a point on the celestial sphere (the
 * camera sits at the origin). Returns:
 *   out   — unit vector pointing away from the camera (line of sight, outward)
 *   east  — unit tangent pointing "right" on the sky (world-up × out)
 *   north — unit tangent pointing "up" on the sky (out × east)
 * Used to place moons in a real 3D ring around their planet (tangential +
 * line-of-sight depth) so the planet can occlude moons passing behind it.
 */
function skyBasis(x: number, y: number, z: number) {
  const len = Math.hypot(x, y, z) || 1;
  const ox = x / len, oy = y / len, oz = z / len;
  // east = worldUp(0,1,0) × out = (oz, 0, -ox)
  let ex = oz, ey = 0, ez = -ox;
  let elen = Math.hypot(ex, ey, ez);
  if (elen < 1e-6) { ex = 1; ey = 0; ez = 0; elen = 1; }
  ex /= elen; ey /= elen; ez /= elen;
  // north = out × east
  const nx = oy * ez - oz * ey;
  const ny = oz * ex - ox * ez;
  const nz = ox * ey - oy * ex;
  return { ox, oy, oz, ex, ey, ez, nx, ny, nz };
}

// Real angular radii in arcseconds (approximate, average Earth-planet distance).
// Hoisted to module scope so updateCelestials doesn't reallocate it per frame.
const PLANET_ANG_RADIUS_ARCSEC: Record<string, number> = {
  jupiter: 20.0, saturn: 8.5, mars: 7.0, venus: 12.0,
  mercury: 3.5, neptune: 1.15, uranus: 1.8,
};

// Mean physical radii (km) — used to size moons relative to their parent
// planet so a moon's on-screen size keeps the real moon/planet proportion.
const BODY_RADIUS_KM: Record<string, number> = {
  jupiter: 69911, saturn: 58232,
  io: 1821.6, europa: 1560.8, ganymede: 2634.1, callisto: 2410.3, titan: 2574.7,
};
const MOON_PARENT: Record<string, string> = {
  io: 'jupiter', europa: 'jupiter', ganymede: 'jupiter', callisto: 'jupiter',
  titan: 'saturn',
};

// Shared planet sizing constants/helpers (used by both the renderer and the
// label layout so the two always agree on where a planet/moon is and how big).
const ARCSEC_TO_WORLD = (R - 10) * Math.PI / (180 * 3600); // CR = R - 10
const PLANET_ZOOM_MAGNIFICATION = 40; // exaggerates tiny real discs so zoom "flies in"
const PLANET_DOT_PX = 1.4;            // star-like point at wide FOV (px radius)

/** World-space radius for a fixed on-screen pixel radius at the given FOV. */
function pxToWorldRadius(px: number, fov: number, minScreenDim: number): number {
  return (px / minScreenDim) * (fov * Math.PI / 180) * (R - 10);
}

/**
 * Rendered world radius of a planet: the larger of the star-like dot floor
 * (wide FOV) and its magnified true size (a fixed world size, so it grows on
 * zoom). Keeps planets and their moon systems sized consistently everywhere.
 */
function planetRenderedWorldRadius(angRadiusArcsec: number, fov: number, minScreenDim: number): number {
  const dotWorld = pxToWorldRadius(PLANET_DOT_PX, fov, minScreenDim);
  return Math.max(dotWorld, angRadiusArcsec * ARCSEC_TO_WORLD * PLANET_ZOOM_MAGNIFICATION);
}



function SkyRendererImpl(props: Props) {
  const propsRef = useRef(props);
  propsRef.current = props;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<any>(null);
  const starPtsRef = useRef<THREE.Points | null>(null);
  const constLinesRef = useRef<THREE.LineSegments | null>(null);
  const skyGroupRef = useRef<THREE.Group | null>(null);
  const planetMeshes = useRef<THREE.Mesh[]>([]);
  const planetSpheresRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const planetGlowsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const moonDotsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const saturnRingMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const orbitalPathRef = useRef<THREE.Line | null>(null);
  const dsoMeshes = useRef<THREE.Mesh[]>([]);
  const satMeshes = useRef<THREE.Mesh[]>([]);
  const satTexRef = useRef<THREE.DataTexture | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const loadedGroundId = useRef<string>(DEFAULT_GROUND_ID);
  const groundSwapRef = useRef<(() => void) | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const labelSprites = useRef<THREE.Sprite[]>([]);
  const frameRef = useRef(0);
  const lastVer = useRef(-1);
  const lastFov = useRef(60);
  const lastStarCount = useRef(0);
  // Cached named-star subset for labels (avoids scanning 192k stars at 10Hz).
  const namedStarsRef = useRef<Star[]>([]);
  const namedStarsSrc = useRef<Star[] | null>(null);
  const eqWorldTmp = useRef(new THREE.Vector3());

  const onGL = useCallback((gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl }) as any;
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // --- Lighting (for 3D planet shading / phases) ---
    // A faint ambient keeps the night side of a planet from going pure black,
    // and a directional light from the Sun's direction sculpts the lit
    // hemisphere so planets look like spheres (and Venus/Mercury/Mars show
    // their crescent phases) instead of flat discs.
    const ambient = new THREE.AmbientLight(0xffffff, 0.14);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(0, 1, 0); // updated each frame from the Sun's position
    scene.add(sunLight);
    scene.add(sunLight.target); // target stays at origin
    sunLightRef.current = sunLight;

    const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1200);
    cam.position.set(0, 0, 0);
    cam.up.set(0, 1, 0);
    camRef.current = cam;

    // Red night mode filter — a plane in front of the camera with multiply blend
    const redFilterGeo = new THREE.PlaneGeometry(2, 2);
    const redFilterMat = new THREE.ShaderMaterial({
      uniforms: { uEnabled: { value: 0.0 } },
      vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform float uEnabled;
        void main() {
          if (uEnabled < 0.5) discard;
          // Deep red multiply — kills green/blue, keeps red channel
          gl_FragColor = vec4(0.6, 0.0, 0.0, 0.7);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
    });
    const redFilterMesh = new THREE.Mesh(redFilterGeo, redFilterMat);
    redFilterMesh.renderOrder = 9999;
    redFilterMesh.frustumCulled = false;
    scene.add(redFilterMesh);

    /**
     * Update camera projection.
     *
     * The FOV value is interpreted as the angular extent across the screen's
     * MIN dimension (horizontal in portrait, vertical in landscape) using a
     * stereographic projection — same convention as Stellarium and most
     * planetarium apps. This makes "FOV 30°" mean the same thing here as it
     * does in Stellarium.
     *
     * Three.js PerspectiveCamera.fov is always the VERTICAL FOV using a
     * rectilinear (gnomonic) projection. Two conversions are applied:
     *
     *   1. Stereographic → gnomonic equivalent (so angular distances stay
     *      uniform across the field instead of stretching at the edges):
     *        gnomonicFov = 2 * atan(2 * tan(stereoFov / 4))
     *
     *   2. Min-dimension → vertical (since portrait phones have W < H):
     *        verticalFov = 2 * atan(tan(minDimFov / 2) * (H / W))
     */
    function updateProjection(camera: THREE.PerspectiveCamera, fov: number) {
      const fovRad = (Math.min(fov, 175) * Math.PI) / 180;

      // Step 1: stereographic → gnomonic-equivalent for the MIN dimension.
      const minDimGnomonic = 2 * Math.atan(2 * Math.tan(fovRad / 4));

      // Step 2: min-dimension → vertical (Three.js's camera.fov axis).
      let vFovRad: number;
      if (H >= W) {
        // Portrait: min dim = width. Vertical is the larger dimension.
        vFovRad = 2 * Math.atan(Math.tan(minDimGnomonic / 2) * (H / W));
      } else {
        // Landscape: min dim = height, which IS the vertical FOV.
        vFovRad = minDimGnomonic;
      }

      // Three.js's vertical FOV cannot exceed ~178°; clamp safely.
      const vFovDeg = Math.min(178, (vFovRad * 180) / Math.PI);
      camera.fov = vFovDeg;
      camera.updateProjectionMatrix();
    }

    // Expose a project function for tap detection — uses the actual GL camera
    if (propsRef.current.projectRef) {
      propsRef.current.projectRef.current = (az: number, alt: number, r: number = 100) => {
        const c = camRef.current;
        if (!c) return null;
        const a = (az * Math.PI) / 180;
        const e = (alt * Math.PI) / 180;
        const v = new THREE.Vector3(
          r * Math.cos(e) * Math.sin(a),
          r * Math.sin(e),
          -r * Math.cos(e) * Math.cos(a),
        );
        v.project(c);
        if (v.z > 1) return null;
        const sx = (v.x * 0.5 + 0.5) * W;
        const sy = (-v.y * 0.5 + 0.5) * H;
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) return null;
        return { x: sx, y: sy };
      };
    }

    // --- Stars: realistic Airy disc + diffraction spikes at zoom ---
    const starGeo = new THREE.BufferGeometry();
    const dpr = PixelRatio.get();
    // Star rendering parameters — tuned for 192k+ Gaia stars.
    // Faint stars should be tiny pinpoints; only the brightest few
    // hundred should be visually prominent.
    const STAR_LINEAR_SCALE = 14.0;  // (kept for reference, actual sizing is in shader)
    const STAR_RELATIVE_SCALE = 0.45;
    const CORE_SIZE = 0.5;
    const MIN_RADIUS = 1.0;
    const SKIP_RADIUS = 0.3;

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uDpr: { value: dpr },
        uMaxMag: { value: 6.0 },
        uFov: { value: 80.0 },
        uLST: { value: 0.0 },
        uLatitude: { value: 0.0 },
        uCoreSize: { value: CORE_SIZE },
        uClipHorizon: { value: 1.0 },  // 1.0 = clip below horizon, 0.0 = show all
        uExtinctionK: { value: 0.11 }, // atmospheric extinction (mag/airmass)
      },
      vertexShader: `
        attribute float size;   // pre-computed radius in pixels
        attribute float seed;
        attribute float mag;
        attribute float lum;    // pre-computed luminance (0-1)
        uniform float uTime;
        uniform float uDpr;
        uniform float uMaxMag;
        uniform float uFov;
        uniform float uLST;
        uniform float uLatitude;
        uniform float uCoreSize;
        uniform float uClipHorizon;
        uniform float uExtinctionK;
        varying lowp vec4 vColor;
        varying float vPtSize;

        void main() {
          // Hide stars beyond magnitude limit
          if (mag > uMaxMag) {
            gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }

          // Position is pre-computed horizontal coordinates (from sky-calculator)
          vec3 pos = position;

          // World position (used for horizon clip + atmospheric extinction).
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);

          // Horizon clip — when ground is on, hide stars below altitude 0.
          // worldY > 0 means above the horizontal plane.
          if (uClipHorizon > 0.5) {
            if (worldPos.y < 0.0) {
              gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
              gl_PointSize = 0.0;
              return;
            }
          }

          // Atmospheric extinction — stars dim as they approach the horizon
          // because their light passes through more air (higher airmass).
          // sinAlt = normalized worldY; airmass ≈ 1/sin(alt). We only dim the
          // brightness (never hard-cull) so behaviour with ground off is
          // unchanged apart from a realistic fade toward the horizon.
          float sinAlt = normalize(worldPos.xyz).y;
          float airmass = 1.0 / (clamp(sinAlt, 0.04, 1.0));
          float extMag = uExtinctionK * (airmass - 1.0);
          float extFactor = clamp(pow(10.0, -0.4 * extMag), 0.0, 1.0);

          // Subtle twinkle (only for brighter stars)
          float twinkle = 1.0;
          if (lum > 0.2) {
            float twinkleAmt = 0.05;
            twinkle = 1.0 - twinkleAmt + twinkleAmt *
              sin(uTime * (1.5 + seed * 2.0) + seed * 40.0);
          }

          // Project
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // Point size — the per-star size attribute (computed CPU-side
          // from a Pogson flux^0.45 curve) provides a steep brightness
          // differentiation. Bright stars get an extra multiplicative boost
          // so they pop with a strong halo at any zoom level.
          float zoomScale = 60.0 / max(uFov, 5.0);
          zoomScale = clamp(zoomScale, 0.7, 3.0);
          // brightBoost: 1.0 baseline, up to 1.7× for stars of mag ≤ 1
          // (Sirius/Vega/Arcturus territory) so they really stand out.
          float brightFactor = clamp((1.5 - mag) * 0.4, 0.0, 1.0);
          float brightBoost = 1.0 + brightFactor * 0.7;
          float ptSize = size * uDpr * zoomScale * brightBoost * 1.1;
          // Wide clamp range so brightness ratio survives at all zooms.
          gl_PointSize = clamp(ptSize, 1.0, 50.0);
          vPtSize = gl_PointSize;

          // Color: desaturate (real stars look mostly white with subtle tint)
          vec3 starCol = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), 0.5);
          // Luminance as alpha (faint = dim, bright = full), dimmed by the
          // atmosphere as the star nears the horizon.
          vColor = vec4(starCol, lum * twinkle * extFactor);
        }
      `,
      fragmentShader: `
        varying lowp vec4 vColor;
        varying float vPtSize;

        void main() {
          // Distance from center of point sprite (0 at center, 0.5 at edge)
          float dist = length(gl_PointCoord - vec2(0.5));

          // Bright core: tight gaussian for a crisp center
          float core = exp(-dist * dist / 0.02);

          // Soft inner glow — slightly amplified for brighter stars.
          float glow = exp(-dist * dist / 0.06) * (0.45 + vColor.a * 0.45);

          // Halo: quadratic falloff that naturally reaches zero at the
          // sprite edge (dist == 0.5). Avoids the visible square outline
          // a gaussian-only halo creates when its tails are non-zero at
          // the corners of the point sprite. Scales with brightness² so
          // bright stars get a much wider visible halo.
          float r = max(0.0, 1.0 - dist * 2.0);
          float halo = r * r * 0.55 * vColor.a * vColor.a;

          float profile = clamp(core + glow + halo, 0.0, 1.0);

          // Soft circular cutoff at the very edge, anti-aliasing the
          // sprite's square boundary so no stair-step shows up.
          float edgeFade = smoothstep(0.5, 0.46, dist);

          float alpha = vColor.a * profile * edgeFade;
          if (alpha < 0.003) discard;
          // Subtle white-hot core boost for brightest stars.
          float coreBoost = core * (0.3 + vColor.a * 0.4);
          gl_FragColor = vec4(vColor.rgb * (1.0 + coreBoost), alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const starPts = new THREE.Points(starGeo, starMat);
    // Create a sky rotation group — rotates the entire celestial sphere
    // Stars are placed in equatorial coords, group rotation handles sidereal time
    const skyGroup = new THREE.Group();
    skyGroup.add(starPts);
    scene.add(skyGroup);
    starPtsRef.current = starPts;
    skyGroupRef.current = skyGroup;

    // --- Milky Way: textured sphere (equirectangular image in equatorial coords) ---
    // Place a PNG at assets/milkyway.png — equirectangular projection, equatorial frame.
    // It rotates with the stars automatically via skyGroup.
    const mwGeo = new THREE.SphereGeometry(R - 4, 48, 24);
    const mwMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const mwMesh = new THREE.Mesh(mwGeo, mwMat);
    mwMesh.renderOrder = -2;
    // No rotation needed — texture RA=0 at left edge maps to +X in our frame.
    // BackSide rendering flips the winding, which mirrors the texture.
    // We counteract this by flipping the texture's U coordinate via repeat.
    mwMesh.visible = false; // hidden until texture loads
    skyGroup.add(mwMesh);

    (async () => {
      try {
        const tex = await loadTextureAsync({ asset: require('../assets/milkyway.jpg') });
        if (tex) {
          // Flip U to counteract BackSide mirror effect
          tex.wrapS = THREE.RepeatWrapping;
          tex.repeat.x = -1;
          tex.offset.x = 1;
          mwMat.map = tex;
          mwMat.needsUpdate = true;
          mwMesh.visible = true;
        }
      } catch (e) {
        console.warn('[SkyRenderer] Milky Way FAILED:', e);
      }
    })();

    // --- Constellation lines (glow layer + bright core) ---
    const cGeo = new THREE.BufferGeometry();

    // Custom shader material for constellation lines — clips below horizon
    // when ground is on, otherwise shows all the way down.
    const constVertShader = `
      varying float vWorldY;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldY = worldPos.y;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;
    const constFragGlow = `
      varying float vWorldY;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uClipHorizon;  // 1.0 = clip, 0.0 = show full
      void main() {
        if (uClipHorizon > 0.5) {
          if (vWorldY < -10.0) discard;
        }
        // Soft fade through the horizon when clip is on, full opacity otherwise
        float fade = mix(1.0, smoothstep(-10.0, 15.0, vWorldY), uClipHorizon);
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `;

    // Glow layer — wide soft outer glow
    const cGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x5599dd) },
        uOpacity: { value: 0.6 },
        uClipHorizon: { value: 1.0 },
      },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cGlow = new THREE.LineSegments(cGeo, cGlowMat);
    cGlow.renderOrder = 0;
    skyGroup.add(cGlow);

    // Second glow layer — medium glow
    const cGlow2Mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x4488cc) },
        uOpacity: { value: 0.5 },
        uClipHorizon: { value: 1.0 },
      },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cGlow2 = new THREE.LineSegments(cGeo, cGlow2Mat);
    cGlow2.renderOrder = 0;
    skyGroup.add(cGlow2);

    // Third glow layer — tight inner glow for extra thickness
    const cGlow3Mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x66bbff) },
        uOpacity: { value: 0.4 },
        uClipHorizon: { value: 1.0 },
      },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cGlow3 = new THREE.LineSegments(cGeo, cGlow3Mat);
    cGlow3.renderOrder = 0;
    skyGroup.add(cGlow3);

    // Core lines — bright and solid
    const cMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x99ccff) },
        uOpacity: { value: 1.0 },
        uClipHorizon: { value: 1.0 },
      },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
    });
    const cLines = new THREE.LineSegments(cGeo, cMat);
    cLines.renderOrder = 1;
    skyGroup.add(cLines);
    constLinesRef.current = cLines;
    // Store glow refs for visibility toggle
    const constGlowRef = { current: cGlow };
    const constGlow2Ref = { current: cGlow2 };
    const constGlow3Ref = { current: cGlow3 };

    // --- Constellation Art (Stellarium illustrations, anchor-based positioning) ---
    const constArtGroup = new THREE.Group();
    skyGroup.add(constArtGroup);
    const constArtGroupRef = { current: constArtGroup };
    const constArtEntries: Array<{ mesh: THREE.Mesh; ra: number; dec: number }> = [];

    const artRadius = R - 2;
    const westernIdx = require('../assets/constellations/western-index.json');

    // Build HIP star → RA/Dec lookup for anchor positioning
    const hipLookup = new Map<number, { ra: number; dec: number }>();
    for (const c of rawConstellationData as any[]) {
      for (const line of c.lines) {
        if (line.star1.hipId && line.star1.ra) hipLookup.set(line.star1.hipId, { ra: line.star1.ra, dec: line.star1.dec });
        if (line.star2.hipId && line.star2.ra) hipLookup.set(line.star2.hipId, { ra: line.star2.ra, dec: line.star2.dec });
      }
    }
    // Also add stars from the loaded Supabase catalog (fills in anchor stars not in line data)
    function enrichHipLookup() {
      // Supabase has the authoritative Hipparcos catalog — use it to override
      // any potentially incorrect positions from constellations.json
      for (const star of propsRef.current.stars) {
        const hipMatch = star.id.match(/^HIP(\d+)$/);
        if (hipMatch) {
          const hip = parseInt(hipMatch[1], 10);
          // Always overwrite — Supabase data is authoritative
          hipLookup.set(hip, { ra: star.ra * 15, dec: star.dec }); // ra hours → degrees
        }
      }
    }

    // Wrapper for shared raDecDegToCart helper (RA in DEGREES)
    const raDec2xyz = (raDeg: number, decDeg: number, r: number): [number, number, number] =>
      raDecDegToCart(raDeg, decDeg, r);

    (async () => {
      // Wait a bit for stars to load from Supabase, then enrich the lookup
      await new Promise(r => setTimeout(r, 3000));
      enrichHipLookup();

      const skipped: string[] = [];

      for (const c of westernIdx.constellations) {
        if (!c.image || !c.image.anchors || c.image.anchors.length < 2) continue;
        const filename = c.image.file.replace('illustrations/', '').replace('.webp', '');
        const asset = CONST_ART_PNG[filename];
        if (!asset) continue;

        // Resolve as many anchors as possible (Stellarium provides 3, but a
        // few illustrations have anchor stars below the loaded magnitude tier).
        const resolvedAnchors: Array<{ px: number; py: number; raDeg: number; decDeg: number }> = [];
        for (const a of c.image.anchors) {
          const star = hipLookup.get(a.hip);
          if (!star) continue;
          resolvedAnchors.push({ px: a.pos[0], py: a.pos[1], raDeg: star.ra, decDeg: star.dec });
        }
        if (resolvedAnchors.length < 2) {
          skipped.push(filename);
          continue;
        }

        try {
          const texture = await loadTextureAsync({ asset });
          const imgW = c.image.size[0];
          const imgH = c.image.size[1];

          // Compute pixel → 3D mapping. Two paths:
          //   (a) ≥3 non-collinear anchors: full affine transform (preserves
          //       rotation, scale and shear in image plane).
          //   (b) exactly 2 anchors: similarity transform (rotation + uniform
          //       scale + translation only). Less accurate for distorted
          //       illustrations but visually correct for most.
          let mapPixel: (px: number, py: number) => [number, number, number];

          if (resolvedAnchors.length >= 3) {
            // Try all triples until we find a non-degenerate one
            let found = false;
            for (let i = 0; i < resolvedAnchors.length - 2 && !found; i++) {
              for (let j = i + 1; j < resolvedAnchors.length - 1 && !found; j++) {
                for (let k = j + 1; k < resolvedAnchors.length && !found; k++) {
                  const p0 = resolvedAnchors[i], p1 = resolvedAnchors[j], p2 = resolvedAnchors[k];
                  const det = (p0.px - p2.px) * (p1.py - p2.py) - (p1.px - p2.px) * (p0.py - p2.py);
                  if (Math.abs(det) < 1.0) continue;

                  const pos0 = raDec2xyz(p0.raDeg, p0.decDeg, artRadius);
                  const pos1 = raDec2xyz(p1.raDeg, p1.decDeg, artRadius);
                  const pos2 = raDec2xyz(p2.raDeg, p2.decDeg, artRadius);

                  const solve = (v0: number, v1: number, v2: number) => {
                    const a = ((v0 - v2) * (p1.py - p2.py) - (v1 - v2) * (p0.py - p2.py)) / det;
                    const b = ((v1 - v2) * (p0.px - p2.px) - (v0 - v2) * (p1.px - p2.px)) / det;
                    const cc = v2 - a * p2.px - b * p2.py;
                    return [a, b, cc] as const;
                  };
                  const [ax, bx, cx] = solve(pos0[0], pos1[0], pos2[0]);
                  const [ay, by, cy] = solve(pos0[1], pos1[1], pos2[1]);
                  const [az, bz, cz] = solve(pos0[2], pos1[2], pos2[2]);

                  mapPixel = (px, py) => [
                    ax * px + bx * py + cx,
                    ay * px + by * py + cy,
                    az * px + bz * py + cz,
                  ];
                  found = true;
                }
              }
            }
            if (!found) {
              // All triples collinear — fall through to similarity transform
              resolvedAnchors.length = 2;
            }
          }

          if (resolvedAnchors.length === 2) {
            // 2-anchor similarity: pick a third synthetic anchor perpendicular
            // to the (p0, p1) baseline at the same scale.
            const a0 = resolvedAnchors[0], a1 = resolvedAnchors[1];
            const pos0 = raDec2xyz(a0.raDeg, a0.decDeg, artRadius);
            const pos1 = raDec2xyz(a1.raDeg, a1.decDeg, artRadius);

            // Pixel-space basis: u = a1 - a0, v = perpendicular(u)
            const dx = a1.px - a0.px;
            const dy = a1.py - a0.py;
            // 3D basis: U = pos1 - pos0
            const Ux = pos1[0] - pos0[0], Uy = pos1[1] - pos0[1], Uz = pos1[2] - pos0[2];
            // Normal at pos0 (radial direction outward from origin)
            const n0x = pos0[0] / artRadius, n0y = pos0[1] / artRadius, n0z = pos0[2] / artRadius;
            // V = n0 × U  (perpendicular to both U and the local sphere normal)
            const Vx = n0y * Uz - n0z * Uy;
            const Vy = n0z * Ux - n0x * Uz;
            const Vz = n0x * Uy - n0y * Ux;
            // Scale V to same length as U so pixel→3D scaling is uniform
            const Ulen = Math.sqrt(Ux * Ux + Uy * Uy + Uz * Uz);
            const Vlen = Math.sqrt(Vx * Vx + Vy * Vy + Vz * Vz) || 1e-6;
            const Vsx = (Vx / Vlen) * Ulen;
            const Vsy = (Vy / Vlen) * Ulen;
            const Vsz = (Vz / Vlen) * Ulen;

            // pixel-space length of (dx, dy)
            const Plen = Math.sqrt(dx * dx + dy * dy) || 1;
            // Solve (px - a0.px, py - a0.py) = α (dx, dy) + β (-dy, dx)
            // → α = ((px-x0)*dx + (py-y0)*dy) / Plen²
            //   β = (-(px-x0)*dy + (py-y0)*dx) / Plen²
            const invPlenSq = 1 / (Plen * Plen);
            mapPixel = (px, py) => {
              const tx = px - a0.px;
              const ty = py - a0.py;
              const alpha = (tx * dx + ty * dy) * invPlenSq;
              const beta = (-tx * dy + ty * dx) * invPlenSq;
              return [
                pos0[0] + alpha * Ux + beta * Vsx,
                pos0[1] + alpha * Uy + beta * Vsy,
                pos0[2] + alpha * Uz + beta * Vsz,
              ];
            };
          }

          // Map image corners to 3D positions on the sphere
          const cornerPixels: [number, number][] = [[0, 0], [imgW, 0], [imgW, imgH], [0, imgH]];
          const c3d = cornerPixels.map(([px, py]) => {
            const [x, y, z] = mapPixel!(px, py);
            // Normalize to sphere surface at the configured radius
            const len = Math.sqrt(x * x + y * y + z * z) || 1;
            return [x / len * artRadius, y / len * artRadius, z / len * artRadius] as [number, number, number];
          });

          // Custom geometry from the 4 corner positions
          const geo = new THREE.BufferGeometry();
          const positions = new Float32Array([
            ...c3d[0], ...c3d[1], ...c3d[2],
            ...c3d[0], ...c3d[2], ...c3d[3],
          ]);
          const uvs = new Float32Array([
            0, 1, 1, 1, 1, 0,
            0, 1, 1, 0, 0, 0,
          ]);
          geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

          const mesh = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({
              map: texture, transparent: true, opacity: 0,
              side: THREE.DoubleSide, depthWrite: false, depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          mesh.renderOrder = -1;
          mesh.visible = false;
          constArtGroup.add(mesh);

          // Center for visibility culling — average anchors in CARTESIAN space
          // (averaging RA values directly is wrong because RA wraps at 360°,
          // e.g. averaging 326° and 3° must yield ~345° not 164°).
          let sx = 0, sy = 0, sz = 0;
          for (const a of resolvedAnchors) {
            const [ax2, ay2, az2] = raDec2xyz(a.raDeg, a.decDeg, 1);
            sx += ax2; sy += ay2; sz += az2;
          }
          const slen = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
          sx /= slen; sy /= slen; sz /= slen;
          // Inverse: x = cos(dec)cos(ra), y = sin(dec), z = -cos(dec)sin(ra)
          const centerDec = Math.asin(Math.max(-1, Math.min(1, sy))) * 180 / Math.PI;
          let centerRA = Math.atan2(-sz, sx) * 180 / Math.PI;
          if (centerRA < 0) centerRA += 360;
          constArtEntries.push({ mesh, ra: centerRA, dec: centerDec });
        } catch (e) { /* skip */ }
        await new Promise(r => setTimeout(r, 30));
      }

      if (skipped.length > 0) {
        // Silenced: some faint constellations lack anchor stars in the loaded tier
      }
    })();

    // Per-frame: show constellations whose center is near the camera forward
    // direction, with smooth per-mesh fade. Tight cone so we generally see
    // 1–2 constellations at the very center, not the whole hemisphere.
    let artOpacity = 0;  // legacy, kept to avoid touching downstream refs
    const ART_FADE_IN = 0.015;   // ~1s fade in at 60fps
    const ART_FADE_OUT = 0.04;   // ~0.4s fade out
    const ART_MAX_OPACITY = 0.22;
    const ART_DOT_THRESHOLD = 0.94;  // ~20° cone — only what's actually centered

    // Track per-entry current opacity for independent fade-in/out animations
    const artOpacities: number[] = [];
    const artTmp = new THREE.Vector3();
    const artFwd = new THREE.Vector3();  // persistent — avoids per-frame alloc

    function updateConstArtVisibility(cam: THREE.PerspectiveCamera) {
      const showConst = propsRef.current.showLayers.constellations;
      const haveArt = constArtEntries.length > 0;
      const clipBelow = propsRef.current.showGround;

      // Lazy-init opacity array now that we know the entry count
      if (artOpacities.length !== constArtEntries.length) {
        artOpacities.length = constArtEntries.length;
        for (let i = 0; i < artOpacities.length; i++) artOpacities[i] = 0;
      }

      // Build forward vector once (reuse persistent vector — no alloc)
      artFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const fwd = artFwd;
      let anyVisible = false;

      // First pass: find the SINGLE constellation whose center is closest to
      // the screen centre (largest dot with the camera forward vector). Only
      // that one is allowed to show — this prevents 2-3 overlapping figures
      // from appearing at once when several centres fall inside the cone.
      let bestIdx = -1;
      let bestDot = ART_DOT_THRESHOLD;
      if (showConst && haveArt) {
        for (let i = 0; i < constArtEntries.length; i++) {
          const e = constArtEntries[i];
          const [cx, cy, cz] = raDec2xyz(e.ra, e.dec, 1);
          artTmp.set(cx, cy, cz);
          if (skyGroupRef.current) artTmp.applyMatrix4(skyGroupRef.current.matrixWorld);
          artTmp.normalize();
          const aboveHorizon = artTmp.y > -0.05;
          if (clipBelow && !aboveHorizon) continue;
          const dot = fwd.dot(artTmp);
          if (dot > bestDot) {
            bestDot = dot;
            bestIdx = i;
          }
        }
      }

      // Second pass: fade in only the winner, fade everyone else out.
      for (let i = 0; i < constArtEntries.length; i++) {
        const e = constArtEntries[i];
        const wantVisible = i === bestIdx;

        const cur = artOpacities[i];
        let next = cur;
        if (wantVisible) {
          next = Math.min(ART_MAX_OPACITY, cur + ART_FADE_IN);
        } else {
          next = Math.max(0, cur - ART_FADE_OUT);
        }
        artOpacities[i] = next;

        const mat = e.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = next;

        if (next > 0.001) {
          e.mesh.visible = true;
          anyVisible = true;
        } else if (e.mesh.visible) {
          e.mesh.visible = false;
        }
      }

      // Lines fade in together with the art — visible whenever any constellation is showing
      if (constLinesRef.current) constLinesRef.current.visible = anyVisible;
      if (constGlowRef.current) constGlowRef.current.visible = anyVisible;
      if (constGlow2Ref.current) constGlow2Ref.current.visible = anyVisible;
      if (constGlow3Ref.current) constGlow3Ref.current.visible = anyVisible;

      // Keep legacy var referenced so the unused-warning stays quiet
      void artOpacity;
    }

    // --- Ground (full sphere — PNG has transparent sky, opaque ground) ---
    const gGeo = new THREE.SphereGeometry(R - 1, 64, 32);
    const gMat = new THREE.MeshBasicMaterial({ color: 0x0c1208, side: THREE.BackSide, depthWrite: false });
    const groundMesh = new THREE.Mesh(gGeo, gMat);
    groundMesh.renderOrder = -5;
    scene.add(groundMesh);
    groundMeshRef.current = groundMesh;

    (async () => {
      try {
        const asset = getGroundAsset(propsRef.current.groundId ?? DEFAULT_GROUND_ID);
        const texture = await loadTextureAsync({ asset });
        loadedGroundId.current = propsRef.current.groundId ?? DEFAULT_GROUND_ID;
        // Use a custom shader to soft-fade the ground alpha near the horizon.
        // The PNG has a hard alpha edge at the horizon line — this smooths it
        // so the ground blends naturally into the sky instead of a harsh cut.
        (groundMesh as any).material = new THREE.ShaderMaterial({
          uniforms: { map: { value: texture } },
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
              vUv = uv;
              vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D map;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
              vec4 texel = texture2D(map, vUv);
              // h = 0 at horizon, negative below, positive above
              float h = normalize(vWorldPos).y;
              // Soft fade: fully transparent above horizon, blend in over a band
              // from h = 0.02 (just above horizon) down to h = -0.03 (just below)
              float horizonFade = smoothstep(0.02, -0.03, h);
              texel.a *= horizonFade;
              if (texel.a < 0.005) discard;
              gl_FragColor = texel;
            }
          `,
          transparent: true,
          side: THREE.BackSide,
          depthWrite: false,
          depthTest: false,
        });
        (groundMesh.material as any).needsUpdate = true;
      } catch (e) {
        console.warn('[SkyRenderer] Ground texture failed:', e);
      }
    })();

    // Swap the ground texture when the selected groundId changes. Reads the
    // live prop each frame-check; only reloads when the id actually differs,
    // and disposes the previous texture to free GPU memory.
    async function maybeSwapGround() {
      const wantId = propsRef.current.groundId ?? DEFAULT_GROUND_ID;
      if (wantId === loadedGroundId.current) return;
      loadedGroundId.current = wantId;
      try {
        const tex = await loadTextureAsync({ asset: getGroundAsset(wantId) });
        const mat = groundMesh.material as THREE.ShaderMaterial;
        if (mat && mat.uniforms && mat.uniforms.map) {
          const old = mat.uniforms.map.value as THREE.Texture | null;
          mat.uniforms.map.value = tex;
          mat.needsUpdate = true;
          old?.dispose();
        }
      } catch (e) {
        console.warn('[SkyRenderer] Ground swap failed:', e);
      }
    }
    groundSwapRef.current = maybeSwapGround;

    // --- Ground darkening overlay (day HDRI → dark at night) ---
    const groundOverlayGeo = new THREE.SphereGeometry(R - 1.01, 64, 32);
    const groundOverlayMat = new THREE.ShaderMaterial({
      uniforms: { sunAlt: { value: 0.0 } },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float sunAlt;
        varying vec3 vWorldPos;
        void main() {
          // Only darken below horizon (ground portion)
          float h = normalize(vWorldPos).y;
          // Soft fade instead of hard discard — blend out above horizon
          float groundMask = smoothstep(0.02, -0.02, h);
          if (groundMask < 0.005) discard;

          // Sun altitude drives darkness:
          // sunAlt > 10°: fully lit (no overlay)
          // sunAlt 0° to 10°: gradual darkening
          // sunAlt -6° to 0°: civil twilight — getting dark
          // sunAlt -12° to -6°: nautical twilight — quite dark
          // sunAlt < -12°: night — very dark
          float t = clamp((sunAlt - 10.0) / -22.0, 0.0, 1.0); // 10° → 0, -12° → 1

          // Night color: dark blue-black tint (not pure black — moonlight/ambient)
          vec3 nightTint = vec3(0.02, 0.02, 0.05);

          // Horizon gets a subtle warm glow during twilight
          float horizonFade = smoothstep(-0.05, 0.02, h);
          float twilight = smoothstep(0.3, 0.7, t) * (1.0 - smoothstep(0.7, 1.0, t));
          vec3 twilightTint = vec3(0.08, 0.04, 0.02) * twilight * horizonFade;

          vec3 color = nightTint + twilightTint;
          float alpha = t * 0.6 * groundMask; // max 60% dark — ground stays visible at night

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    const groundOverlay = new THREE.Mesh(groundOverlayGeo, groundOverlayMat);
    groundOverlay.renderOrder = -4; // Just in front of ground (-5)
    scene.add(groundOverlay);
    const groundOverlayRef = { current: groundOverlay };

    // --- Sky dome (renders behind everything) ---
    // Extend slightly below horizon (π/2 + 0.15 rad ≈ 8.6° below) so the
    // sky gradient overlaps the ground fade zone — no hard seam.
    const skyGeo = new THREE.SphereGeometry(R + 5, 48, 28, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { sunAlt: { value: 0.0 } },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float sunAlt;
        varying vec3 vWorldPos;
        void main() {
          float rawH = normalize(vWorldPos).y;
          float h = clamp(rawH, 0.0, 1.0);

          // Night: deep black with very subtle blue-grey at horizon (airglow)
          vec3 nZ = vec3(0.003, 0.003, 0.006);
          vec3 nH = vec3(0.015, 0.014, 0.018);

          // Civil twilight: deep indigo zenith, warm amber/peach horizon
          vec3 tZ = vec3(0.015, 0.015, 0.045);
          vec3 tH = vec3(0.45, 0.18, 0.06);

          // Golden hour: rich blue zenith, warm golden horizon
          vec3 gZ = vec3(0.12, 0.18, 0.38);
          vec3 gH = vec3(0.6, 0.35, 0.12);

          // Day: realistic sky blue (Rayleigh scattering) — deeper blue at zenith
          vec3 dZ = vec3(0.15, 0.28, 0.55);
          vec3 dH = vec3(0.45, 0.55, 0.68);

          // Sun altitude phases:
          // < -18°: night (t=0)
          // -18° to -6°: astronomical/nautical twilight
          // -6° to 0°: civil twilight
          // 0° to 6°: golden hour
          // > 6°: full day (t=1)
          float t = clamp((sunAlt + 18.0) / 24.0, 0.0, 1.0);

          vec3 zenith, horizon;
          if (t < 0.25) {
            // Night → twilight
            float tt = t / 0.25;
            zenith = mix(nZ, tZ, tt);
            horizon = mix(nH, tH, tt);
          } else if (t < 0.5) {
            // Twilight → golden hour
            float tt = (t - 0.25) / 0.25;
            zenith = mix(tZ, gZ, tt);
            horizon = mix(tH, gH, tt);
          } else if (t < 0.75) {
            // Golden hour → day
            float tt = (t - 0.5) / 0.25;
            zenith = mix(gZ, dZ, tt);
            horizon = mix(gH, dH, tt);
          } else {
            // Full day
            zenith = dZ;
            horizon = dH;
          }

          // Smooth gradient from horizon to zenith
          // Use pow for more realistic falloff (sky gets blue faster above horizon)
          float hPow = pow(h, 0.7);
          vec3 color = mix(horizon, zenith, hPow);

          // Alpha: transparent at night (stars show through), semi-transparent in day
          // Cap at 0.85 so planets/stars can show through the atmosphere
          float baseAlpha = mix(0.08, 0.85, t);
          // Fade out below horizon so sky dome doesn't block the ground texture
          float belowFade = smoothstep(-0.06, 0.0, rawH);
          float alpha = baseAlpha * belowFade;
          // Output full opacity — sky dome is the background layer
          // Stars use additive blending so they add light on top
          // Planets are opaque and render after with higher renderOrder
          gl_FragColor = vec4(color * alpha, 1.0);
        }
      `,
      transparent: false, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.renderOrder = -10;
    scene.add(skyDome);
    skyDomeRef.current = skyDome;

    // --- Horizon ring ---
    const hGeo = new THREE.TorusGeometry(R, 0.3, 4, 128);
    const hMat = new THREE.MeshBasicMaterial({ color: 0x556677, transparent: true, opacity: 0.25 });
    const hRing = new THREE.Mesh(hGeo, hMat);
    hRing.rotation.x = Math.PI / 2;
    scene.add(hRing);

    // --- Altitude grid (horizontal circles at 15° intervals) ---
    const altGridLines: THREE.Line[] = [];
    const altGridLabels: THREE.Sprite[] = [];
    const altGridMat = new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.6 });
    for (const alt of [15, 30, 45, 60, 75]) {
      const pts: THREE.Vector3[] = [];
      for (let az = 0; az <= 360; az += 3) {
        const [x, y, z] = hz2v(az, alt, R - 2);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, altGridMat);
      line.visible = false;
      line.renderOrder = -1;
      scene.add(line);
      altGridLines.push(line);
      // Labels at N, E, S, W only (every 90°)
      for (const az of [0, 90, 180, 270]) {
        const label = createTextSprite(`${alt}°`, '#66bbff', 6.0);
        const [lx, ly, lz] = hz2v(az, alt, R - 2);
        label.position.set(lx, ly, lz);
        label.visible = false;
        scene.add(label);
        altGridLabels.push(label);
      }
    }

    // --- Azimuth grid (arcs from horizon to zenith at 30° intervals) ---
    const azGridLines: THREE.Line[] = [];
    const azGridLabels: THREE.Sprite[] = [];
    const azGridMat = new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.6 });
    for (let az = 0; az < 360; az += 30) {
      const pts: THREE.Vector3[] = [];
      for (let alt = 0; alt <= 90; alt += 3) {
        const [x, y, z] = hz2v(az, alt, R - 2);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, azGridMat);
      line.visible = false;
      line.renderOrder = -1;
      scene.add(line);
      azGridLines.push(line);
      // Label only at horizon (alt=2° to avoid ground clip)
      const label = createTextSprite(`${az}°`, '#66bbff', 6.0);
      const [lx, ly, lz] = hz2v(az, 2, R - 2);
      label.position.set(lx, ly, lz);
      label.visible = false;
      scene.add(label);
      azGridLabels.push(label);
    }

    // --- Equatorial grid (RA/Dec lines in equatorial frame → inside skyGroup) ---
    const eqGridLines: THREE.Line[] = [];
    const eqGridLabels: THREE.Sprite[] = [];
    const eqGridMat = new THREE.LineBasicMaterial({ color: 0xff6699, transparent: true, opacity: 0.5 });
    // RA hour circles (every 2h = 30°)
    for (let raH = 0; raH < 24; raH += 2) {
      const raDeg = raH * 15;
      const pts: THREE.Vector3[] = [];
      for (let dec = -80; dec <= 80; dec += 4) {
        const [x, y, z] = raDecDegToCart(raDeg, dec, R - 3);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, eqGridMat);
      line.visible = false;
      line.renderOrder = -1;
      skyGroup.add(line);
      eqGridLines.push(line);
      // Label at celestial equator only
      const label = createTextSprite(`${raH}h`, '#ff6699', 6.0);
      const [lx, ly, lz] = raDecDegToCart(raDeg, 0, R - 3);
      label.position.set(lx, ly, lz);
      label.visible = false;
      skyGroup.add(label);
      eqGridLabels.push(label);
    }
    // Dec circles (every 15°)
    for (const dec of [-60, -45, -30, -15, 0, 15, 30, 45, 60]) {
      const pts: THREE.Vector3[] = [];
      for (let raDeg = 0; raDeg <= 360; raDeg += 3) {
        const [x, y, z] = raDecDegToCart(raDeg, dec, R - 3);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, eqGridMat);
      line.visible = false;
      line.renderOrder = -1;
      skyGroup.add(line);
      eqGridLines.push(line);
      // Labels at RA 0h and 12h only
      for (const raH of [0, 12]) {
        const label = createTextSprite(`${dec > 0 ? '+' : ''}${dec}°`, '#ff6699', 6.0);
        const [lx, ly, lz] = raDecDegToCart(raH * 15, dec, R - 3);
        label.position.set(lx, ly, lz);
        label.visible = false;
        skyGroup.add(label);
        eqGridLabels.push(label);
      }
    }

    // --- Constellation boundaries (IAU, equatorial frame) ---
    const boundaryLines: THREE.Line[] = [];
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0xdd8844, transparent: true, opacity: 0.7,
    });
    for (const boundary of (constellationBoundaries as Array<{ id: string; pts: number[][] }>)) {
      const pts: THREE.Vector3[] = [];
      for (const [ra, dec] of boundary.pts) {
        const [x, y, z] = raDecDegToCart(ra, dec, R - 4);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, boundaryMat);
      line.visible = false;
      line.renderOrder = 5;
      skyGroup.add(line);
      boundaryLines.push(line);
    }

    // --- Cardinal markers ---
    const dirs: Array<[string, number, number]> = [['N', 0, 0xff4444], ['E', 90, 0xffffff], ['S', 180, 0xffffff], ['W', 270, 0xffffff]];
    for (const [, az, col] of dirs) {
      const dGeo = new THREE.SphereGeometry(1.5, 8, 8);
      const dMat = new THREE.MeshBasicMaterial({ color: col });
      const dMesh = new THREE.Mesh(dGeo, dMat);
      const [x, y, z] = hz2v(az, 0, R);
      dMesh.position.set(x, y, z);
      scene.add(dMesh);
    }

    // --- Sun billboard sprite ---
    const sunSprite = makeBillboardSprite(200, SUN_FRAG, { uTime: { value: 0.0 } });
    sunSprite.visible = false;
    sunSprite.renderOrder = 3;
    scene.add(sunSprite);
    sunMeshRef.current = sunSprite;

    // --- Moon: real 3D textured sphere (lit by the Sun for accurate phases) ---
    // A lit sphere (not a flat billboard) so it has true 3D shape, shows the
    // correct phase/terminator from the Sun-direction light, and carries a
    // real surface texture + displacement/bump relief like the planets.
    const moonGeo = new THREE.SphereGeometry(1, 96, 64);
    const moonSphereMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0,
      emissive: 0x0a0c14,        // faint earthshine on the unlit side
      emissiveIntensity: 1.0,
      depthTest: true,
      depthWrite: true,
    });
    const moonSphere = new THREE.Mesh(moonGeo, moonSphereMat);
    moonSphere.visible = false;
    moonSphere.renderOrder = 9;
    scene.add(moonSphere);
    moonMeshRef.current = moonSphere;
    // Load the surface texture, then the displacement map (doubles as a bump
    // map for crater shading near the terminator).
    (async () => {
      try {
        const t = await loadTextureAsync({ asset: require('../assets/planets/Moon_tex_2k.jpg') });
        moonSphereMat.map = t;
        moonSphereMat.needsUpdate = true;
      } catch (e) {}
      try {
        const dsp = await loadTextureAsync({ asset: require('../assets/planets/ldem_3_8bit.jpg') });
        // Bump map: cheap normal perturbation → crater relief that catches the
        // light along the terminator.
        moonSphereMat.bumpMap = dsp;
        moonSphereMat.bumpScale = 1.2;
        // Displacement map: actual geometric relief (subtle — real lunar relief
        // is tiny relative to the radius). Needs the subdivided sphere above.
        // ldem_3_8bit is a real Lunar DEM (elevation) map.
        moonSphereMat.displacementMap = dsp;
        moonSphereMat.displacementScale = 0.025;
        moonSphereMat.displacementBias = -0.0125;
        moonSphereMat.needsUpdate = true;
      } catch (e) {}
    })();

    // --- Planet textured spheres ---
    // Same pattern as ground texture loading (which works)
    const planetSphereMap = new Map<string, THREE.Mesh>();
    const planetIds = ['jupiter', 'saturn', 'mars', 'venus', 'mercury', 'neptune', 'uranus'];
    for (const id of planetIds) {
      const geo = new THREE.SphereGeometry(1, 48, 32);
      // Standard (lit) material so the Sun-direction light sculpts a real 3D
      // sphere with a day/night terminator (phases). A small emissive keeps
      // the dark limb faintly visible rather than pure black.
      //
      // depthTest + depthWrite are ON so the planet body occludes any moon
      // passing behind it (and Saturn occludes the back half of its ring),
      // giving the system genuine 3D depth rather than a flat decal. The
      // background (stars, Milky Way, atmosphere) does not write depth, so
      // planets still draw correctly in front of it.
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 1.0,
        metalness: 0.0,
        emissive: 0x222222,
        emissiveIntensity: 1.0,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,
        transparent: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 10;
      scene.add(mesh);
      planetSphereMap.set(id, mesh);
    }
    // Load textures one by one (same as ground.png pattern). The texture is
    // used both as the diffuse map and (dimly) as the emissive map so the
    // unlit side still shows faint surface detail.
    const applyTex = (id: string, t: THREE.Texture) => {
      const m = planetSphereMap.get(id);
      if (!m) return;
      const mm = m.material as THREE.MeshStandardMaterial;
      mm.map = t;
      mm.emissiveMap = t;
      mm.emissive.set(0x333333);
      mm.color.set(0xffffff);
      mm.needsUpdate = true;
    };
    (async () => {
      try { applyTex('jupiter', await loadTextureAsync({ asset: require('../assets/planets/2k_jupiter.jpg') })); } catch(e) {}
      try { applyTex('saturn', await loadTextureAsync({ asset: require('../assets/planets/2k_saturn.jpg') })); } catch(e) {}
      try { applyTex('mars', await loadTextureAsync({ asset: require('../assets/planets/2k_mars.jpg') })); } catch(e) {}
      try { applyTex('venus', await loadTextureAsync({ asset: require('../assets/planets/2k_venus_surface.jpg') })); } catch(e) {}
      try { applyTex('mercury', await loadTextureAsync({ asset: require('../assets/planets/2k_mercury.jpg') })); } catch(e) {}
      try { applyTex('neptune', await loadTextureAsync({ asset: require('../assets/planets/2k_neptune.jpg') })); } catch(e) {}
      try { applyTex('uranus', await loadTextureAsync({ asset: require('../assets/planets/2k_uranus.jpg') })); } catch(e) {}
    })();
    // Saturn ring — large flat disc that wraps around the sphere body.
    // The back half is occluded by Saturn's sphere via depth testing.
    const saturnRingGeo = new THREE.RingGeometry(1.4, 2.6, 96);
    // Map texture along radial direction (texture is a horizontal strip
    // representing inner-to-outer ring colour bands).
    const ringPos = saturnRingGeo.attributes.position;
    const ringUv = saturnRingGeo.attributes.uv;
    const innerR = 1.4;
    const outerR = 2.6;
    for (let i = 0; i < ringPos.count; i++) {
      const rx = ringPos.getX(i);
      const ry = ringPos.getY(i);
      const rad = Math.sqrt(rx * rx + ry * ry);
      ringUv.setXY(i, (rad - innerR) / (outerR - innerR), 0.5);
    }
    const saturnRingMat = new THREE.MeshBasicMaterial({
      color: 0xccbb99,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      // Depth-test against Saturn's sphere so the back half of the ring is hidden.
      depthTest: true,
      depthWrite: false,
    });
    const saturnRingMesh = new THREE.Mesh(saturnRingGeo, saturnRingMat);
    // RingGeometry lies in the XY plane. We want the ring in Saturn's
    // equatorial plane, tilted by its actual axial tilt as seen from Earth.
    // This varies from 0° (edge-on) to ±26.7° over Saturn's 29-year orbit.
    //   rotation.x = π/2 puts the ring in the XZ plane (perpendicular to Y)
    //   rotation.z = computed tilt toward Earth
    const saturnTilt = getSaturnRingTiltRad(new Date());
    saturnRingMesh.rotation.set(Math.PI / 2, 0, -saturnTilt);
    saturnRingMesh.visible = false;
    saturnRingMesh.renderOrder = 11;
    scene.add(saturnRingMesh);
    // Load ring texture
    (async () => {
      try {
        const t = await loadTextureAsync({ asset: require('../assets/planets/2k_saturn_ring_alpha.png') });
        saturnRingMat.map = t;
        saturnRingMat.color.set(0xffffff);
        saturnRingMat.needsUpdate = true;
      } catch(e) {}
    })();
    saturnRingMeshRef.current = saturnRingMesh;

    // Store in ref for updateCelestials access
    planetSpheresRef.current = planetSphereMap;

    // --- Planet glow sprites (distant planets read as glowing star points) ---
    const planetGlowMap = new Map<string, THREE.Mesh>();
    for (const id of planetIds) {
      const rgb = PLANET_COLORS[id] ?? [1, 1, 1];
      const glow = makeBillboardSprite(1, PLANET_GLOW_FRAG, {
        uColor: { value: new THREE.Vector3(rgb[0], rgb[1], rgb[2]) },
        uOpacity: { value: 1.0 },
      });
      glow.visible = false;
      glow.renderOrder = 8; // under the textured sphere (10)
      scene.add(glow);
      planetGlowMap.set(id, glow);
    }
    planetGlowsRef.current = planetGlowMap;

    // --- Planetary moon dots (Galilean + Titan) ---
    // Small spheres that orbit Jupiter/Saturn in real 3D — depth-tested so the
    // planet occludes any moon passing behind it.
    const moonDotGeo = new THREE.SphereGeometry(1.0, 16, 16);
    const moonDotMat = new THREE.MeshBasicMaterial({ color: 0xffffee, depthTest: true, depthWrite: true });
    const moonDotIds = ['io', 'europa', 'ganymede', 'callisto', 'titan'];
    const moonDotMap = new Map<string, THREE.Mesh>();
    for (const id of moonDotIds) {
      const dot = new THREE.Mesh(moonDotGeo, moonDotMat.clone());
      dot.visible = false;
      dot.renderOrder = 11;
      scene.add(dot);
      moonDotMap.set(id, dot);
    }
    moonDotsRef.current = moonDotMap;

    // --- Orbital path (line for selected planet/moon/sun) ---
    const orbitalPathMaxPoints = 48;
    const orbitalPathGeo = new THREE.BufferGeometry();
    const orbitalPathPositions = new Float32Array(orbitalPathMaxPoints * 3);
    orbitalPathGeo.setAttribute('position', new THREE.BufferAttribute(orbitalPathPositions, 3));
    orbitalPathGeo.setDrawRange(0, 0);
    const orbitalPathMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    const orbitalPathLine = new THREE.Line(orbitalPathGeo, orbitalPathMat);
    orbitalPathLine.visible = false;
    orbitalPathLine.renderOrder = 50;
    scene.add(orbitalPathLine);
    orbitalPathRef.current = orbitalPathLine;

    // --- Render loop ---
    const startTime = Date.now();
    let lastLabelTime = 0;
    let projectionInitialized = false;
    // Persistent per-frame temporaries — allocated once, reused every frame
    // (avoids GC churn in the render path).
    const TMP_Q = new THREE.Quaternion();
    const TMP_OBJ = new THREE.Object3D();
    const TMP_EULER = new THREE.Euler();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const p = propsRef.current;
      const c = camRef.current;
      if (!c || !rendererRef.current || !sceneRef.current) return;

      const t = (Date.now() - startTime) * 0.001;
      starMat.uniforms.uTime.value = t;
      if (sunMeshRef.current?.visible) {
        (sunMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      }

      // Camera orientation with smoothing
      // Read FOV from ref for real-time smoothness (no React re-render lag)
      const currentFov = p.fovRef ? p.fovRef.current : p.fov;

      if (p.pointingRef && p.arMode !== false && p.pointingRef.current.ready) {
        const [qx, qy, qz, qw] = p.pointingRef.current.quaternion;
        // Smoothing factor: more smoothing at lower FOV (higher zoom)
        // FOV 60° → factor 0.3 (responsive), FOV 10° → factor 0.06 (very smooth)
        const smoothFactor = Math.max(0.06, Math.min(0.4, currentFov / 200));
        // SLERP toward the raw sensor quaternion (reused temporary — no alloc).
        TMP_Q.set(qx, qy, qz, qw);
        c.quaternion.slerp(TMP_Q, smoothFactor);
      } else {
        // Manual mode: smooth interpolation toward target direction
        // Read from ref for 60fps responsiveness (no React re-render needed)
        const manAz = p.manualPosRef ? p.manualPosRef.current.azimuth : p.azimuth;
        const manAlt = p.manualPosRef ? p.manualPosRef.current.altitude : p.altitude;
        const [lx, ly, lz] = hz2v(manAz, manAlt, 1);
        // Reuse persistent temporaries — no per-frame allocation.
        TMP_OBJ.position.set(0, 0, 0);
        TMP_OBJ.up.set(0, 1, 0);
        TMP_OBJ.lookAt(lx, ly, lz);
        c.quaternion.slerp(TMP_OBJ.quaternion, 0.5);
      }

      const fovDelta = Math.abs(currentFov - lastFov.current);
      const fovChanged = fovDelta > 0.05;
      if (fovChanged || !projectionInitialized) {
        updateProjection(c, currentFov);
        lastFov.current = currentFov;
        projectionInitialized = true;
      }

      // Rotate the sky group by LST and latitude
      // Maps equatorial coordinates → horizontal frame correctly.
      // See applySkyRotation for derivation.
      const lstRad = p.lst * 15 * Math.PI / 180;
      const latRad = p.observerLatitude * Math.PI / 180;
      applySkyRotation(skyGroupRef.current!, latRad, lstRad);

      // Visibility
      if (groundMeshRef.current) groundMeshRef.current.visible = p.showGround;
      if (groundOverlayRef.current) groundOverlayRef.current.visible = p.showGround;
      if (skyDomeRef.current) skyDomeRef.current.visible = p.showAtmosphere;
      // Grid visibility
      for (const line of altGridLines) line.visible = p.showLayers.altGrid;
      for (const line of azGridLines) line.visible = p.showLayers.azGrid;
      for (const line of eqGridLines) line.visible = p.showLayers.eqGrid;
      for (const label of altGridLabels) label.visible = p.showLayers.altGrid;
      for (const label of azGridLabels) label.visible = p.showLayers.azGrid;
      for (const label of eqGridLabels) label.visible = p.showLayers.eqGrid;
      // Constellation boundaries — show only the selected one
      const selName = p.selectedConstellationId ?? '';
      const selIau = (CONST_NAME_TO_IAU[selName] ?? selName).toLowerCase();
      if (selIau) {
        for (let i = 0; i < boundaryLines.length; i++) {
          const bId = (constellationBoundaries as Array<{ id: string; pts: number[][] }>)[i]?.id?.toLowerCase();
          boundaryLines[i].visible = bId === selIau;
        }
      } else {
        for (const line of boundaryLines) line.visible = false;
      }
      if (constLinesRef.current) {} // Visibility controlled by updateConstArtVisibility
      if (constGlowRef.current) {}
      if (constGlow2Ref.current) {}
      if (constGlow3Ref.current) {}
      if (constArtGroupRef.current) constArtGroupRef.current.visible = p.showLayers.constellations;
      // Milky Way visibility (only if texture is loaded — mwMat.map is set)
      if (mwMat.map) {
        mwMesh.visible = p.showLayers.milkyWay;
        mwMat.opacity = 0.4;
      }
      // Sun/Moon visibility
      if (sunMeshRef.current) sunMeshRef.current.visible = p.showLayers.sun && !!p.sunPosition;
      if (moonMeshRef.current) moonMeshRef.current.visible = p.showLayers.moon && !!p.moonPosition;

      // Update star shader uniforms (cheap — these are per-frame)
      // Limiting magnitude follows the Stellarium model: the Bortle naked-eye
      // limit at natural FOV, with a capped fainter-star bonus as you zoom in.
      const maxMag = effectiveLimitingMagnitude(currentFov, p.limitingMag ?? 6.0);
      starMat.uniforms.uMaxMag.value = maxMag;
      starMat.uniforms.uFov.value = currentFov;
      starMat.uniforms.uLST.value = p.lst * 15 * Math.PI / 180;
      starMat.uniforms.uLatitude.value = p.observerLatitude * Math.PI / 180;
      // Horizon clipping — on when ground is shown, off otherwise.
      const clipHorizon = p.showGround ? 1.0 : 0.0;
      starMat.uniforms.uClipHorizon.value = clipHorizon;
      cGlowMat.uniforms.uClipHorizon.value = clipHorizon;
      cGlow2Mat.uniforms.uClipHorizon.value = clipHorizon;
      cGlow3Mat.uniforms.uClipHorizon.value = clipHorizon;
      cMat.uniforms.uClipHorizon.value = clipHorizon;

      if (p.dataVersion !== lastVer.current) {
        lastVer.current = p.dataVersion;
        lastFov.current = currentFov;

        // Stars: rebuild ONLY when new stars are loaded (tier change).
        // Do NOT rebuild on FOV change — the shader handles visibility via
        // uMaxMag and uFov. Rebuilding on zoom was the main perf killer.
        const starCount = p.stars.length;
        if (starCount !== lastStarCount.current) {
          lastStarCount.current = starCount;
          rebuildStars(p);
        }
        rebuildLines(p);
        updateCelestials(p, c);
        skyMat.uniforms.sunAlt.value = p.sunAltitude;
        groundOverlayMat.uniforms.sunAlt.value = p.sunAltitude;
      } else if (fovChanged) {
        // Don't rebuild labels mid-zoom — the 200 ms heartbeat below picks
        // them up after the gesture settles. Just track the new FOV.
        lastFov.current = currentFov;
        // But DO update celestials (planets + moons) so moon dots appear on zoom
        updateCelestials(p, c);
      }

      // Heartbeat label rebuild — cheap enough at 10 Hz
      if (t - lastLabelTime > 0.1) {
        lastLabelTime = t;
        rebuildLabels(p, c);
      }

      // Satellites move fast — update every frame using interpolation between
      // pre-computed snapshots so motion is smooth (60fps) without running
      // SGP4 propagation 60 times a second for ~200 satellites.
      updateSatelliteMeshes(p);

      // Keep billboards facing camera every frame
      faceBillboards(c);

      // Counter-rotate label sprites so text stays upright regardless of
      // phone roll, AND scale them by FOV so they remain a constant pixel
      // size on screen rather than ballooning when zoomed in.
      //
      // Three.js sprites with sizeAttenuation:true have a fixed angular size,
      // so their pixel size grows as ~1/FOV. Multiplying scale by
      // (currentFov / REF_FOV) cancels that out and gives constant px size.
      TMP_EULER.setFromQuaternion(c.quaternion, 'YXZ');
      const rollAngle = TMP_EULER.z; // camera roll in radians
      const REF_FOV = 30;
      const fovScale = Math.max(0.4, Math.min(4, currentFov / REF_FOV));
      // Global "a bit smaller" multiplier for all text labels.
      const LABEL_SHRINK = 0.8;

      // Helper to apply constant-pixel-size scaling to a sprite, with an
      // optional extra multiplier (used for the global shrink + per-object
      // dynamic sizing so closer/bigger/brighter objects get larger labels).
      const scaleSpriteToFov = (s: THREE.Sprite, applyRoll: boolean, sizeMul = 1) => {
        if (!s.visible) return;
        if (applyRoll) s.material.rotation = -rollAngle;
        const ud = s.userData as { baseX?: number; baseY?: number };
        if (ud.baseX === undefined) {
          ud.baseX = s.scale.x;
          ud.baseY = s.scale.y;
        }
        s.scale.set(ud.baseX * fovScale * sizeMul, ud.baseY * fovScale * sizeMul, 1);
      };

      // Dynamic labels (stars, planets, satellites, DSOs, constellations…) —
      // smaller overall, and modulated by each object's dynamic size factor.
      for (let i = 0; i < labelSprites.current.length; i++) {
        const s = labelSprites.current[i];
        const dyn = (s.userData as { dynScale?: number }).dynScale ?? 1;
        scaleSpriteToFov(s, true, LABEL_SHRINK * dyn);
      }
      // Coordinate grid labels (alt/az/equatorial)
      for (let i = 0; i < altGridLabels.length; i++) scaleSpriteToFov(altGridLabels[i], true, LABEL_SHRINK);
      for (let i = 0; i < azGridLabels.length; i++) scaleSpriteToFov(azGridLabels[i], true, LABEL_SHRINK);
      for (let i = 0; i < eqGridLabels.length; i++) scaleSpriteToFov(eqGridLabels[i], true, LABEL_SHRINK);
      // Satellite icons (sprites under satMeshes — keep upright but no roll
      // counter-rotation needed since the icon is symmetric). Left at full size.
      for (let i = 0; i < satMeshes.current.length; i++) {
        scaleSpriteToFov(satMeshes.current[i] as unknown as THREE.Sprite, false, 1);
      }

      // Show only the constellation art closest to screen center
      updateConstArtVisibility(c);

      rendererRef.current.render(sceneRef.current, c);
      // Update red mode filter
      redFilterMat.uniforms.uEnabled.value = p.redMode ? 1.0 : 0.0;
      gl.endFrameEXP();
    };
    animate();
  }, []);

  /** Make all billboard sprites face the camera */
  function faceBillboards(cam: THREE.PerspectiveCamera) {
    // Sun and moon are in the scene — simple lookAt
    if (sunMeshRef.current?.visible) sunMeshRef.current.lookAt(cam.position);
    if (moonMeshRef.current?.visible) moonMeshRef.current.lookAt(cam.position);
    // Planet glow halos face the camera too.
    for (const [, glow] of planetGlowsRef.current) {
      if (glow.visible) glow.lookAt(cam.position);
    }
    // DSOs are in the skyGroup — lookAt origin (camera is at origin).
    // Reuse a module-level origin vector to avoid per-frame allocation.
    for (let i = 0; i < dsoMeshes.current.length; i++) {
      const m = dsoMeshes.current[i];
      if (m.visible) m.lookAt(BILLBOARD_ORIGIN);
    }
  }

  // ─── Pre-allocated star buffers (zero GC in render path) ─────────────
  // Allocated once at max capacity. rebuildStars fills them without allocation.
  const MAX_STARS = 200000;
  const starBufs = useRef<{
    pos: Float32Array;
    col: Float32Array;
    sizes: Float32Array;
    mags: Float32Array;
    lums: Float32Array;
    seeds: Float32Array;
    posAttr: THREE.Float32BufferAttribute | null;
    colAttr: THREE.Float32BufferAttribute | null;
    sizeAttr: THREE.Float32BufferAttribute | null;
    magAttr: THREE.Float32BufferAttribute | null;
    lumAttr: THREE.Float32BufferAttribute | null;
    seedAttr: THREE.Float32BufferAttribute | null;
  }>({
    pos: new Float32Array(MAX_STARS * 3),
    col: new Float32Array(MAX_STARS * 3),
    sizes: new Float32Array(MAX_STARS),
    mags: new Float32Array(MAX_STARS),
    lums: new Float32Array(MAX_STARS),
    seeds: new Float32Array(MAX_STARS),
    posAttr: null, colAttr: null, sizeAttr: null,
    magAttr: null, lumAttr: null, seedAttr: null,
  });

  function rebuildStars(p: Props) {
    if (!starPtsRef.current) return;

    const buf = starBufs.current;
    const n = Math.min(p.stars.length, MAX_STARS);
    const c = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const star = p.stars[i];
      const [x, y, z] = raDecDegToCart(star.ra * 15, star.dec, R);
      const i3 = i * 3;
      buf.pos[i3] = x;
      buf.pos[i3 + 1] = y;
      buf.pos[i3 + 2] = z;

      c.set(SPEC[star.spectralType] ?? 0xfff4ea);
      buf.col[i3] = c.r;
      buf.col[i3 + 1] = c.g;
      buf.col[i3 + 2] = c.b;

      const mag = star.magnitude;
      buf.mags[i] = mag;

      // Map magnitude to a normalized brightness factor in [0, 1] using
      // Pogson's flux ratio (each magnitude ≈ 2.512× brightness).
      // Reference: mag 5 = "1×" flux. Brighter stars get a flux > 1 (which
      // we use to drive larger size and stronger glow), faint stars < 1.
      //
      // We keep the *raw* flux for the size curve (it spans many decades
      // for naked-eye-visible stars), and apply a soft cap for alpha so
      // faint stars stay visibly dimmer while the brightest still stand out.
      const flux = Math.pow(2.512, 5 - mag);

      // Alpha — brighter overall so faint naked-eye stars stay clearly
      // visible (the previous curve dimmed them too far in the name of
      // realism). Higher floor + gain; still capped at 1.0 for the brightest.
      // Mag -1.5 → 1.0, Mag 0 → 1.0, Mag 2 → ~0.9, Mag 5 → 0.6, Mag 6.5 → 0.5.
      const luminance = Math.min(1.0, 0.36 + Math.pow(flux, 0.35) * 0.25);
      buf.lums[i] = luminance;

      // Radius — larger across the board so stars read as crisp points rather
      // than near-invisible specks, while keeping the steep bright-vs-faint
      // ratio. Mag -1.5 → ~11, Mag 0 → ~7.6, Mag 2 → ~3.8, Mag 5 → 1.5,
      // Mag 6.5 → 1.15.
      const radius = 0.7 + Math.pow(flux, 0.45) * 0.8;
      buf.sizes[i] = radius;

      buf.seeds[i] = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 45.164)) % 1.0;
    }

    const geo = starPtsRef.current.geometry;

    // Reuse buffer attributes — just update data + count, no new objects
    if (!buf.posAttr) {
      buf.posAttr = new THREE.Float32BufferAttribute(buf.pos, 3);
      buf.colAttr = new THREE.Float32BufferAttribute(buf.col, 3);
      buf.sizeAttr = new THREE.Float32BufferAttribute(buf.sizes, 1);
      buf.magAttr = new THREE.Float32BufferAttribute(buf.mags, 1);
      buf.lumAttr = new THREE.Float32BufferAttribute(buf.lums, 1);
      buf.seedAttr = new THREE.Float32BufferAttribute(buf.seeds, 1);
      geo.setAttribute('position', buf.posAttr);
      geo.setAttribute('color', buf.colAttr);
      geo.setAttribute('size', buf.sizeAttr);
      geo.setAttribute('mag', buf.magAttr);
      geo.setAttribute('lum', buf.lumAttr);
      geo.setAttribute('seed', buf.seedAttr);
    } else {
      buf.posAttr.needsUpdate = true;
      buf.colAttr!.needsUpdate = true;
      buf.sizeAttr!.needsUpdate = true;
      buf.magAttr!.needsUpdate = true;
      buf.lumAttr!.needsUpdate = true;
      buf.seedAttr!.needsUpdate = true;
    }

    // Update draw range to only render the stars we filled
    geo.setDrawRange(0, n);
    geo.computeBoundingSphere();
  }

  // Build constellation lines ONCE in equatorial coordinates (same frame as stars).
  // Since they're in the skyGroup, they rotate with the stars automatically.
  const constLinesBuilt = useRef(false);

  function rebuildLines(_p: Props) {
    if (!constLinesRef.current || constLinesBuilt.current) return;
    constLinesBuilt.current = true;

    const geo = constLinesRef.current.geometry;
    const r = R - 2; // Same radius as constellation art for alignment
    const pos: number[] = [];

    for (const c of rawConstellationData as any[]) {
      for (const line of c.lines) {
        // RA in JSON is in DEGREES (0-360), Dec in degrees
        const [x1, y1, z1] = raDecDegToCart(line.star1.ra, line.star1.dec, r);
        const [x2, y2, z2] = raDecDegToCart(line.star2.ra, line.star2.dec, r);
        pos.push(x1, y1, z1, x2, y2, z2);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
  }

  // Label sprite cache — reuse sprites instead of recreating every update
  const labelCache = useRef<Map<string, THREE.Sprite>>(new Map());

  // --- Satellite dot meshes ---
  /**
   * Render satellite icons with smooth motion via per-frame interpolation
   * between two SGP4 snapshots (now and now + 1s) computed in useSkyEngine.
   * The renderer linearly blends azimuth and altitude based on elapsed time
   * since the "prev" snapshot, giving 60fps smoothness without running SGP4
   * every frame for ~200 satellites.
   */
  function updateSatelliteMeshes(p: Props) {
    const scene = sceneRef.current;
    if (!scene || !p.showLayers.satellites || !p.satellitePositions) {
      for (const m of satMeshes.current) m.visible = false;
      return;
    }

    // Compute interpolation factor 0..1 between the two snapshots.
    const time = p.satelliteTimeRef?.current;
    const nextMap = p.satellitePositionsNextRef?.current;
    let alpha = 0;
    if (time && time.next > time.prev) {
      const span = time.next - time.prev;
      alpha = (Date.now() - time.prev) / span;
      // Clamp to [0, 1.5] — allow a small overshoot if the next tick is late
      // (predicted positions remain accurate for a brief extrapolation).
      alpha = Math.max(0, Math.min(1.5, alpha));
    }

    // Collect visible satellites with interpolated positions.
    const clipBelow = p.showGround;
    const visibleSats: Array<{ az: number; alt: number }> = [];
    for (const [key, sat] of p.satellitePositions) {
      if (!sat || sat.type) continue;
      let az = sat.azimuth;
      let alt = sat.altitude;
      if (nextMap && alpha > 0) {
        const nxt = nextMap.get(key);
        if (nxt && !nxt.type) {
          // Shortest-path azimuth interpolation (handles 360° wrap).
          let dAz = nxt.azimuth - sat.azimuth;
          if (dAz > 180) dAz -= 360;
          else if (dAz < -180) dAz += 360;
          az = ((sat.azimuth + dAz * alpha) % 360 + 360) % 360;
          alt = sat.altitude + (nxt.altitude - sat.altitude) * alpha;
        }
      }
      if (clipBelow && alt < 0) continue;
      visibleSats.push({ az, alt });
    }

    // Create satellite icon texture once (pixel-drawn satellite shape)
    if (!satTexRef.current) {
      const size = 32;
      const data = new Uint8Array(size * size * 4);

      const fillRect = (x0: number, y0: number, w: number, h: number, r: number, g: number, b: number, a = 255) => {
        for (let y = y0; y < y0 + h; y++)
          for (let x = x0; x < x0 + w; x++) {
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            const i = (y * size + x) * 4;
            data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a;
          }
      };

      // Left solar panel (green)
      fillRect(4, 12, 9, 8, 74, 222, 128, 230);
      // Right solar panel (green)
      fillRect(19, 12, 9, 8, 74, 222, 128, 230);
      // Body (white/gray center)
      fillRect(13, 11, 6, 10, 220, 220, 220, 255);
      // Antenna
      fillRect(15, 6, 2, 5, 200, 200, 200, 200);
      fillRect(15, 4, 2, 2, 255, 255, 255, 255);

      satTexRef.current = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      satTexRef.current.needsUpdate = true;
    }

    while (satMeshes.current.length < visibleSats.length) {
      const spriteMat = new THREE.SpriteMaterial({
        map: satTexRef.current,
        transparent: true,
        depthTest: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(5, 5, 1);
      sprite.renderOrder = 20;
      scene.add(sprite);
      satMeshes.current.push(sprite as any);
    }

    // Position visible satellites — offset slightly above the label
    for (let i = 0; i < satMeshes.current.length; i++) {
      const mesh = satMeshes.current[i];
      if (i < visibleSats.length) {
        const { az, alt } = visibleSats[i];
        const [x, y, z] = hz2v(az, alt + 1.5, CR - 10);
        mesh.position.set(x, y, z);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    }
  }

  function rebuildLabels(p: Props, cam: THREE.PerspectiveCamera) {
    const scene = sceneRef.current;
    if (!scene) return;

    // Hide all current label sprites (will show the ones we need)
    for (const s of labelSprites.current) s.visible = false;

    // Cache the labelable-star subset. Only named stars brighter than mag 1.5
    // ever get a label, but p.stars can hold 192k entries — scanning all of
    // them every 100ms heartbeat caused periodic frame hitches. Rebuild this
    // small list only when the underlying star array actually changes.
    if (namedStarsSrc.current !== p.stars) {
      namedStarsSrc.current = p.stars;
      namedStarsRef.current = p.stars.filter(
        (st) => st.name && st.magnitude <= 1.5 && st.id !== 'PIE-001',
      );
    }
    const namedStars = namedStarsRef.current;

    // Reusable vector for eqToWorld — avoids a per-candidate allocation.
    const eqTmp = eqWorldTmp.current;

    // Budget for new label-sprite creation this pass (spreads CPU texture
    // builds across heartbeats to avoid frame hitches while panning).
    const MAX_NEW_LABELS_PER_PASS = 2;
    let newSpritesThisPass = 0;

    // Track which cache keys are used this frame
    const usedKeys = new Set<string>();

    // Helper: equatorial RA/Dec → world position (through skyGroup rotation)
    const eqToWorld = (raHours: number, decDeg: number, radius: number): [number, number, number] => {
      const [x, y, z] = raDecDegToCart(raHours * 15, decDeg, radius);
      eqTmp.set(x, y, z);
      if (skyGroupRef.current) {
        eqTmp.applyMatrix4(skyGroupRef.current.matrixWorld);
      }
      return [eqTmp.x, eqTmp.y, eqTmp.z];
    };

    type LabelCandidate = {
      wx: number; wy: number; wz: number;
      text: string; color: string; scale: number;
      priority: number;
      /** Per-object dynamic size factor (1 = neutral). Reflects how big/close/
       *  bright the object currently appears. */
      dyn?: number;
    };
    const candidates: LabelCandidate[] = [];

    // --- Dynamic label-size helpers (object distance/size awareness) ---
    const lf = p.fovRef ? p.fovRef.current : p.fov;
    const labelMinDim = Math.min(W, H);
    const worldPerPx = pxToWorldRadius(1, lf, labelMinDim);
    // Map an object's on-screen apparent radius (px) → a label size factor.
    // Tiny points get a smaller label; large discs (zoomed-in planets, Moon)
    // get a bigger one. Bounded so labels never balloon or vanish.
    const sizeDyn = (worldRadius: number): number => {
      const px = worldRadius / Math.max(worldPerPx, 1e-6);
      return Math.max(0.8, Math.min(1.7, 0.82 + px * 0.012));
    };
    // Brighter stars get slightly larger labels.
    const magDyn = (mag: number): number => Math.max(0.78, Math.min(1.2, 1.08 - mag * 0.05));

    // Cardinals (always show — fixed in horizontal frame)
    const cardinals: Array<[string, number, string, number?]> = [
      ['N', 0, '#ff6666', 16], ['NE', 45, '#888', 8], ['E', 90, '#ccc', 14], ['SE', 135, '#888', 8],
      ['S', 180, '#ccc', 14], ['SW', 225, '#888', 8], ['W', 270, '#ccc', 14], ['NW', 315, '#888', 8],
    ];
    for (const [t, az, c, sc] of cardinals) {
      const [wx, wy, wz] = hz2v(az, 2, R);
      candidates.push({ wx, wy, wz, text: t, color: c, scale: sc ?? 10.0, priority: 0 });
    }

    if (p.showLayers.labels) {
      const clipBelow = p.showGround;  // hide labels below horizon when ground is on

      // Sun/Moon/Planets — in scene, use horizontal coords directly
      if (p.sunPosition && p.showLayers.sun
          && !(clipBelow && p.sunPosition.altitude < 0)) {
        const [wx, wy, wz] = hz2v(p.sunPosition.azimuth + 1.5, p.sunPosition.altitude + 1.2, CR);
        candidates.push({ wx, wy, wz, text: 'Sun', color: '#ffcc00', scale: 14.0, priority: 1, dyn: sizeDyn(960 * ARCSEC_TO_WORLD) });
      }
      if (p.moonPosition && p.showLayers.moon
          && !(clipBelow && p.moonPosition.altitude < 0)) {
        const [wx, wy, wz] = hz2v(p.moonPosition.azimuth + 1.5, p.moonPosition.altitude + 1.2, CR);
        candidates.push({ wx, wy, wz, text: 'Moon', color: '#e8e0c8', scale: 14.0, priority: 1, dyn: sizeDyn(1850 * ARCSEC_TO_WORLD) });
      }

      if (p.showLayers.planets) {
        const labelFov = p.fovRef ? p.fovRef.current : p.fov;
        const minDim = Math.min(W, H);

        for (const planet of p.planets) {
          const hp = p.planetPositions.get(planet.id);
          if (!hp) continue;
          if (clipBelow && hp.altitude < 0) continue;
          // Place the name just off the planet's disc edge, scaling with the
          // rendered size: a small gap beside a dot at wide FOV, hugging the
          // limb when zoomed in and the disc is large.
          const [px, py, pz] = hz2v(hp.azimuth, hp.altitude, CR);
          const rr = planetRenderedWorldRadius(PLANET_ANG_RADIUS_ARCSEC[planet.id] ?? 3.0, labelFov, minDim);
          const f = skyBasis(px, py, pz);
          const off = rr * 1.2 + pxToWorldRadius(9, labelFov, minDim);
          candidates.push({
            wx: px + (f.ex + f.nx) * off,
            wy: py + (f.ey + f.ny) * off,
            wz: pz + (f.ez + f.nz) * off,
            text: planet.name, color: '#ffdd44', scale: 12.0, priority: 2, dyn: sizeDyn(rr),
          });
        }

        // Planetary moon labels (only when zoomed in enough to see them).
        // Positioned with the SAME 3D math as the moon dots so each label
        // tracks its moon exactly, then nudged out along the sky-north axis.
        if (labelFov < 20) {
          const now = new Date();

          // Jupiter's moons
          const jupiterPos = p.planetPositions.get('jupiter');
          if (jupiterPos && !(clipBelow && jupiterPos.altitude < 0)) {
            const jupRealRadius = (PLANET_ANG_RADIUS_ARCSEC['jupiter'] ?? 20.0) * ARCSEC_TO_WORLD;
            const jupRendered = planetRenderedWorldRadius(PLANET_ANG_RADIUS_ARCSEC['jupiter'] ?? 20.0, labelFov, minDim);
            const moonScale = jupRendered / jupRealRadius;
            const moons = computeGalileanMoons(now, 5.2);
            const [jx, jy, jz] = hz2v(jupiterPos.azimuth, jupiterPos.altitude, CR);
            const f = skyBasis(jx, jy, jz);
            const gap = jupRendered * 0.15 + pxToWorldRadius(5, labelFov, minDim);
            for (const moon of moons) {
              const e = moon.dRA * ARCSEC_TO_WORLD * moonScale;
              const n = moon.dDec * ARCSEC_TO_WORLD * moonScale;
              const l = moon.dLos * ARCSEC_TO_WORLD * moonScale;
              candidates.push({
                wx: jx + f.ex * e + f.nx * n - f.ox * l + f.nx * gap,
                wy: jy + f.ey * e + f.ny * n - f.oy * l + f.ny * gap,
                wz: jz + f.ez * e + f.nz * n - f.oz * l + f.nz * gap,
                text: moon.name, color: '#bbb', scale: 3.0, priority: 4, dyn: 0.85,
              });
            }
          }

          // Titan
          if (labelFov < 12) {
            const saturnPos = p.planetPositions.get('saturn');
            if (saturnPos && !(clipBelow && saturnPos.altitude < 0)) {
              const satRealRadius = (PLANET_ANG_RADIUS_ARCSEC['saturn'] ?? 8.5) * ARCSEC_TO_WORLD;
              const satRendered = planetRenderedWorldRadius(PLANET_ANG_RADIUS_ARCSEC['saturn'] ?? 8.5, labelFov, minDim);
              const moonScale = satRendered / satRealRadius;
              const titan = computeTitan(now, 9.5);
              const [sx, sy, sz] = hz2v(saturnPos.azimuth, saturnPos.altitude, CR);
              const f = skyBasis(sx, sy, sz);
              const gap = satRendered * 0.15 + pxToWorldRadius(5, labelFov, minDim);
              const e = titan.dRA * ARCSEC_TO_WORLD * moonScale;
              const n = titan.dDec * ARCSEC_TO_WORLD * moonScale;
              const l = titan.dLos * ARCSEC_TO_WORLD * moonScale;
              candidates.push({
                wx: sx + f.ex * e + f.nx * n - f.ox * l + f.nx * gap,
                wy: sy + f.ey * e + f.ny * n - f.oy * l + f.ny * gap,
                wz: sz + f.ez * e + f.nz * n - f.oz * l + f.nz * gap,
                text: 'Titan', color: '#bbb', scale: 3.0, priority: 4, dyn: 0.85,
              });
            }
          }
        }
      }

      // Star names — use the precomputed named-star subset (not all 192k)
      for (const star of namedStars) {
        const [wx, wy, wz] = eqToWorld(star.ra, star.dec + 0.8, R);
        if (clipBelow && wy < 0) continue;
        candidates.push({ wx, wy, wz, text: star.name!, color: '#ddd', scale: 7.0, priority: 3, dyn: magDyn(star.magnitude) });
      }

      // Constellation labels — compute directly from raw data, no stale prop dependency
      if (p.showLayers.constellations) {
        for (const c of rawConstellationData as any[]) {
          if (c.centerRA === 0 && c.centerDec === 0) continue;
          const [wx, wy, wz] = eqToWorld(c.centerRA / 15, c.centerDec, R - 0.4);
          // Hide below horizon when ground is on; otherwise show all the way down.
          if (clipBelow && wy < -2) continue;
          candidates.push({ wx, wy, wz, text: c.name, color: '#5588bb', scale: 13.0, priority: 4 });
        }
      }

      // DSO labels — use equatorial coords through skyGroup
      if (p.showLayers.deepSky) {
        for (const dso of p.deepSkyPositions.values()) {
          if (!dso.isVisible) continue;
          if (clipBelow && dso.altitude < 0) continue;
          const [wx, wy, wz] = eqToWorld(dso.object.ra, dso.object.dec + 0.5, CR);
          const dsoLabel = dso.object.name
            ? `${dso.object.id} ${dso.object.name}`
            : dso.object.id;
          candidates.push({ wx, wy, wz, text: dsoLabel, color: '#0cc', scale: 6.0, priority: 5 });
        }
      }

      // Satellite labels — horizontal coords (degrees from tracker), bright green
      if (p.showLayers.satellites && p.satellitePositions) {
        let satCount = 0;
        for (const [key, sat] of p.satellitePositions) {
          if (!sat || sat.type) continue; // skip errors
          satCount++;
          if (clipBelow && sat.altitude < 0) continue;
          // Tracker returns degrees — hz2v also expects degrees
          const [wx, wy, wz] = hz2v(sat.azimuth, sat.altitude, CR);
          candidates.push({ wx, wy, wz, text: '\u2022 ' + (sat.name || key), color: '#4ade80', scale: 8.0, priority: 1 });
        }
        if (satCount === 0 && p.satellitePositions.size > 0) {
        }
      }
    }

    candidates.sort((a, b) => a.priority - b.priority);

    type Placed = { sx: number; sy: number; hw: number; hh: number };
    const placed: Placed[] = [];
    const projVec = new THREE.Vector3();

    for (const c of candidates) {
      projVec.set(c.wx, c.wy, c.wz);
      projVec.project(cam);
      if (projVec.z > 1) continue;
      const sx = (projVec.x * 0.5 + 0.5) * W;
      const sy = (-projVec.y * 0.5 + 0.5) * H;
      if (sx < -50 || sx > W + 50 || sy < -30 || sy > H + 30) continue;

      // Estimate the label's on-screen pixel half-extents for deconfliction.
      // Text height in pixels ≈ scale (worldScale) × screen-height-per-radian
      // factor. After the constant-pixel-size scaling we apply per-frame
      // (animate loop), the rendered size is roughly proportional to scale
      // and independent of FOV. The tuned coefficients below give a tight
      // bounding box that matches the actual glyph extents from glLabels.ts.
      const charHalfWidth = 3.6; // approx half-width per character at scale=6
      const lineHalf = 7.5;      // approx half-height at scale=6
      const scaleFactor = c.scale / 6;
      const hw = (c.text.length * charHalfWidth + 4) * scaleFactor;
      const hh = lineHalf * scaleFactor;
      let overlaps = false;
      for (const p2 of placed) {
        if (Math.abs(sx - p2.sx) < (hw + p2.hw) && Math.abs(sy - p2.sy) < (hh + p2.hh)) { overlaps = true; break; }
      }
      if (overlaps) continue;

      placed.push({ sx, sy, hw, hh });

      // Cache key: text + color + scale
      const cacheKey = `${c.text}_${c.color}_${c.scale}`;
      usedKeys.add(cacheKey);

      let sprite = labelCache.current.get(cacheKey);
      if (!sprite) {
        // Budget new-sprite creation per heartbeat. Each createTextSprite
        // builds a texture pixel-by-pixel on the CPU and uploads it to the GPU
        // — doing several in one frame causes the visible "frame skip" while
        // panning into a new region. Cap creations per call; uncreated labels
        // appear on the next heartbeat (~100ms later, imperceptible).
        if (newSpritesThisPass >= MAX_NEW_LABELS_PER_PASS) continue;
        newSpritesThisPass++;
        sprite = createTextSprite(c.text, c.color, c.scale);
        labelCache.current.set(cacheKey, sprite);
        scene.add(sprite);
        labelSprites.current.push(sprite);
      }

      sprite.position.set(c.wx, c.wy, c.wz);
      (sprite.userData as { dynScale?: number }).dynScale = c.dyn ?? 1;
      sprite.visible = true;
    }

    // Hide unused sprites
    for (const [key, sprite] of labelCache.current) {
      if (!usedKeys.has(key)) {
        sprite.visible = false;
      }
    }

    // Prune cache if it gets too large (>200 entries)
    if (labelCache.current.size > 200) {
      for (const [key, sprite] of labelCache.current) {
        if (!usedKeys.has(key)) {
          scene.remove(sprite);
          sprite.material.map?.dispose();
          sprite.material.dispose();
          labelCache.current.delete(key);
        }
      }
    }
  }

  function updateCelestials(p: Props, cam: THREE.PerspectiveCamera) {
    const scene = sceneRef.current;
    if (!scene) return;

    // Current Stellarium-convention FOV (min screen dimension). Read the live
    // ref so planet sizing tracks the pinch gesture smoothly mid-zoom.
    const currentFov = p.fovRef?.current ?? p.fov;
    const minScreenDim = Math.min(W, H);

    // Aim the Sun-direction light so planets are lit from the real Sun. Both
    // planets and the Sun live in scene space (positioned via hz2v), so the
    // Sun's unit direction is exactly the light direction we want.
    if (sunLightRef.current) {
      if (p.sunPosition) {
        const [sx, sy, sz] = hz2v(p.sunPosition.azimuth, p.sunPosition.altitude, 1);
        sunLightRef.current.position.set(sx, sy, sz);
      } else {
        sunLightRef.current.position.set(0, 1, 0);
      }
    }

    // Rebuild labels with deconfliction
    rebuildLabels(p, cam);

    // --- Planets: zoom-aware level of detail ---
    // To the naked eye a planet is an unresolved point of light — just a
    // bright "star". Only a telescope reveals its disc. We mirror that: the
    // sphere is scaled to the planet's REAL angular size, but never allowed
    // to shrink below a small star-like dot. At wide FOV the real disc is far
    // below that dot floor, so planets read as bright points; as you zoom in
    // the real disc eventually exceeds the floor and grows naturally, showing
    // the actual planet (and its moons spread in true proportion).
    for (const [, mesh] of planetSpheresRef.current) mesh.visible = false;
    for (const [, glow] of planetGlowsRef.current) glow.visible = false;
    if (saturnRingMeshRef.current) saturnRingMeshRef.current.visible = false;

    const arcsecToWorld = ARCSEC_TO_WORLD;
    // Star-like dot floor (wide FOV) in world units, and the shared rendered-
    // radius helper (dot floor vs magnified true size). Defined at module
    // scope so the label layout sizes/places planets and moons identically.
    const dotWorld = pxToWorldRadius(PLANET_DOT_PX, currentFov, minScreenDim);
    const planetRenderedRadius = (angRadiusArcsec: number) =>
      planetRenderedWorldRadius(angRadiusArcsec, currentFov, minScreenDim);

    if (p.showLayers.planets) {
      for (const planet of p.planets) {
        const hp = p.planetPositions.get(planet.id);
        if (!hp) continue;
        // Hide below horizon when ground is on
        if (p.showGround && hp.altitude < 0) continue;
        const [x, y, z] = hz2v(hp.azimuth, hp.altitude, CR);

        // Show textured sphere (persistent, no allocation)
        const sphere = planetSpheresRef.current.get(planet.id);
        if (sphere) {
          const angRadius = PLANET_ANG_RADIUS_ARCSEC[planet.id] ?? 3.0;
          const magnifiedReal = angRadius * arcsecToWorld * PLANET_ZOOM_MAGNIFICATION;
          const scale = Math.max(dotWorld, magnifiedReal);
          // When the planet is essentially a point (magnified disc still below
          // the dot floor) light it fully so it reads as a bright star; once it
          // resolves into a disc, let the Sun light sculpt its phase.
          const resolved = magnifiedReal >= dotWorld * 0.9;
          const mat = sphere.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = resolved ? 1.0 : 2.2;
          sphere.position.set(x, y, z);
          sphere.scale.setScalar(scale);
          sphere.rotation.y += 0.003;
          sphere.visible = true;

          // Glow: a star-like halo that dominates while the planet is a point
          // and fades out as the disc resolves on zoom-in.
          const glow = planetGlowsRef.current.get(planet.id);
          if (glow) {
            // Halo radius in world units (constant on-screen pixel size).
            const glowWorld = pxToWorldRadius(7.0, currentFov, minScreenDim);
            glow.position.set(x, y, z);
            glow.scale.setScalar(glowWorld * 2.0); // plane spans ±half = radius
            // Full glow when unresolved; fade ∝ dotWorld/magnifiedReal as the
            // real disc grows past the dot floor.
            const glowOpacity = magnifiedReal > dotWorld
              ? Math.max(0, Math.min(1, dotWorld / magnifiedReal))
              : 1.0;
            (glow.material as THREE.ShaderMaterial).uniforms.uOpacity.value = glowOpacity * 0.95;
            glow.visible = glowOpacity > 0.02;
          }

          // Position Saturn's ring (tilt is fixed at init, just place + scale)
          if (planet.id === 'saturn' && saturnRingMeshRef.current) {
            saturnRingMeshRef.current.position.set(x, y, z);
            saturnRingMeshRef.current.scale.setScalar(scale);
            saturnRingMeshRef.current.visible = true;
          }
        }
      }
    }

    // --- Planetary moons (Galilean + Titan) ---
    // Each moon is positioned in real 3D around its planet (the orbital radius
    // scales with the planet's rendered size, so a moon sits at its true number
    // of planet-radii away) and SIZED by its real moon/planet radius ratio, so
    // it keeps the correct proportion to the planet — with a small on-screen
    // floor so it stays visible as a dot until you zoom in enough to resolve it.
    for (const [, dot] of moonDotsRef.current) dot.visible = false;
    if (p.showLayers.planets) {
      const now = new Date();
      // Size a moon proportionally to its parent planet. The dominant term is
      // the true moon/planet radius ratio, so a moon is a small dot beside the
      // disc. A tiny absolute floor keeps it from vanishing, and a hard cap at
      // a small fraction of the planet's radius guarantees it can NEVER look as
      // big as the planet (which is what made them read like extra planets).
      const moonWorldRadius = (moonId: string, planetRenderedRadius: number) => {
        const parent = MOON_PARENT[moonId];
        const ratio = (BODY_RADIUS_KM[moonId] ?? 1800) / (BODY_RADIUS_KM[parent] ?? 60000);
        const proportional = planetRenderedRadius * ratio;
        const minR = pxToWorldRadius(0.8, currentFov, minScreenDim); // visibility floor
        const maxR = planetRenderedRadius * 0.08;                    // ≤ 8% of planet radius
        return Math.min(Math.max(proportional, minR), maxR);
      };

      // Jupiter's moons
      const jupiterPos = p.planetPositions.get('jupiter');
      if (jupiterPos && !(p.showGround && jupiterPos.altitude < 0)) {
        const jupDistAU = 5.2;
        const moons = computeGalileanMoons(now, jupDistAU);
        const [jx, jy, jz] = hz2v(jupiterPos.azimuth, jupiterPos.altitude, CR);
        const jupRealRadius = (PLANET_ANG_RADIUS_ARCSEC['jupiter'] ?? 20.0) * arcsecToWorld;
        const jupRendered = planetRenderedRadius(PLANET_ANG_RADIUS_ARCSEC['jupiter'] ?? 20.0);
        const moonScale = jupRendered / jupRealRadius; // orbit spread ∝ planet size
        const f = skyBasis(jx, jy, jz);

        for (const moon of moons) {
          const dot = moonDotsRef.current.get(moon.id);
          if (!dot) continue;
          // 3D offset: east/north on the sky plane, plus line-of-sight depth
          // (toward camera = -out) so moons orbit in a real ring and the
          // planet body occludes those passing behind it.
          const e = moon.dRA * arcsecToWorld * moonScale;
          const n = moon.dDec * arcsecToWorld * moonScale;
          const l = moon.dLos * arcsecToWorld * moonScale;
          dot.position.set(
            jx + f.ex * e + f.nx * n - f.ox * l,
            jy + f.ey * e + f.ny * n - f.oy * l,
            jz + f.ez * e + f.nz * n - f.oz * l,
          );
          dot.scale.setScalar(moonWorldRadius(moon.id, jupRendered));
          dot.visible = true;
        }
      }

      // Titan near Saturn
      const saturnPos = p.planetPositions.get('saturn');
      if (saturnPos && !(p.showGround && saturnPos.altitude < 0)) {
        const satDistAU = 9.5;
        const titan = computeTitan(now, satDistAU);
        const dot = moonDotsRef.current.get('titan');
        if (dot) {
          const [sx, sy, sz] = hz2v(saturnPos.azimuth, saturnPos.altitude, CR);
          const satRealRadius = (PLANET_ANG_RADIUS_ARCSEC['saturn'] ?? 8.5) * arcsecToWorld;
          const satRendered = planetRenderedRadius(PLANET_ANG_RADIUS_ARCSEC['saturn'] ?? 8.5);
          const moonScale = satRendered / satRealRadius;
          const f = skyBasis(sx, sy, sz);
          const e = titan.dRA * arcsecToWorld * moonScale;
          const n = titan.dDec * arcsecToWorld * moonScale;
          const l = titan.dLos * arcsecToWorld * moonScale;
          dot.position.set(
            sx + f.ex * e + f.nx * n - f.ox * l,
            sy + f.ey * e + f.ny * n - f.oy * l,
            sz + f.ez * e + f.nz * n - f.oz * l,
          );
          dot.scale.setScalar(moonWorldRadius('titan', satRendered));
          dot.visible = true;
        }
      }
    }

    // --- Moon (real 3D sphere, real angular size, grows on zoom) ---
    if (moonMeshRef.current && p.moonPosition && p.showLayers.moon
        && !(p.showGround && p.moonPosition.altitude < 0)) {
      const [x, y, z] = hz2v(p.moonPosition.azimuth, p.moonPosition.altitude, CR);
      const moonSph = moonMeshRef.current;
      moonSph.position.set(x, y, z);

      // Angular size: the Moon is really ≈ 0.52° across. We render it notably
      // larger than life (~1.0° across) so it reads clearly as the Moon and
      // stays well bigger than the star-like planets, while still growing into
      // a detailed body as you zoom in.
      const MOON_ANG_RADIUS_ARCSEC = 1850;
      const realRadius = MOON_ANG_RADIUS_ARCSEC * arcsecToWorld;
      const minWorld = (1.5 / minScreenDim) * (currentFov * Math.PI / 180) * CR;
      // Below-horizon fade scale (gentle shrink as it sets)
      const mScale = p.moonPosition.altitude >= 0
        ? 1.0 : Math.max(0.5, 1.0 + p.moonPosition.altitude / 40);
      moonSph.scale.setScalar(Math.max(minWorld, realRadius) * mScale);

      // Orientation (near side toward Earth) is handled by faceBillboards'
      // lookAt(camera). The phase/terminator comes from the Sun-direction
      // light, so it is always physically correct — no manual phase math.
      moonSph.visible = true;
    } else if (moonMeshRef.current) {
      moonMeshRef.current.visible = false;
    }

    // --- Sun ---
    if (sunMeshRef.current && p.sunPosition && p.showLayers.sun
        && !(p.showGround && p.sunPosition.altitude < 0)) {
      const [x, y, z] = hz2v(p.sunPosition.azimuth, p.sunPosition.altitude, CR);
      sunMeshRef.current.position.set(x, y, z);
      sunMeshRef.current.visible = true;
      const sScale = p.sunPosition.altitude >= 0 ? 1.0 : Math.max(0.5, 1.0 + p.sunPosition.altitude / 40);
      sunMeshRef.current.scale.setScalar(sScale);
    } else if (sunMeshRef.current) {
      sunMeshRef.current.visible = false;
    }

    // --- Orbital path for selected planet/moon/sun ---
    if (orbitalPathRef.current) {
      const selRef = p.selectedObjectRef?.current;
      const selName = selRef?.name ?? null;
      const selType = selRef?.type ?? null;
      const shouldShowPath = selName && (selType === 'Planet' || selType === 'Moon' || selType === 'Sun');

      if (shouldShowPath) {
        const pathLine = orbitalPathRef.current;
        const geo = pathLine.geometry as THREE.BufferGeometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;

        let currentAz = 0, currentAlt = 0;
        let found = false;

        if (selType === 'Moon' && p.moonPosition) {
          currentAz = p.moonPosition.azimuth;
          currentAlt = p.moonPosition.altitude;
          found = true;
        } else if (selType === 'Sun' && p.sunPosition) {
          currentAz = p.sunPosition.azimuth;
          currentAlt = p.sunPosition.altitude;
          found = true;
        } else if (selType === 'Planet') {
          for (const planet of p.planets) {
            if (planet.name === selName) {
              const pos = p.planetPositions.get(planet.id);
              if (pos) {
                currentAz = pos.azimuth;
                currentAlt = pos.altitude;
                found = true;
              }
              break;
            }
          }
        }

        if (found) {
          let ptCount = 0;
          for (let i = 0; i < 48; i++) {
            const hourOffset = (i - 24) * 0.5;
            const az = ((currentAz - hourOffset * 15) % 360 + 360) % 360;
            const altOffset = hourOffset * hourOffset * -0.8;
            const alt = Math.max(-10, currentAlt + altOffset);
            const [x, y, z] = hz2v(az, alt, CR - 5);
            positions[ptCount * 3] = x;
            positions[ptCount * 3 + 1] = y;
            positions[ptCount * 3 + 2] = z;
            ptCount++;
          }
          posAttr.needsUpdate = true;
          geo.setDrawRange(0, ptCount);
          pathLine.visible = true;

          const mat = pathLine.material as THREE.LineBasicMaterial;
          if (selType === 'Sun') mat.color.setHex(0xffa500);
          else if (selType === 'Moon') mat.color.setHex(0xccccff);
          else mat.color.setHex(0xffd700);
        } else {
          orbitalPathRef.current.visible = false;
        }
      } else {
        orbitalPathRef.current.visible = false;
      }
    }

    // --- Deep sky objects — reuse meshes from pool ---
    // Hide all existing DSO meshes
    for (const m of dsoMeshes.current) m.visible = false;

    if (p.showLayers.deepSky) {
      let dsoIdx = 0;
      for (const dso of p.deepSkyPositions.values()) {
        if (!dso.isVisible) continue;
        // Hide below horizon when ground is on
        if (p.showGround && dso.altitude < 0) continue;

        // Equatorial Cartesian — added to skyGroup so they rotate with the stars.
        // dso.object.ra is in HOURS, dso.object.dec in DEGREES.
        const [x, y, z] = raDecDegToCart(dso.object.ra * 15, dso.object.dec, CR);

        const rgb = DSO_COLORS[dso.object.type] ?? [0.0, 0.8, 0.8];
        const belowFade = dso.altitude >= 0 ? 1.0 : Math.max(0.15, 1.0 + dso.altitude / 25);

        // Size based on magnitude (brighter = larger) and type
        const magFactor = Math.max(0.6, 1.0 + (7.0 - dso.object.magnitude) * 0.12);
        const typeMult = DSO_SIZE_MULT[dso.object.type] ?? 1.0;
        const horizonScale = dso.altitude >= 0 ? 1.0 : Math.max(0.4, 1.0 + dso.altitude / 40);
        const size = 35 * magFactor * typeMult * horizonScale;

        const frag = DSO_SHADERS[dso.object.type] ?? DSO_GALAXY_FRAG;

        // Reuse existing mesh or create new one
        let sprite: THREE.Mesh;
        if (dsoIdx < dsoMeshes.current.length) {
          sprite = dsoMeshes.current[dsoIdx];
          // Update color uniform
          (sprite.material as THREE.ShaderMaterial).uniforms.uColor.value.set(rgb[0] * belowFade, rgb[1] * belowFade, rgb[2] * belowFade);
          // Update geometry size if needed
          const geo = sprite.geometry as THREE.PlaneGeometry;
          const params = geo.parameters;
          if (Math.abs(params.width - size) > 0.5) {
            sprite.geometry.dispose();
            sprite.geometry = new THREE.PlaneGeometry(size, size);
          }
          // Swap shader if type changed (pool reuse across types)
          const mat = sprite.material as THREE.ShaderMaterial;
          if (mat.fragmentShader !== frag) {
            mat.fragmentShader = frag;
            mat.needsUpdate = true;
          }
        } else {
          sprite = makeBillboardSprite(size, frag, {
            uColor: { value: new THREE.Vector3(rgb[0] * belowFade, rgb[1] * belowFade, rgb[2] * belowFade) },
          });
          sprite.renderOrder = 1;
          skyGroupRef.current!.add(sprite);
          dsoMeshes.current.push(sprite);
        }
        sprite.position.set(x, y, z);
        sprite.visible = true;
        dsoIdx++;
      }
    }
  }

  // Swap the ground texture when the user picks a different ground in Settings.
  useEffect(() => {
    groundSwapRef.current?.();
  }, [props.groundId]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Dispose Three.js resources to free GPU memory
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m: any) => { m.map?.dispose(); m.dispose(); });
            } else {
              obj.material.map?.dispose();
              obj.material.dispose();
            }
          }
        });
        sceneRef.current = null;
      }
      camRef.current = null;
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <GLView style={{ width: W, height: H }} onContextCreate={onGL} />
    </View>
  );
}

/**
 * SkyRenderer renders its GL scene from an internal requestAnimationFrame loop
 * that reads live data through refs (pointingRef, manualPosRef, fovRef, and the
 * celestial-data Maps, which the engine mutates in place). Because of that, the
 * component does NOT need to re-render when the camera moves or the FOV display
 * value changes — those are consumed via refs at 60fps inside the loop.
 *
 * Without memoization, AppContent re-renders on every sensor tick and drags
 * SkyRenderer (and all its closures) along with it, competing with the GL loop
 * on the single JS thread and causing periodic frame hitches.
 *
 * This comparator re-renders ONLY when a prop that changes scene SETUP changes:
 * layer toggles, data version, mode, night-vision, selected constellation, and
 * observer latitude. Everything else (azimuth/altitude/fov/lst/sunAltitude and
 * the ref-backed Maps) is intentionally ignored here and read live in the loop.
 */
function propsEqual(a: Props, b: Props): boolean {
  if (
    a.dataVersion !== b.dataVersion ||
    a.arMode !== b.arMode ||
    a.redMode !== b.redMode ||
    a.groundId !== b.groundId ||
    a.showAtmosphere !== b.showAtmosphere ||
    a.showGround !== b.showGround ||
    a.selectedConstellationId !== b.selectedConstellationId ||
    a.observerLatitude !== b.observerLatitude
  ) {
    return false;
  }
  // Layer toggles (boolean map) — re-render if any flipped.
  const al = a.showLayers, bl = b.showLayers;
  if (al !== bl) {
    for (const k in al) {
      if ((al as any)[k] !== (bl as any)[k]) return false;
    }
  }
  // All other props are read live via refs inside the render loop — ignore.
  return true;
}

const SkyRenderer = React.memo(SkyRendererImpl, propsEqual);
export default SkyRenderer;
