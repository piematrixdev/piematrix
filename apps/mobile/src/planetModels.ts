/**
 * Planet 3D Models — textured spheres that appear when zoomed in.
 * At wide FOV: planets are shader dots (fast).
 * At narrow FOV (< 15°): planets render as textured spheres with proper rotation.
 */

import * as THREE from 'three';
import { loadTextureAsync } from 'expo-three';
import { Asset } from 'expo-asset';

// Planet texture assets — require() must be static
const PLANET_TEXTURES: Record<string, number> = {
  mercury: require('../assets/planets/2k_mercury.jpg'),
  venus: require('../assets/planets/2k_venus_surface.jpg'),
  mars: require('../assets/planets/2k_mars.jpg'),
  jupiter: require('../assets/planets/2k_jupiter.jpg'),
  saturn: require('../assets/planets/2k_saturn.jpg'),
  uranus: require('../assets/planets/2k_uranus.jpg'),
  neptune: require('../assets/planets/2k_neptune.jpg'),
};

const SATURN_RING_TEXTURE: number = require('../assets/planets/2k_saturn_ring_alpha.png');

// Angular diameters in arcseconds (approximate max values)
const PLANET_ANGULAR_SIZES: Record<string, number> = {
  mercury: 13,
  venus: 66,
  mars: 25,
  jupiter: 50,
  saturn: 42, // disc only, rings extend further
  uranus: 4,
  neptune: 2.4,
};

// Axial tilts in degrees (for realistic orientation)
const PLANET_TILTS: Record<string, number> = {
  mercury: 0.03,
  venus: 177.4,
  mars: 25.2,
  jupiter: 3.1,
  saturn: 26.7,
  uranus: 97.8,
  neptune: 28.3,
};

interface PlanetModel {
  mesh: THREE.Mesh;
  ring?: THREE.Mesh; // Saturn's ring
  id: string;
}

let loadedTextures: Map<string, THREE.Texture> = new Map();
let models: Map<string, PlanetModel> = new Map();
let saturnRingTexture: THREE.Texture | null = null;

/**
 * Load all planet textures asynchronously.
 * Call once during scene setup.
 */
export async function loadPlanetTextures(): Promise<void> {
  const promises = Object.entries(PLANET_TEXTURES).map(async ([id, asset]) => {
    try {
      // Use Asset to ensure the file is downloaded/cached
      const assetModule = Asset.fromModule(asset);
      await assetModule.downloadAsync();

      const tex = await loadTextureAsync({ asset });
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      loadedTextures.set(id, tex);
    } catch (e) {
      console.warn(`[Planets] Failed to load texture for ${id}:`, e);
    }
  });

  // Load Saturn ring
  try {
    const ringAsset = Asset.fromModule(SATURN_RING_TEXTURE);
    await ringAsset.downloadAsync();
    saturnRingTexture = await loadTextureAsync({ asset: SATURN_RING_TEXTURE });
    if (saturnRingTexture) {
      saturnRingTexture.minFilter = THREE.LinearFilter;
      saturnRingTexture.needsUpdate = true;
    }
  } catch (e) {
    console.warn('[Planets] Failed to load Saturn ring texture:', e);
  }

  await Promise.all(promises);
}

/**
 * Create a textured sphere mesh for a planet.
 */
export function createPlanetMesh(id: string): PlanetModel | null {
  const texture = loadedTextures.get(id);

  // Create sphere with or without texture
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const mat = new THREE.MeshBasicMaterial({
    map: texture ?? null,
    color: texture ? 0xffffff : 0x888888, // grey fallback if no texture
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Apply axial tilt
  const tilt = (PLANET_TILTS[id] ?? 0) * Math.PI / 180;
  mesh.rotation.x = tilt;

  mesh.visible = false;
  mesh.renderOrder = 3;

  const model: PlanetModel = { mesh, id };

  // Saturn's ring
  if (id === 'saturn' && saturnRingTexture) {
    const ringGeo = new THREE.RingGeometry(1.2, 2.2, 64);
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      uv.setXY(i, (r - 1.2) / 1.0, 0.5);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      map: saturnRingTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2 + tilt;
    ringMesh.visible = false;
    ringMesh.renderOrder = 3;
    model.ring = ringMesh;
  }

  models.set(id, model);
  return model;
}

/**
 * Get or create a planet model.
 */
export function getPlanetModel(id: string): PlanetModel | null {
  if (models.has(id)) return models.get(id)!;
  return createPlanetMesh(id);
}

/**
 * Compute the screen size of a planet given the FOV.
 * Returns the radius in "sky sphere units" that the planet should appear.
 */
export function getPlanetVisualRadius(id: string, fov: number): number {
  const angularSize = PLANET_ANGULAR_SIZES[id] ?? 10; // arcseconds
  // Convert arcseconds to degrees
  const angDeg = angularSize / 3600;
  // At the sky sphere radius of 100, what size corresponds to this angle?
  // The planet subtends angDeg degrees. At FOV degrees across the screen,
  // the fraction of screen = angDeg / fov.
  // In sky sphere units (radius 100): size = 100 * tan(angDeg/2) * 2
  // But we want it to look good, so scale up a bit for visibility
  const sizeOnSphere = 100 * Math.tan(angDeg * Math.PI / 180 / 2) * 2;
  // Minimum visible size
  return Math.max(sizeOnSphere, 0.3);
}

/**
 * Should we show the textured model for this planet at this FOV?
 */
export function shouldShowModel(id: string, fov: number): boolean {
  // Show textured model when zoomed in past 30° FOV
  return fov < 30;
}

/**
 * Update planet rotation (slow spin for realism).
 */
export function rotatePlanet(model: PlanetModel, dt: number): void {
  // Slow rotation — different speeds per planet
  const speeds: Record<string, number> = {
    mercury: 0.002, venus: -0.001, mars: 0.01,
    jupiter: 0.02, saturn: 0.015, uranus: 0.01, neptune: 0.008,
  };
  const speed = speeds[model.id] ?? 0.01;
  model.mesh.rotation.y += speed * dt;
  if (model.ring) {
    model.ring.rotation.z += speed * dt * 0.1;
  }
}
