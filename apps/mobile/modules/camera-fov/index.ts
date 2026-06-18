import { Dimensions } from 'react-native';

/**
 * Native bridge to the rear camera's real field of view.
 *
 * RN camera libraries (expo-camera, vision-camera) don't expose lens FOV in JS,
 * so this small local Expo module reads `AVCaptureDevice.activeFormat
 * .videoFieldOfView` natively. The native value is the HORIZONTAL FOV across the
 * sensor's long edge (landscape). We convert it to the on-screen FOV across the
 * screen's MIN dimension (width in portrait) for the renderer, accounting for
 * the full-screen (aspectFill) crop that shows the full long edge and crops the
 * short edge.
 *
 * Everything here is fully lazy and defensive: the native module is resolved on
 * first use inside a try/catch (never at import time) so that a missing module
 * — e.g. in Expo Go, before a native rebuild, or a version mismatch — can never
 * crash app startup. Callers get `null` and fall back to a calibrated default.
 */

type CameraFovNativeModule = { getCameraFov(): number | null };

let resolved = false;
let nativeModule: CameraFovNativeModule | null = null;

function getNativeModule(): CameraFovNativeModule | null {
  if (resolved) return nativeModule;
  resolved = true;
  try {
    // Required lazily so a missing/old expo-modules-core can't throw at import.
    const { requireOptionalNativeModule } = require('expo') as {
      requireOptionalNativeModule?: <T>(name: string) => T | null;
    };
    if (typeof requireOptionalNativeModule === 'function') {
      nativeModule = requireOptionalNativeModule<CameraFovNativeModule>('CameraFov');
    }
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

/** Raw rear-camera horizontal (long-edge) FOV in degrees, or null. */
export function getRawCameraFovDeg(): number | null {
  const mod = getNativeModule();
  if (!mod || typeof mod.getCameraFov !== 'function') return null;
  try {
    const v = mod.getCameraFov();
    return typeof v === 'number' && v > 0 && v < 180 ? v : null;
  } catch {
    return null;
  }
}

/**
 * On-screen FOV across the screen's MIN dimension (width in portrait), derived
 * from the native long-edge FOV and the current screen aspect. This is the
 * value the renderer expects in camera (AR passthrough) mode. Returns null if
 * the native FOV is unavailable (Expo Go / before a native rebuild) so callers
 * can fall back to the calibrated default.
 */
export function getCameraMinDimFovDeg(): number | null {
  const longEdge = getRawCameraFovDeg();
  if (longEdge == null) return null;
  try {
    const { width, height } = Dimensions.get('window');
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    if (!(minDim > 0) || !(maxDim > 0)) return null;
    // Full-screen aspectFill shows the full long edge (→ the screen's long axis)
    // and crops the short edge. Rectilinear (gnomonic) lens, so:
    //   tan(halfMinFov) = tan(halfLongFov) * (minDim / maxDim)
    const halfLong = (longEdge * Math.PI) / 180 / 2;
    const halfMin = Math.atan(Math.tan(halfLong) * (minDim / maxDim));
    return (2 * halfMin * 180) / Math.PI;
  } catch {
    return null;
  }
}
