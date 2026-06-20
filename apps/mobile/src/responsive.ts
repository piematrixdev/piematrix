/**
 * Responsive layout utilities for iPad support.
 * On phones these are pass-through; on iPad they constrain content
 * to a readable width and adjust spacing/sizes.
 */
import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

/** Whether the current device has tablet-class width (≥ 700px). */
export const isTablet = SCREEN_W >= 700;

/** Max content width — content is centered within this on tablet. */
export const MAX_CONTENT_W = isTablet ? 560 : SCREEN_W;

/** Effective content width (for calculations that need it). */
export const CONTENT_W = Math.min(SCREEN_W, MAX_CONTENT_W);

/** Horizontal padding to center content on tablet. */
export const tabletPadding = isTablet ? Math.max(0, (SCREEN_W - MAX_CONTENT_W) / 2) : 0;

/** Scale a pixel value down slightly on tablet (prevents oversized elements). */
export function rs(px: number): number {
  return isTablet ? px * 0.85 : px;
}

/** Container style to center content on tablet. */
export const containerStyle = isTablet
  ? { paddingHorizontal: tabletPadding, maxWidth: SCREEN_W, alignSelf: 'center' as const, width: '100%' as const }
  : {};
