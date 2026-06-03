/**
 * Milky Way panorama overlay.
 * 
 * The ESO eso0932a image is equirectangular (2:1):
 *   - Horizontal: 360° of galactic longitude (center = galactic center)
 *   - Vertical: ±90° galactic latitude (center = galactic plane = the band)
 * 
 * We render it as a large image behind the Skia canvas, positioned so that
 * the correct portion is visible based on the current view direction.
 */

import React, { useMemo } from 'react';
import { Image, StyleSheet, Dimensions, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  azimuth: number;   // 0-360°
  altitude: number;  // -90 to +90°
  fov: number;       // field of view in degrees
  opacity: number;   // 0-1
}

export default function MilkyWayOverlay({ azimuth, altitude, fov, opacity }: Props) {
  const style = useMemo(() => {
    // The image covers 360° horizontally and 180° vertically.
    // We need to scale it so that `fov` degrees of the image fills the screen width.
    const degreesPerPixel = fov / W;
    const imgW = 360 / degreesPerPixel;  // image width in pixels to cover 360°
    const imgH = imgW / 2;               // maintain 2:1 aspect ratio

    // Horizontal position: azimuth maps to image X
    // azimuth=0 should show the left edge of the image (or wherever galactic coords align)
    // We center the current azimuth on screen
    const xCenter = (azimuth / 360) * imgW;
    const left = W / 2 - xCenter;

    // Vertical position: altitude maps to image Y
    // altitude=+90 (zenith) = top of image (y=0)
    // altitude=0 (horizon) = middle of image (y=imgH/2)
    // altitude=-90 (nadir) = bottom of image (y=imgH)
    const yCenter = ((90 - altitude) / 180) * imgH;
    const top = H / 2 - yCenter;

    return {
      position: 'absolute' as const,
      width: imgW,
      height: imgH,
      left,
      top,
      opacity,
    };
  }, [azimuth, altitude, fov, opacity]);

  if (opacity <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={require('../assets/milkyway.jpg')}
        style={style}
        resizeMode="stretch"
      />
    </View>
  );
}
