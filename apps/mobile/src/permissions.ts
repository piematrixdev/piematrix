/**
 * Centralized permission requests.
 *
 * Everything the app needs is requested once, up front, during onboarding —
 * so by the time the user reaches the sky view (motion + location), the
 * camera (avatar), or push notifications, the permissions are already granted.
 * No mid-feature prompts, no races, no "open in manual mode" fallbacks needed
 * in the common case.
 */

import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';

export interface PermissionResults {
  location: boolean;
  motion: boolean;
  notifications: boolean;
  photos: boolean;
}

/** Request location (needed for AR sky alignment + compass heading). */
export async function requestLocation(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request Motion & Fitness (needed for AR device orientation).
 *
 * On iOS the Motion & Fitness prompt only appears when motion updates actually
 * start — not on isAvailableAsync(). So we briefly start a DeviceMotion
 * listener to trigger the system prompt, then immediately stop it. This way the
 * permission is resolved during onboarding instead of when the sky view opens.
 */
export async function requestMotion(): Promise<boolean> {
  try {
    const anyDM = DeviceMotion as any;
    if (typeof anyDM.requestPermissionsAsync === 'function') {
      const { status } = await anyDM.requestPermissionsAsync();
      return status === 'granted';
    }

    const available = await DeviceMotion.isAvailableAsync().catch(() => false);
    if (!available) return false;

    // Trigger the iOS Motion & Fitness prompt by briefly starting updates.
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try { sub?.remove(); } catch {}
        resolve();
      };
      const sub = DeviceMotion.addListener(() => finish());
      DeviceMotion.setUpdateInterval(100);
      // Resolve even if no data arrives (permission denied / no sensor).
      setTimeout(finish, 1200);
    });
    return await DeviceMotion.isAvailableAsync().catch(() => false);
  } catch {
    return false;
  }
}

/** Request push notification permission. */
export async function requestNotifications(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Request photo library access (used for the profile avatar). */
export async function requestPhotos(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request every permission the app uses, sequentially so the system prompts
 * appear one after another (not stacked). Returns which were granted; callers
 * generally don't need to block on the result — the goal is just to ask early.
 */
export async function requestAllPermissions(): Promise<PermissionResults> {
  // Order matters for UX: the two the core feature needs first.
  const location = await requestLocation();
  const motion = await requestMotion();
  const notifications = await requestNotifications();
  const photos = await requestPhotos();
  return { location, motion, notifications, photos };
}
