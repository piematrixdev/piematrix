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
import { createTextSprite } from './glLabels';
import { fovToMagnitude } from './stars';
import rawConstellationData from './data/constellations.json';

// Pre-build constellation center lookup by id (for label positioning)
const constEqLookup = new Map<string, { ra: number; dec: number }>();
for (const c of rawConstellationData as any[]) {
  constEqLookup.set(c.id, { ra: c.centerRA / 15, dec: c.centerDec });
}

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
};

// Constellation center positions — computed from actual star data in constellations.json
// Maps constellation filename key to its IAU id in the JSON
const CONST_KEY_TO_ID: Record<string, string> = {
  andromeda: 'and', antlia: 'ant', apus: 'aps', aquarius: 'aqr', aquila: 'aql',
  ara: 'ara', aries: 'ari', auriga: 'aur', bootes: 'boo', caelum: 'cae',
  camelopardalis: 'cam', cancer: 'cnc', 'canes-venatici': 'cvn', 'canis-major': 'cma',
  'canis-minor': 'cmi', capricornus: 'cap', cassiopeia: 'cas', centaurus: 'cen',
  cepheus: 'cep', cetus: 'cet', chamaeleon: 'cha', circinus: 'cir', columba: 'col',
  'coma-berenices': 'com', 'corona-australis': 'cra', 'corona-borealis': 'crb',
  corvus: 'crv', crater: 'crt', crux: 'cru', cygnus: 'cyg', delphinus: 'del',
  dorado: 'dor', draco: 'dra', equuleus: 'equ', eridanus: 'eri', fornax: 'for',
  gemini: 'gem', grus: 'gru', hercules: 'her', hydra: 'hya', lacerta: 'lac',
  'leo-minor': 'lmi', leo: 'leo', lepus: 'lep', libra: 'lib', lupus: 'lup',
  lynx: 'lyn', lyra: 'lyr', monoceros: 'mon', musca: 'mus', norma: 'nor',
  octans: 'oct', ophiuchus: 'oph', orion: 'ori', pavo: 'pav', pegasus: 'peg',
  perseus: 'per', phoenix: 'phe', pisces: 'psc', 'piscis-austrinus': 'psa',
  sagitta: 'sge', sagittarius: 'sgr', scorpius: 'sco', sculptor: 'scl',
  scutum: 'sct', taurus: 'tau', triangulum: 'tri', 'triangulum-australe': 'tra',
  tucana: 'tuc', 'ursa-major': 'uma', 'ursa-minor': 'umi', virgo: 'vir',
  volans: 'vol', vulpecula: 'vul',
};

// Constellation art positions computed from anchor stars (no longer needed as separate array)
// Positioning is now done directly from the Stellarium index anchors

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
  'Open Cluster': 0.5,
  'Globular Cluster': 0.6,
  'Planetary Nebula': 0.9,
};

interface Props {
  azimuth: number;
  altitude: number;
  fov: number;
  /** Direct sensor ref — GL loop reads this at 60fps, bypassing React */
  pointingRef?: React.MutableRefObject<{ azimuth: number; altitude: number; quaternion: [number, number, number, number]; ready: boolean }>;
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
    atmosphere: boolean; ground: boolean;
  };
  /** Local Sidereal Time in hours (0-24) */
  lst: number;
  /** Observer latitude in degrees */
  observerLatitude: number;
}

function hz2v(az: number, alt: number, r = R): [number, number, number] {
  const a = (az * Math.PI) / 180;
  const e = (alt * Math.PI) / 180;
  return [r * Math.cos(e) * Math.sin(a), r * Math.sin(e), -r * Math.cos(e) * Math.cos(a)];
}

const SPEC: Record<string, number> = {
  O: 0x9bb0ff, B: 0xaabfff, A: 0xcad7ff, F: 0xf8f7ff,
  G: 0xfff4ea, K: 0xffd2a1, M: 0xffcc6f,
};


export default function SkyRenderer(props: Props) {
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
  const saturnRingMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const dsoMeshes = useRef<THREE.Mesh[]>([]);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const labelSprites = useRef<THREE.Sprite[]>([]);
  const frameRef = useRef(0);
  const lastVer = useRef(-1);
  const lastFov = useRef(60);
  const lastStarCount = useRef(0);

  const onGL = useCallback((gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl }) as any;
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1200);
    cam.position.set(0, 0, 0);
    cam.up.set(0, 1, 0);
    camRef.current = cam;

    /**
     * Update camera projection.
     * FOV <= 120°: standard perspective (normal view).
     * FOV > 120°: cap at 120° perspective — the all-sky effect comes from
     * pointing the camera at zenith, not from extreme FOV values.
     * The wider apparent coverage is achieved by the zenith viewpoint
     * seeing the entire hemisphere naturally at 120° FOV.
     */
    function updateProjection(camera: THREE.PerspectiveCamera, fov: number) {
      // Build a stereographic projection matrix.
      // Stereographic: r = 2*tan(θ/2), where θ is the angle from center.
      // The edge of the screen corresponds to θ = fov/2.
      // So r_edge = 2*tan(fov/4).
      // We map this to clip space [-1, 1] by dividing by r_edge.
      //
      // This is equivalent to a perspective projection with an adjusted FOV:
      //   perspFov = 2 * atan(2 * tan(fov/4))
      // (from Stellarium's proj_stereographic_init)
      const fovRad = (Math.min(fov, 175) * Math.PI) / 180;
      const equivFov = 2 * Math.atan(2 * Math.tan(fovRad / 4));
      const equivFovDeg = (equivFov * 180) / Math.PI;

      camera.fov = equivFovDeg;
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
    // Stellarium-style star rendering parameters
    const STAR_LINEAR_SCALE = 8.0;  // Base size multiplier
    const STAR_RELATIVE_SCALE = 0.6; // Power law exponent (lower = more contrast)
    const CORE_SIZE = 0.5;           // Core/halo ratio (0.5 = half core, half halo)
    const MIN_RADIUS = 1.0;          // Minimum render size in pixels
    const SKIP_RADIUS = 0.3;         // Below this, don't render

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uDpr: { value: dpr },
        uMaxMag: { value: 6.0 },
        uFov: { value: 80.0 },
        uLST: { value: 0.0 },
        uLatitude: { value: 0.0 },
        uCoreSize: { value: CORE_SIZE },
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

          // Point size
          float zoomScale = 60.0 / max(uFov, 5.0);
          zoomScale = clamp(zoomScale, 0.7, 2.5);
          float ptSize = size * uDpr * zoomScale;
          gl_PointSize = max(ptSize, 1.0);
          vPtSize = ptSize;

          // Color: desaturate (real stars look mostly white with subtle tint)
          vec3 starCol = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), 0.5);
          // Luminance as alpha (faint = dim, bright = full)
          vColor = vec4(starCol, lum * twinkle);
        }
      `,
      fragmentShader: `
        uniform float uCoreSize;
        varying lowp vec4 vColor;
        varying float vPtSize;

        void main() {
          // Exact Stellarium fragment shader
          float dist = 2.0 * distance(gl_PointCoord, vec2(0.5, 0.5));

          // Center bright point
          float k = smoothstep(uCoreSize * 1.25, uCoreSize * 0.75, dist);

          // Halo
          k += smoothstep(1.0, 0.0, dist) * 0.08;

          gl_FragColor.rgb = vColor.rgb;
          gl_FragColor.a = vColor.a * clamp(k, 0.0, 1.0);

          if (gl_FragColor.a < 0.005) discard;
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

    // --- Constellation lines (glow layer + bright core) ---
    const cGeo = new THREE.BufferGeometry();

    // Custom shader material for constellation lines — clips below horizon
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
      void main() {
        if (vWorldY < -10.0) discard;
        float fade = smoothstep(-10.0, 15.0, vWorldY);
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `;

    // Glow layer
    const cGlowMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x4477cc) }, uOpacity: { value: 0.45 } },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cGlow = new THREE.LineSegments(cGeo, cGlowMat);
    cGlow.renderOrder = 0;
    skyGroup.add(cGlow);

    // Second glow layer
    const cGlow2Mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x3366bb) }, uOpacity: { value: 0.25 } },
      vertexShader: constVertShader,
      fragmentShader: constFragGlow,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cGlow2 = new THREE.LineSegments(cGeo, cGlow2Mat);
    cGlow2.renderOrder = 0;
    skyGroup.add(cGlow2);

    // Core lines — bright and solid
    const cMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x77aaee) }, uOpacity: { value: 0.95 } },
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

    // --- Constellation Art (Stellarium illustrations, anchor-based positioning) ---
    const constArtGroup = new THREE.Group();
    skyGroup.add(constArtGroup);
    const constArtGroupRef = { current: constArtGroup };
    const constArtEntries: Array<{ mesh: THREE.Mesh; ra: number; dec: number }> = [];

    const DEG2RAD_ART = Math.PI / 180;
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

    // Convert RA/Dec to 3D position on sphere
    function raDec2xyz(raDeg: number, decDeg: number, r: number): [number, number, number] {
      const ra = raDeg * DEG2RAD_ART;
      const dec = decDeg * DEG2RAD_ART;
      const cd = Math.cos(dec);
      return [r * cd * Math.cos(ra), r * Math.sin(dec), -r * cd * Math.sin(ra)];
    }

    (async () => {
      // Wait a bit for stars to load from Supabase, then enrich the lookup
      await new Promise(r => setTimeout(r, 3000));
      enrichHipLookup();

      for (const c of westernIdx.constellations) {
        if (!c.image || !c.image.anchors || c.image.anchors.length < 3) continue;
        const filename = c.image.file.replace('illustrations/', '').replace('.webp', '');
        const asset = CONST_ART_PNG[filename];
        if (!asset) continue;

        // Resolve all 3 anchor stars to RA/Dec
        const resolvedAnchors: Array<{ px: number; py: number; raDeg: number; decDeg: number }> = [];
        for (const a of c.image.anchors.slice(0, 3)) {
          const star = hipLookup.get(a.hip);
          if (!star) break;
          resolvedAnchors.push({ px: a.pos[0], py: a.pos[1], raDeg: star.ra, decDeg: star.dec });
        }
        if (resolvedAnchors.length < 3) continue;

        try {
          const texture = await loadTextureAsync({ asset });
          const imgW = c.image.size[0];
          const imgH = c.image.size[1];

          // Use 3 anchors to compute affine mapping from pixel → 3D position
          const [p0, p1, p2] = resolvedAnchors;

          // Get 3D positions of anchors (using artRadius = R - 2)
          const pos0 = raDec2xyz(p0.raDeg, p0.decDeg, artRadius);
          const pos1 = raDec2xyz(p1.raDeg, p1.decDeg, artRadius);
          const pos2 = raDec2xyz(p2.raDeg, p2.decDeg, artRadius);

          // Solve affine: x = ax*px + bx*py + cx (same for y, z)
          const det = (p0.px - p2.px) * (p1.py - p2.py) - (p1.px - p2.px) * (p0.py - p2.py);
          if (Math.abs(det) < 0.001) continue;

          const solve = (v0: number, v1: number, v2: number) => {
            const a = ((v0 - v2) * (p1.py - p2.py) - (v1 - v2) * (p0.py - p2.py)) / det;
            const b = ((v1 - v2) * (p0.px - p2.px) - (v0 - v2) * (p1.px - p2.px)) / det;
            const cc = v2 - a * p2.px - b * p2.py;
            return [a, b, cc] as const;
          };

          const [ax, bx, cx] = solve(pos0[0], pos1[0], pos2[0]);
          const [ay, by, cy] = solve(pos0[1], pos1[1], pos2[1]);
          const [az, bz, cz] = solve(pos0[2], pos1[2], pos2[2]);

          // Map image corners to 3D positions on the sphere
          const cornerPixels = [[0, 0], [imgW, 0], [imgW, imgH], [0, imgH]];
          const c3d = cornerPixels.map(([px, py]) => {
            const x = ax * px + bx * py + cx;
            const y = ay * px + by * py + cy;
            const z = az * px + bz * py + cz;
            // Normalize to sphere surface at the configured radius
            const len = Math.sqrt(x * x + y * y + z * z);
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

          // Center position for visibility culling
          const centerRA = (p0.raDeg + p1.raDeg + p2.raDeg) / 3;
          const centerDec = (p0.decDeg + p1.decDeg + p2.decDeg) / 3;
          constArtEntries.push({ mesh, ra: centerRA, dec: centerDec });
        } catch (e) { /* skip */ }
        await new Promise(r => setTimeout(r, 30));
      }
    })();

    // Per-frame: show only the constellation closest to camera center, with smooth fade
    let currentArtIdx = -1;
    let artOpacity = 0;
    const ART_FADE_IN = 0.015;  // ~1s fade in at 60fps
    const ART_FADE_OUT = 0.04;  // ~0.4s fade out
    const ART_MAX_OPACITY = 0.22;

    function updateConstArtVisibility(cam: THREE.PerspectiveCamera) {
      const showConst = propsRef.current.showLayers.constellations;
      const showingArt = constArtEntries.length > 0 && showConst;

      if (!showingArt) {
        // Fade out art
        if (currentArtIdx >= 0 && artOpacity > 0) {
          artOpacity = Math.max(0, artOpacity - ART_FADE_OUT);
          (constArtEntries[currentArtIdx].mesh.material as THREE.MeshBasicMaterial).opacity = artOpacity;
          if (artOpacity <= 0) { constArtEntries[currentArtIdx].mesh.visible = false; currentArtIdx = -1; }
        }
        // Hide lines
        if (constLinesRef.current) constLinesRef.current.visible = false;
        if (constGlowRef.current) constGlowRef.current.visible = false;
        if (constGlow2Ref.current) constGlow2Ref.current.visible = false;
        return;
      }

      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      let bestIdx = -1;
      let bestDot = -2;
      for (let i = 0; i < constArtEntries.length; i++) {
        const [cx, cy, cz] = raDec2xyz(constArtEntries[i].ra, constArtEntries[i].dec, 1);
        const worldPos = new THREE.Vector3(cx, cy, cz);
        if (skyGroupRef.current) worldPos.applyMatrix4(skyGroupRef.current.matrixWorld);
        worldPos.normalize();
        const dot = fwd.dot(worldPos);
        if (dot > bestDot) { bestDot = dot; bestIdx = i; }
      }

      const targetIdx = bestDot > 0.7 ? bestIdx : -1;
      const isShowingArt = targetIdx >= 0;

      // Show/hide constellation lines together with art
      if (constLinesRef.current) constLinesRef.current.visible = isShowingArt;
      if (constGlowRef.current) constGlowRef.current.visible = isShowingArt;
      if (constGlow2Ref.current) constGlow2Ref.current.visible = isShowingArt;

      if (targetIdx === currentArtIdx) {
        if (currentArtIdx >= 0 && artOpacity < ART_MAX_OPACITY) {
          artOpacity = Math.min(ART_MAX_OPACITY, artOpacity + ART_FADE_IN);
          (constArtEntries[currentArtIdx].mesh.material as THREE.MeshBasicMaterial).opacity = artOpacity;
        }
      } else {
        if (currentArtIdx >= 0 && artOpacity > 0) {
          artOpacity = Math.max(0, artOpacity - ART_FADE_OUT);
          (constArtEntries[currentArtIdx].mesh.material as THREE.MeshBasicMaterial).opacity = artOpacity;
          if (artOpacity <= 0) {
            constArtEntries[currentArtIdx].mesh.visible = false;
            currentArtIdx = targetIdx;
            artOpacity = 0;
            if (currentArtIdx >= 0) constArtEntries[currentArtIdx].mesh.visible = true;
          }
        } else {
          if (currentArtIdx >= 0) constArtEntries[currentArtIdx].mesh.visible = false;
          currentArtIdx = targetIdx;
          artOpacity = 0;
          if (currentArtIdx >= 0) constArtEntries[currentArtIdx].mesh.visible = true;
        }
      }
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
        const texture = await loadTextureAsync({ asset: require('../assets/ground.png') });
        groundMesh.material = new THREE.MeshBasicMaterial({
          map: texture, side: THREE.BackSide, transparent: true, depthWrite: false,
        });
        groundMesh.material.needsUpdate = true;
      } catch (e) {
        console.warn('[SkyRenderer] Ground texture failed:', e);
      }
    })();

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
          if (h > 0.05) discard; // sky portion of the sphere — don't touch

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
          float alpha = t * 0.92; // max 92% dark — never fully black

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
    const skyGeo = new THREE.SphereGeometry(R + 5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
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
          float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);

          // Night: nearly black zenith, very faint warm grey at horizon (airglow)
          vec3 nZ = vec3(0.005, 0.005, 0.008);
          vec3 nH = vec3(0.02, 0.018, 0.016);

          // Twilight: deep navy zenith, warm orange/pink horizon
          vec3 tZ = vec3(0.02, 0.02, 0.06);
          vec3 tH = vec3(0.4, 0.15, 0.06);

          // Day: blue zenith, pale blue horizon
          vec3 dZ = vec3(0.1, 0.2, 0.5);
          vec3 dH = vec3(0.5, 0.65, 0.8);

          float t = clamp((sunAlt + 18.0) / 38.0, 0.0, 1.0);
          vec3 zenith, horizon;
          if (t < 0.47) {
            float tt = t / 0.47;
            zenith = mix(nZ, tZ, tt);
            horizon = mix(nH, tH, tt);
          } else {
            float tt = (t - 0.47) / 0.53;
            zenith = mix(tZ, dZ, tt);
            horizon = mix(tH, dH, tt);
          }
          vec3 color = mix(horizon, zenith, h);
          float alpha = mix(0.15, 1.0, t);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: false, side: THREE.BackSide, depthWrite: false, depthTest: false,
      blending: THREE.NormalBlending,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.renderOrder = -10;
    scene.add(skyDome);
    skyDomeRef.current = skyDome;

    // --- Horizon ring ---
    const hGeo = new THREE.TorusGeometry(R, 0.9, 4, 128);
    const hMat = new THREE.MeshBasicMaterial({ color: 0x556677, transparent: true, opacity: 0.5 });
    const hRing = new THREE.Mesh(hGeo, hMat);
    hRing.rotation.x = Math.PI / 2;
    scene.add(hRing);

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

    // --- Moon billboard sprite ---
    const moonSprite = makeBillboardSprite(100, MOON_FRAG, {
      uPhaseAngle: { value: 180.0 },
      uIllumination: { value: 1.0 },
    });
    moonSprite.visible = false;
    moonSprite.renderOrder = 2;
    scene.add(moonSprite);
    moonMeshRef.current = moonSprite;

    // --- Planet textured spheres ---
    // Same pattern as ground texture loading (which works)
    const planetSphereMap = new Map<string, THREE.Mesh>();
    const planetIds = ['jupiter', 'saturn', 'mars', 'venus', 'mercury', 'neptune', 'uranus'];
    for (const id of planetIds) {
      const geo = new THREE.SphereGeometry(1, 32, 24);
      const mat = new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.FrontSide, depthTest: false, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 10;
      scene.add(mesh);
      planetSphereMap.set(id, mesh);
    }
    // Load textures one by one (same as ground.png pattern)
    (async () => {
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_jupiter.jpg') }); const m = planetSphereMap.get('jupiter'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_saturn.jpg') }); const m = planetSphereMap.get('saturn'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_mars.jpg') }); const m = planetSphereMap.get('mars'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_venus_surface.jpg') }); const m = planetSphereMap.get('venus'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_mercury.jpg') }); const m = planetSphereMap.get('mercury'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_neptune.jpg') }); const m = planetSphereMap.get('neptune'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
      try { const t = await loadTextureAsync({ asset: require('../assets/planets/2k_uranus.jpg') }); const m = planetSphereMap.get('uranus'); if (m) { (m.material as THREE.MeshBasicMaterial).map = t; (m.material as THREE.MeshBasicMaterial).color.set(0xffffff); (m.material as THREE.MeshBasicMaterial).needsUpdate = true; } } catch(e) {}
    })();
    // Saturn ring — make it a child of Saturn's sphere so it moves together
    const saturnRingGeo = new THREE.RingGeometry(1.3, 2.3, 64);
    // Fix UVs for ring texture
    const ringPos = saturnRingGeo.attributes.position;
    const ringUv = saturnRingGeo.attributes.uv;
    for (let i = 0; i < ringPos.count; i++) {
      const rx = ringPos.getX(i);
      const ry = ringPos.getY(i);
      const r = Math.sqrt(rx * rx + ry * ry);
      ringUv.setXY(i, (r - 1.3) / 1.0, 0.5);
    }
    const saturnRingMat = new THREE.MeshBasicMaterial({
      color: 0xccbb99,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const saturnRingMesh = new THREE.Mesh(saturnRingGeo, saturnRingMat);
    // RingGeometry is in XY plane. Rotate 90° around X to make it equatorial (XZ plane)
    saturnRingMesh.rotation.x = Math.PI / 2;
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

    // --- Render loop ---
    const startTime = Date.now();
    let lastLabelTime = 0;
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
      // At high zoom, hand tremor is amplified — apply stronger smoothing
      if (p.pointingRef && p.arMode !== false && p.pointingRef.current.ready) {
        const [qx, qy, qz, qw] = p.pointingRef.current.quaternion;
        // Smoothing factor: more smoothing at lower FOV (higher zoom)
        // FOV 60° → factor 0.3 (responsive), FOV 10° → factor 0.08 (very smooth)
        const smoothFactor = Math.max(0.06, Math.min(0.4, p.fov / 200));
        // SLERP toward target quaternion
        c.quaternion.slerp(new THREE.Quaternion(qx, qy, qz, qw), smoothFactor);
      } else {
        const [lx, ly, lz] = hz2v(p.azimuth, p.altitude, 1);
        c.up.set(0, 1, 0);
        c.lookAt(lx, ly, lz);
      }

      updateProjection(c, p.fov);

      // Rotate the sky group by LST and latitude
      // This moves all stars and constellations together (Earth's rotation)
      const lstRad = p.lst * 15 * Math.PI / 180;
      const latRad = p.observerLatitude * Math.PI / 180;
      skyGroupRef.current!.rotation.set(latRad - Math.PI / 2, -lstRad, 0, 'YXZ');

      // Visibility
      if (groundMeshRef.current) groundMeshRef.current.visible = p.showGround;
      if (groundOverlayRef.current) groundOverlayRef.current.visible = p.showGround;
      if (skyDomeRef.current) skyDomeRef.current.visible = p.showAtmosphere;
      if (constLinesRef.current) {} // Visibility controlled by updateConstArtVisibility
      if (constGlowRef.current) {}
      if (constGlow2Ref.current) {}
      if (constArtGroupRef.current) constArtGroupRef.current.visible = p.showLayers.constellations;
      // Sun/Moon visibility
      if (sunMeshRef.current) sunMeshRef.current.visible = p.showLayers.sun && !!p.sunPosition;
      if (moonMeshRef.current) moonMeshRef.current.visible = p.showLayers.moon && !!p.moonPosition;

      const fovChanged = Math.abs(p.fov - lastFov.current) > 0.5;

      // Update star shader uniforms
      const maxMag = fovToMagnitude(p.fov);
      starMat.uniforms.uMaxMag.value = maxMag;
      starMat.uniforms.uFov.value = p.fov;
      starMat.uniforms.uLST.value = p.lst * 15 * Math.PI / 180;
      starMat.uniforms.uLatitude.value = p.observerLatitude * Math.PI / 180;

      if (p.dataVersion !== lastVer.current) {
        lastVer.current = p.dataVersion;
        lastFov.current = p.fov;

        // Stars: only rebuild when new stars are loaded
        // Sky rotation is handled by skyGroup — no per-star position updates needed
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
        lastFov.current = p.fov;
        rebuildLabels(p, c);
      }

      // Update labels frequently so they track skyGroup rotation
      if (t - lastLabelTime > 0.2) {
        lastLabelTime = t;
        rebuildLabels(p, c);
      }

      // Keep billboards facing camera every frame
      faceBillboards(c);

      // Show only the constellation art closest to screen center
      updateConstArtVisibility(c);

      rendererRef.current.render(sceneRef.current, c);
      gl.endFrameEXP();
    };
    animate();
  }, []);

  /** Make all billboard sprites face the camera */
  function faceBillboards(cam: THREE.PerspectiveCamera) {
    // Sun and moon are in the scene — simple lookAt
    if (sunMeshRef.current?.visible) sunMeshRef.current.lookAt(cam.position);
    if (moonMeshRef.current?.visible) moonMeshRef.current.lookAt(cam.position);
    // DSOs are in the skyGroup — lookAt origin (camera is at origin)
    const origin = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < dsoMeshes.current.length; i++) {
      const m = dsoMeshes.current[i];
      if (m.visible) m.lookAt(origin);
    }
  }

  function rebuildStars(p: Props) {
    if (!starPtsRef.current) return;
    const pos: number[] = [];
    const col: number[] = [];
    const sizes: number[] = [];
    const seeds: number[] = [];
    const mags: number[] = [];
    const lums: number[] = [];
    const c = new THREE.Color();
    const DEG2RAD = Math.PI / 180;

    for (const star of p.stars) {
      // Store in EQUATORIAL cartesian (the skyGroup rotation handles the rest)
      const ra = star.ra * 15 * DEG2RAD; // hours → degrees → radians
      const dec = star.dec * DEG2RAD;
      const cosDec = Math.cos(dec);
      // Equatorial frame: X toward vernal equinox, Y toward north pole, Z = X×Y
      const x = R * cosDec * Math.cos(ra);
      const y = R * Math.sin(dec);
      const z = -R * cosDec * Math.sin(ra);
      pos.push(x, y, z);

      c.set(SPEC[star.spectralType] ?? 0xfff4ea);
      col.push(c.r, c.g, c.b);

      const mag = star.magnitude;
      mags.push(mag);

      const magLimit = 7.0;
      const lumRaw = Math.pow(10, -0.4 * (mag - magLimit));
      const luminance = Math.min(1.0, Math.max(0, lumRaw));
      lums.push(luminance);

      const linearScale = 2.2;
      const relativeScale = 0.5;
      let radius = linearScale * Math.pow(luminance, relativeScale / 2.0);
      if (radius < 0.5) radius = 0.5;
      sizes.push(radius);

      seeds.push(Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 45.164)) % 1.0);
    }
    const geo = starPtsRef.current.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('mag', new THREE.Float32BufferAttribute(mags, 1));
    geo.setAttribute('lum', new THREE.Float32BufferAttribute(lums, 1));
    geo.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.computeBoundingSphere();
  }

  /** Lightweight position-only update — reuses existing buffer attributes */
  /** Processes in chunks to avoid blocking the render loop */
  function updateStarPositions(p: Props) {
    if (!starPtsRef.current) return;
    const geo = starPtsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    let i = 0;
    for (const star of p.stars) {
      const hp = p.starPositions.get(star.id);
      if (!hp) continue;
      if (i + 2 >= arr.length) break;
      const a = (hp.azimuth * Math.PI) / 180;
      const e = (hp.altitude * Math.PI) / 180;
      const cosE = Math.cos(e);
      arr[i] = R * cosE * Math.sin(a);
      arr[i + 1] = R * Math.sin(e);
      arr[i + 2] = -R * cosE * Math.cos(a);
      i += 3;
    }
    posAttr.needsUpdate = true;
  }

  // Build constellation lines ONCE in equatorial coordinates (same frame as stars).
  // Since they're in the skyGroup, they rotate with the stars automatically.
  const constLinesBuilt = useRef(false);

  function rebuildLines(_p: Props) {
    if (!constLinesRef.current || constLinesBuilt.current) return;
    constLinesBuilt.current = true;

    const geo = constLinesRef.current.geometry;
    const DEG2RAD = Math.PI / 180;
    const r = R - 2; // Same radius as constellation art for alignment
    const pos: number[] = [];

    for (const c of rawConstellationData as any[]) {
      for (const line of c.lines) {
        // RA in JSON is in degrees (0-360), Dec in degrees
        const ra1 = line.star1.ra * DEG2RAD;
        const dec1 = line.star1.dec * DEG2RAD;
        const ra2 = line.star2.ra * DEG2RAD;
        const dec2 = line.star2.dec * DEG2RAD;

        // Same equatorial → Cartesian as stars use:
        // X toward vernal equinox, Y toward north pole, Z = X×Y
        const cosDec1 = Math.cos(dec1);
        pos.push(
          r * cosDec1 * Math.cos(ra1),
          r * Math.sin(dec1),
          -r * cosDec1 * Math.sin(ra1),
        );
        const cosDec2 = Math.cos(dec2);
        pos.push(
          r * cosDec2 * Math.cos(ra2),
          r * Math.sin(dec2),
          -r * cosDec2 * Math.sin(ra2),
        );
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
  }

  // Label sprite cache — reuse sprites instead of recreating every update
  const labelCache = useRef<Map<string, THREE.Sprite>>(new Map());

  function rebuildLabels(p: Props, cam: THREE.PerspectiveCamera) {
    const scene = sceneRef.current;
    if (!scene) return;

    // Hide all current label sprites (will show the ones we need)
    for (const s of labelSprites.current) s.visible = false;

    // Track which cache keys are used this frame
    const usedKeys = new Set<string>();

    // Helper: equatorial RA/Dec → world position (through skyGroup rotation)
    const DEG2RAD_L = Math.PI / 180;
    const eqToWorld = (raHours: number, decDeg: number, radius: number): [number, number, number] => {
      const ra = raHours * 15 * DEG2RAD_L;
      const dec = decDeg * DEG2RAD_L;
      const cosDec = Math.cos(dec);
      const localPos = new THREE.Vector3(
        radius * cosDec * Math.cos(ra),
        radius * Math.sin(dec),
        -radius * cosDec * Math.sin(ra),
      );
      // Transform through skyGroup's world matrix to get actual screen position
      if (skyGroupRef.current) {
        localPos.applyMatrix4(skyGroupRef.current.matrixWorld);
      }
      return [localPos.x, localPos.y, localPos.z];
    };

    type LabelCandidate = {
      wx: number; wy: number; wz: number;
      text: string; color: string; scale: number;
      priority: number;
    };
    const candidates: LabelCandidate[] = [];

    // Cardinals (always show — fixed in horizontal frame)
    const cardinals: Array<[string, number, string, number?]> = [
      ['N', 0, '#ff6666', 12.5], ['NE', 45, '#888'], ['E', 90, '#ccc', 12.5], ['SE', 135, '#888'],
      ['S', 180, '#ccc', 12.5], ['SW', 225, '#888'], ['W', 270, '#ccc', 12.5], ['NW', 315, '#888'],
    ];
    for (const [t, az, c, sc] of cardinals) {
      const [wx, wy, wz] = hz2v(az, 2, R);
      candidates.push({ wx, wy, wz, text: t, color: c, scale: sc ?? 10.0, priority: 0 });
    }

    if (p.showLayers.labels) {
      // Sun/Moon/Planets — in scene, use horizontal coords directly
      if (p.sunPosition && p.showLayers.sun) {
        const [wx, wy, wz] = hz2v(p.sunPosition.azimuth + 1.5, p.sunPosition.altitude + 1.2, CR);
        candidates.push({ wx, wy, wz, text: 'Sun', color: '#ffcc00', scale: 11.0, priority: 1 });
      }
      if (p.moonPosition && p.showLayers.moon) {
        const [wx, wy, wz] = hz2v(p.moonPosition.azimuth + 1.5, p.moonPosition.altitude + 1.2, CR);
        candidates.push({ wx, wy, wz, text: 'Moon', color: '#e8e0c8', scale: 11.0, priority: 1 });
      }

      if (p.showLayers.planets) {
        for (const planet of p.planets) {
          const hp = p.planetPositions.get(planet.id);
          if (!hp) continue;
          const [wx, wy, wz] = hz2v(hp.azimuth + 1.5, hp.altitude + 1.2, CR);
          candidates.push({ wx, wy, wz, text: planet.name, color: '#ffdd44', scale: 10.0, priority: 2 });
        }
      }

      // Star names — use equatorial coords through skyGroup
      for (const star of p.stars) {
        if (!star.name || star.magnitude > 1.5) continue;
        const [wx, wy, wz] = eqToWorld(star.ra, star.dec + 0.8, R);
        candidates.push({ wx, wy, wz, text: star.name, color: '#ddd', scale: 9.0, priority: 3 });
      }

      // Constellation labels — compute directly from raw data, no stale prop dependency
      if (p.showLayers.constellations) {
        for (const c of rawConstellationData as any[]) {
          if (c.centerRA === 0 && c.centerDec === 0) continue;
          const [wx, wy, wz] = eqToWorld(c.centerRA / 15, c.centerDec, R - 0.4);
          // Only show if above horizon (wy > ~0 in world space after skyGroup rotation)
          if (wy < -2) continue;
          candidates.push({ wx, wy, wz, text: c.name, color: '#5588bb', scale: 11.0, priority: 4 });
        }
      }

      // DSO labels — use equatorial coords through skyGroup
      if (p.showLayers.deepSky) {
        for (const dso of p.deepSkyPositions.values()) {
          if (!dso.isVisible) continue;
          const [wx, wy, wz] = eqToWorld(dso.object.ra, dso.object.dec + 0.5, CR);
          candidates.push({ wx, wy, wz, text: dso.object.id, color: '#0cc', scale: 8.0, priority: 5 });
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

      const hw = c.text.length * 5 + 4;
      const hh = 8;
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
        sprite = createTextSprite(c.text, c.color, c.scale);
        labelCache.current.set(cacheKey, sprite);
        scene.add(sprite);
        labelSprites.current.push(sprite);
      }

      sprite.position.set(c.wx, c.wy, c.wz);
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

    // Rebuild labels with deconfliction
    rebuildLabels(p, cam);

    // --- Planets as shader billboards + textured spheres ---
    // Don't remove/recreate billboard sprites every frame — just hide textured spheres
    // The textured spheres are persistent (created once), just reposition them
    for (const [, mesh] of planetSpheresRef.current) mesh.visible = false;
    if (saturnRingMeshRef.current) saturnRingMeshRef.current.visible = false;

    if (p.showLayers.planets) {
      for (const planet of p.planets) {
        const hp = p.planetPositions.get(planet.id);
        if (!hp) continue;
        const [x, y, z] = hz2v(hp.azimuth, hp.altitude, CR);

        // Show textured sphere (persistent, no allocation)
        const sphere = planetSpheresRef.current.get(planet.id);
        if (sphere) {
          const angSizes: Record<string, number> = {
            jupiter: 4.0, saturn: 3.5, mars: 2.5, venus: 3.0,
            mercury: 1.5, neptune: 1.25, uranus: 1.25,
          };
          const baseSize = angSizes[planet.id] ?? 2.0;
          const zoomScale = 60 / Math.max(p.fov, 5);
          const scale = baseSize * zoomScale;
          sphere.position.set(x, y, z);
          sphere.scale.setScalar(scale);
          sphere.rotation.y += 0.003;
          sphere.visible = true;
          // Position Saturn's ring
          if (planet.id === 'saturn' && saturnRingMeshRef.current) {
            saturnRingMeshRef.current.position.set(x, y, z);
            saturnRingMeshRef.current.scale.setScalar(scale);
            saturnRingMeshRef.current.visible = true;
            const ringTilt = 0.05;
            saturnRingMeshRef.current.rotation.set(Math.PI / 2 + ringTilt, 0, 0.4);
          }
        }
      }
    }

    // --- Moon ---
    if (moonMeshRef.current && p.moonPosition && p.showLayers.moon) {
      const [x, y, z] = hz2v(p.moonPosition.azimuth, p.moonPosition.altitude, CR);
      moonMeshRef.current.position.set(x, y, z);
      moonMeshRef.current.visible = true;

      // Compute light direction: lit side faces the sun
      const moonMat = moonMeshRef.current.material as THREE.ShaderMaterial;
      if (moonMat.uniforms.uPhaseAngle && p.sunPosition) {
        const illum = (p.moonPosition as any).illumination ?? 50;
        moonMat.uniforms.uIllumination.value = illum / 100;

        // Compute the angle from moon to sun in the sky (on the projected plane)
        // This determines which direction the lit crescent faces
        const moonAz = p.moonPosition.azimuth * Math.PI / 180;
        const moonAlt = p.moonPosition.altitude * Math.PI / 180;
        const sunAz = p.sunPosition.azimuth * Math.PI / 180;
        const sunAlt = p.sunPosition.altitude * Math.PI / 180;

        // Position angle: angle from moon to sun measured from "up" (north celestial pole direction)
        // Simplified: compute the bearing from moon to sun on the sky sphere
        const dAz = sunAz - moonAz;
        const posAngle = Math.atan2(
          Math.sin(dAz) * Math.cos(sunAlt),
          Math.cos(moonAlt) * Math.sin(sunAlt) - Math.sin(moonAlt) * Math.cos(sunAlt) * Math.cos(dAz)
        );

        // Convert to the shader's coordinate system
        // posAngle = 0 means sun is "above" moon, PI/2 = sun is to the right
        // The shader uses phaseAngle where light comes from the right at 90°
        // We pass the position angle directly and let the shader use it as rotation
        moonMat.uniforms.uPhaseAngle.value = posAngle * 180 / Math.PI;
      }

      // Fade below horizon
      const mFade = p.moonPosition.altitude >= 0 ? 1.0 : Math.max(0.2, 1.0 + p.moonPosition.altitude / 25);
      const mScale = p.moonPosition.altitude >= 0 ? 1.0 : Math.max(0.5, 1.0 + p.moonPosition.altitude / 40);
      moonMeshRef.current.scale.setScalar(mScale);
    } else if (moonMeshRef.current) {
      moonMeshRef.current.visible = false;
    }

    // --- Sun ---
    if (sunMeshRef.current && p.sunPosition && p.showLayers.sun) {
      const [x, y, z] = hz2v(p.sunPosition.azimuth, p.sunPosition.altitude, CR);
      sunMeshRef.current.position.set(x, y, z);
      sunMeshRef.current.visible = true;
      const sScale = p.sunPosition.altitude >= 0 ? 1.0 : Math.max(0.5, 1.0 + p.sunPosition.altitude / 40);
      sunMeshRef.current.scale.setScalar(sScale);
    } else if (sunMeshRef.current) {
      sunMeshRef.current.visible = false;
    }

    // --- Deep sky objects — reuse meshes from pool ---
    // Hide all existing DSO meshes
    for (const m of dsoMeshes.current) m.visible = false;

    if (p.showLayers.deepSky) {
      const DEG2RAD = Math.PI / 180;
      let dsoIdx = 0;
      for (const dso of p.deepSkyPositions.values()) {
        if (!dso.isVisible) continue;

        // Position in EQUATORIAL coordinates (same as stars) so DSOs rotate with the sky
        const raRad = dso.object.ra * 15 * DEG2RAD; // hours → degrees → radians
        const decRad = dso.object.dec * DEG2RAD;
        const cosDec = Math.cos(decRad);
        const x = CR * cosDec * Math.cos(raRad);
        const y = CR * Math.sin(decRad);
        const z = -CR * cosDec * Math.sin(raRad);

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

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <GLView style={{ width: W, height: H }} onContextCreate={onGL} />
    </View>
  );
}
