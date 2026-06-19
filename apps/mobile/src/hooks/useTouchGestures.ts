/**
 * useTouchGestures — handles pinch-to-zoom, pan (manual mode), and tap detection.
 * Uses refs for FOV to avoid stale closures and enable smooth 60fps updates.
 */
import { useCallback, useRef, MutableRefObject } from 'react';
import { Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface UseTouchGesturesOptions {
  arMode: boolean;
  fovRef: MutableRefObject<number>;
  onFovChange: (fov: number) => void;
  onPan: (dAz: number, dAlt: number) => void;
  onTap: (x: number, y: number) => void;
  onZoomEnd: () => void;
  /** When true, pinch-zoom fine-tunes the AR camera overlay FOV (cameraFovRef)
   *  instead of the normal zoom FOV, so the overlay can be locked to the live
   *  camera. Leaves fovRef untouched. */
  cameraMode?: boolean;
  cameraFovRef?: MutableRefObject<number>;
  onCameraFovChange?: (fov: number) => void;
}

export function useTouchGestures({ arMode, fovRef, onFovChange, onPan, onTap, onZoomEnd, cameraMode, cameraFovRef, onCameraFovChange }: UseTouchGesturesOptions) {
  const lastPinchDist = useRef<number | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number; time: number } | null>(null);
  // Store callbacks in refs so useCallback doesn't need them as deps
  const onFovChangeRef = useRef(onFovChange);
  const onPanRef = useRef(onPan);
  const onTapRef = useRef(onTap);
  const onZoomEndRef = useRef(onZoomEnd);
  const arModeRef = useRef(arMode);
  const cameraModeRef = useRef(cameraMode);
  const onCameraFovChangeRef = useRef(onCameraFovChange);
  onFovChangeRef.current = onFovChange;
  onPanRef.current = onPan;
  onTapRef.current = onTap;
  onZoomEndRef.current = onZoomEnd;
  arModeRef.current = arMode;
  cameraModeRef.current = cameraMode;
  onCameraFovChangeRef.current = onCameraFovChange;

  const handleTouchStart = useCallback((e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches?.length === 1) {
      tapStart.current = { x: touches[0].pageX, y: touches[0].pageY, time: Date.now() };
    } else {
      tapStart.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    const touches = e.nativeEvent.touches;
    if (!touches) return;

    // Pinch-to-zoom
    if (touches.length === 2) {
      lastTouchPos.current = null;
      const t1 = touches[0];
      const t2 = touches[1];
      const dx = t2.pageX - t1.pageX;
      const dy = t2.pageY - t1.pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const scale = lastPinchDist.current / dist;
        // In camera (AR overlay) mode, pinch calibrates the overlay FOV so the
        // stars can be locked to the live camera, instead of changing the zoom.
        if (cameraModeRef.current && cameraFovRef) {
          const next = Math.max(12, Math.min(110, cameraFovRef.current * scale));
          const rounded = Math.round(next * 10) / 10;
          cameraFovRef.current = rounded;
          onCameraFovChangeRef.current?.(rounded);
        } else {
          const currentFov = fovRef.current;
          const newFov = Math.max(0.25, Math.min(180, currentFov * scale));
          const rounded = Math.round(newFov * 10) / 10;
          fovRef.current = rounded;
          onFovChangeRef.current(rounded);
        }
      }
      lastPinchDist.current = dist;
      return;
    }

    // Single finger pan (manual mode only)
    if (touches.length === 1 && !arModeRef.current) {
      lastPinchDist.current = null;
      const t = touches[0];
      const curr = { x: t.pageX, y: t.pageY };
      if (lastTouchPos.current) {
        const dx = curr.x - lastTouchPos.current.x;
        const dy = curr.y - lastTouchPos.current.y;
        const sensitivity = fovRef.current / Math.min(W, H);
        onPanRef.current(-dx * sensitivity, dy * sensitivity);
      }
      lastTouchPos.current = curr;
    }
  }, [fovRef]);

  const handleTouchEnd = useCallback((e: any) => {
    lastPinchDist.current = null;
    lastTouchPos.current = null;

    // Detect tap
    if (tapStart.current) {
      const dt = Date.now() - tapStart.current.time;
      const touch = e.nativeEvent.changedTouches?.[0];
      if (touch && dt < 300) {
        const dx = touch.pageX - tapStart.current.x;
        const dy = touch.pageY - tapStart.current.y;
        if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
          onTapRef.current(touch.pageX, touch.pageY);
        }
      }
      tapStart.current = null;
    }

    onZoomEndRef.current();
  }, []);

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}
