/**
 * savePhoto — write a captured GLView frame URI to the device photo library.
 *
 * Uses expo-media-library (added as a dependency). Lazy-loaded so the module
 * isn't required at app startup — if the user never saves a photo, the native
 * module is never touched.
 */

import { Alert, Linking, Platform } from 'react-native';

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'failed' | 'unavailable' };

/**
 * Save a local file URI to the user's photo library. Handles permission asks
 * and surfaces a friendly Alert if the user has previously denied access.
 */
export async function saveImageToPhotos(uri: string): Promise<SaveResult> {
  let MediaLibrary: any;
  try {
    MediaLibrary = require('expo-media-library');
  } catch {
    Alert.alert(
      'Module missing',
      "expo-media-library isn't installed. Run `npx expo install expo-media-library` and rebuild the app.",
    );
    return { ok: false, reason: 'unavailable' };
  }

  try {
    let perm = await MediaLibrary.getPermissionsAsync(true /* writeOnly */);
    if (!perm.granted && perm.canAskAgain !== false) {
      perm = await MediaLibrary.requestPermissionsAsync(true /* writeOnly */);
    }

    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Pie Matrix needs permission to save photos to your library. Open Settings to grant access.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return { ok: false, reason: 'permission' };
    }

    // saveToLibraryAsync (write-only) is the lightest path on iOS — doesn't
    // require full read access. Falls back to createAssetAsync on older SDKs.
    if (typeof MediaLibrary.saveToLibraryAsync === 'function') {
      await MediaLibrary.saveToLibraryAsync(uri);
    } else {
      await MediaLibrary.createAssetAsync(uri);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'failed' };
  }
}
