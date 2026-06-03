/**
 * Ground texture catalog.
 *
 * Each ground is an equirectangular PNG with a transparent sky and opaque
 * landscape, mapped onto the lower hemisphere in SkyRenderer. Users pick one
 * from Settings; the choice is passed to the renderer as a `groundId`.
 */

export interface GroundOption {
  id: string;
  name: string;
  asset: any;
}

export const GROUNDS: GroundOption[] = [
  { id: 'default', name: 'Classic', asset: require('../assets/grounds/default.png') },
  { id: 'horn-koppe_spring', name: 'Spring Meadow', asset: require('../assets/grounds/horn-koppe_spring.png') },
  { id: 'klippad_dawn', name: 'Dawn Cliffs', asset: require('../assets/grounds/klippad_dawn_2.png') },
  { id: 'qwantani_noon', name: 'Savanna Noon', asset: require('../assets/grounds/qwantani_noon.png') },
  { id: 'stierberg_sunrise', name: 'Mountain Sunrise', asset: require('../assets/grounds/stierberg_sunrise.png') },
];

export const DEFAULT_GROUND_ID = 'default';

export function getGroundAsset(id: string): any {
  return (GROUNDS.find((g) => g.id === id) ?? GROUNDS[0]).asset;
}
