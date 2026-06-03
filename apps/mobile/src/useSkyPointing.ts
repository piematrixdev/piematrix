/**
 * useSkyPointing — Sensor fusion for AR sky pointing.
 *
 * Uses iOS DeviceMotion (Apple's built-in gyro+accel+mag fusion) for
 * smooth rotation, with continuous magnetometer heading correction
 * to keep compass alignment accurate over time.
 *
 * Key improvements over previous version:
 * - Continuous heading correction (not one-time calibration)
 * - Low-pass filtered heading to reduce jitter
 * - Faster ref updates (every frame) for the GL renderer
 * - State updates at 60ms for UI (was 100ms)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';

export interface SkyPointing {
  azimuth: number;
  altitude: number;
  roll: number;
  quaternion: [number, number, number, number];
  ready: boolean;
  calibrated: boolean;
  /** False when motion sensors are unavailable/denied — UI should use manual mode. */
  arAvailable: boolean;
}

type Q = [number, number, number, number];

function qMul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function eulerYXZToQuat(x: number, y: number, z: number): Q {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

// Screen orientation correction: portrait mode, phone held upright
const Q_SCREEN: Q = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];

/** Normalize a quaternion. */
function qNorm(q: Q): Q {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Dot product. */
function qDot(a: Q, b: Q): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/** Spherical linear interpolation between two quaternions. */
function qSlerp(a: Q, b: Q, t: number): Q {
  let d = qDot(a, b);
  let bb = b;
  // Take the shortest path.
  if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) {
    // Nearly identical — linear interpolate + normalize (avoids div-by-zero).
    return qNorm([
      a[0] + (bb[0] - a[0]) * t,
      a[1] + (bb[1] - a[1]) * t,
      a[2] + (bb[2] - a[2]) * t,
      a[3] + (bb[3] - a[3]) * t,
    ]);
  }
  const theta0 = Math.acos(d);
  const theta = theta0 * t;
  const s0 = Math.sin(theta0 - theta) / Math.sin(theta0);
  const s1 = Math.sin(theta) / Math.sin(theta0);
  return [
    a[0] * s0 + bb[0] * s1,
    a[1] * s0 + bb[1] * s1,
    a[2] * s0 + bb[2] * s1,
    a[3] * s0 + bb[3] * s1,
  ];
}

/** Angle (radians) between two quaternions. */
function qAngle(a: Q, b: Q): number {
  const d = Math.min(1, Math.abs(qDot(a, b)));
  return 2 * Math.acos(d);
}

/**
 * One-Euro filter for orientation quaternions.
 *
 * The classic jitter-vs-lag tradeoff, solved adaptively: at low speed the
 * cutoff frequency drops so the signal is smoothed hard (kills sensor noise
 * that you see as jitter while holding still); at high speed the cutoff rises
 * so almost no smoothing is applied (no lag while panning). It only ever
 * interpolates toward real samples — never extrapolates — so it cannot
 * overshoot or amplify noise the way prediction does.
 *
 * Reference: Casiez, Roussel, Vogel — "1€ Filter" (CHI 2012).
 */
class OneEuroQuat {
  private hatPrev: Q | null = null;   // last filtered orientation
  private dxPrev = 0;                 // last filtered angular speed (rad/s)
  private hasV = false;

  /** Minimum cutoff (Hz). Lower = more smoothing when still. */
  private minCutoff: number;
  /** Speed coefficient. Higher = opens up faster when moving (less lag). */
  private beta: number;
  /** Cutoff for the speed estimate itself (Hz). */
  private dCutoff: number;

  constructor(minCutoff = 1.2, beta = 0.18, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset() {
    this.hatPrev = null;
    this.dxPrev = 0;
    this.hasV = false;
  }

  filter(raw: Q, dt: number): Q {
    const q = qNorm(raw);
    if (this.hatPrev === null || dt <= 0) {
      this.hatPrev = q;
      return q;
    }

    // Angular speed since last filtered sample (rad/s).
    const speed = qAngle(this.hatPrev, q) / dt;

    // Low-pass the speed estimate.
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = this.hasV ? aD * speed + (1 - aD) * this.dxPrev : speed;
    this.dxPrev = dxHat;
    this.hasV = true;

    // Adaptive cutoff: rises with speed → less smoothing while moving.
    const cutoff = this.minCutoff + this.beta * dxHat;
    const a = this.alpha(cutoff, dt);

    // Smooth toward the raw sample by SLERP (a = blend amount).
    const hat = qSlerp(this.hatPrev, q, a);
    this.hatPrev = hat;
    return hat;
  }
}

/** Extract azimuth from camera quaternion */
function azimuthFromQuat(q: Q): number {
  const [qx, qy, qz, qw] = q;
  const fx = -2 * (qw * qy + qx * qz);
  const fz = -1 + 2 * (qx * qx + qy * qy);
  let az = Math.atan2(fx, -fz) * (180 / Math.PI);
  return ((az % 360) + 360) % 360;
}

/** Circular difference (handles 0/360 wrap) */
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/** Low-pass filter for angles (handles wrap-around) */
function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = angleDiff(target, current);
  let result = current + diff * alpha;
  return ((result % 360) + 360) % 360;
}

export function useSkyPointing(): {
  pointing: SkyPointing;
  pointingRef: React.MutableRefObject<SkyPointing>;
  recalibrate: () => void;
} {
  const zero: SkyPointing = {
    azimuth: 180, altitude: 45, roll: 0,
    quaternion: [0, 0, 0, 1], ready: false, calibrated: false, arAvailable: true,
  };
  const [pointing, setPointing] = useState<SkyPointing>(zero);
  const pointingRef = useRef<SkyPointing>(zero);

  // Continuous heading correction state
  const yawOffset = useRef(0);
  const calibrated = useRef(false);
  const rawAzRef = useRef(0);
  const lastHeading = useRef(0);
  const headingConfidence = useRef(0); // 0..1, builds up over time

  // One-Euro orientation filter — adaptively smooths sensor jitter without lag.
  const orientFilter = useRef(new OneEuroQuat());
  const lastSampleT = useRef(0);

  // Calibration watchdog state — guarantees the view never gets stuck on the
  // CalibrateScreen if the magnetometer/heading is unavailable.
  const headingActive = useRef(false);   // true once heading callbacks arrive
  const calibStartMs = useRef(Date.now());

  // Force-complete calibration in gyro-only mode (compass not aligned, but the
  // user can pan freely instead of being stuck). Harmless no-op if already
  // calibrated by the magnetometer.
  const forceCalibrateGyroOnly = useCallback(() => {
    if (calibrated.current) return;
    calibrated.current = true;
    pointingRef.current = { ...pointingRef.current, calibrated: true };
    setPointing(p => ({ ...p, calibrated: true }));
  }, []);

  const recalibrate = useCallback(() => {
    calibrated.current = false;
    yawOffset.current = 0;
    headingConfidence.current = 0;
    orientFilter.current.reset();
    lastSampleT.current = 0;
    calibStartMs.current = Date.now();
    pointingRef.current = { ...pointingRef.current, calibrated: false };
    setPointing(p => ({ ...p, calibrated: false }));
    // Watchdog: if the magnetometer hasn't completed calibration within 4s
    // (e.g. heading unavailable / permission race), fall back to gyro-only so
    // the user is never stuck on the calibration screen.
    setTimeout(() => forceCalibrateGyroOnly(), 4000);
  }, [forceCalibrateGyroOnly]);

  useEffect(() => {
    const subs: Array<{ remove: () => void }> = [];
    let headingSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      // Mark AR unavailable + open in manual mode. Used when motion sensors are
      // missing or denied (Motion & Fitness permission), so the view still
      // opens instead of hanging on "Waiting for sensors…".
      const fallbackToManual = () => {
        if (pointingRef.current.ready) return;
        pointingRef.current = {
          ...pointingRef.current,
          ready: true,
          calibrated: true,
          arAvailable: false,
        };
        setPointing({ ...pointingRef.current });
      };

      const dmAvail = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!dmAvail) {
        // No motion sensors at all (or unavailable) — open in manual mode.
        console.warn('[SkyPointing] DeviceMotion unavailable — manual mode');
        fallbackToManual();
        return;
      }

      // Safety watchdog: even when DeviceMotion reports "available", iOS may
      // withhold rotation data if Motion & Fitness permission is denied, so no
      // listener callback ever fires. If we get no sample within 3.5s, open in
      // manual mode rather than hang forever.
      const motionWatchdog = setTimeout(() => {
        if (!cancelled) fallbackToManual();
      }, 3500);
      subs.push({ remove: () => clearTimeout(motionWatchdog) });

      // ─── Continuous heading from magnetometer ───────────────────────
      // watchHeadingAsync requires location permission. On first launch that
      // permission is still being requested elsewhere, so the first attempt
      // can fail ("Heading unavailable"). Wait for permission, then retry a
      // few times before giving up to gyro-only mode.
      const startHeading = async (): Promise<boolean> => {
        try {
          headingSub = await Location.watchHeadingAsync((h) => {
            const magHeading = h.magHeading;
            if (magHeading < 0) return;

            headingActive.current = true;
            lastHeading.current = magHeading;

            // Compute offset between gyro azimuth and mag heading
            const gyroAz = rawAzRef.current;
            const offset = angleDiff(gyroAz, magHeading) * (Math.PI / 180);

            if (!calibrated.current) {
              // Initial calibration: snap immediately after a few consistent readings
              headingConfidence.current += 0.2;
              if (headingConfidence.current >= 1.0) {
                yawOffset.current = offset;
                calibrated.current = true;
                pointingRef.current = { ...pointingRef.current, calibrated: true };
                setPointing(p => ({ ...p, calibrated: true }));
              } else {
                // Accumulate with exponential moving average
                yawOffset.current = yawOffset.current * 0.5 + offset * 0.5;
              }
            } else {
              // Continuous correction: only correct when the magnetometer disagrees
              // significantly (> 5°). Small fluctuations are noise — ignore them.
              // When correcting, use a very slow alpha to prevent visible jumps.
              const diffDeg = Math.abs(angleDiff(gyroAz, magHeading));
              if (diffDeg > 5) {
                // Slow correction: takes ~100+ readings (~10+ seconds) to fully align.
                // This prevents the jittery "fighting" feel while still correcting drift.
                const alpha = 0.005;
                yawOffset.current = yawOffset.current * (1 - alpha) + offset * alpha;
              }
            }
          });
          return true;
        } catch (e) {
          return false;
        }
      };

      // Make sure location permission is granted before subscribing to heading.
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {}

      // Retry a few times — permission may land just after we start.
      let ok = false;
      for (let attempt = 0; attempt < 5 && !cancelled && !ok; attempt++) {
        ok = await startHeading();
        if (!ok) await new Promise((r) => setTimeout(r, 600));
      }
      if (!ok && !cancelled) {
        console.warn('[SkyPointing] Heading unavailable — using gyro-only mode');
        // Without a compass, complete calibration so the view opens anyway.
        forceCalibrateGyroOnly();
      }

      // ─── DeviceMotion at max rate ──────────────────────────────────
      DeviceMotion.setUpdateInterval(16); // ~60fps

      const sub = DeviceMotion.addListener((data) => {
        if (!data.rotation) return;
        const { alpha, beta, gamma } = data.rotation;

        // Build camera quaternion from DeviceMotion euler angles
        const deviceQ = eulerYXZToQuat(beta, alpha, -gamma);
        let camQ = qMul(deviceQ, Q_SCREEN);

        // Store raw azimuth (before compass correction) for offset calculation
        rawAzRef.current = azimuthFromQuat(camQ);

        // Apply compass correction quaternion
        if (calibrated.current || headingConfidence.current > 0.3) {
          const ha = yawOffset.current / 2;
          const yawQ: Q = [0, Math.sin(ha), 0, Math.cos(ha)];
          camQ = qMul(yawQ, camQ);
        }

        // One-Euro filter — adaptively smooth out sensor jitter. Hard smoothing
        // when slow/still (kills the visible wobble), opens up when panning fast
        // (no added lag). Never extrapolates, so it can't overshoot.
        const now = Date.now() * 0.001;
        const dt = lastSampleT.current > 0 ? now - lastSampleT.current : 1 / 60;
        lastSampleT.current = now;
        camQ = orientFilter.current.filter(camQ, dt);

        // Extract azimuth and altitude
        const az = azimuthFromQuat(camQ);
        const [qx, qy, qz, qw] = camQ;
        const fy = 2 * (qw * qx - qy * qz);
        const alt = Math.asin(Math.max(-1, Math.min(1, fy))) * (180 / Math.PI);

        // Update ref immediately (GL renderer reads this at 60fps)
        pointingRef.current = {
          azimuth: az,
          altitude: Math.max(-90, Math.min(90, alt)),
          roll: 0,
          quaternion: camQ,
          ready: true,
          calibrated: calibrated.current,
          arAvailable: true,
        };
      });
      subs.push(sub);

      // Update React state for UI elements (compass pill). This is decoupled
      // from rendering — the GL loop reads pointingRef directly at 60fps. A
      // degree readout only needs a few updates per second, and a slower rate
      // Re-render AppContent ONLY when a gate field changes (ready / calibrated
      // / arAvailable) — not on every az/alt tick. The live azimuth/altitude
      // readout is rendered by an isolated component (CompassReadout) that reads
      // pointingRef directly, so the heavy AppContent tree never re-renders just
      // to repaint a degree value. This is what removes the periodic re-render.
      let lastReady = false, lastCalib = false, lastAr = true;
      const tid = setInterval(() => {
        const pr = pointingRef.current;
        if (!pr.ready) return;
        if (pr.ready !== lastReady || pr.calibrated !== lastCalib || pr.arAvailable !== lastAr) {
          lastReady = pr.ready; lastCalib = pr.calibrated; lastAr = pr.arAvailable;
          setPointing({ ...pr });
        }
      }, 150);
      subs.push({ remove: () => clearInterval(tid) });
    })();

    return () => {
      cancelled = true;
      subs.forEach(s => s.remove());
      headingSub?.remove();
    };
  }, []);

  return { pointing, pointingRef, recalibrate };
}
