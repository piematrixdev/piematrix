/**
 * useSkyPointing — uses iOS DeviceMotion (Apple's built-in sensor fusion)
 * with magnetometer-referenced heading for absolute north.
 *
 * Apple's CoreMotion already fuses gyro + accel + magnetometer internally.
 * We just need to convert their quaternion to our sky coordinate system.
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

/** Extract azimuth from camera quaternion */
function azimuthFromQuat(q: Q): number {
  const [qx, qy, qz, qw] = q;
  const fx = -2 * (qw * qy + qx * qz);
  const fz = -1 + 2 * (qx * qx + qy * qy);
  let az = Math.atan2(fx, -fz) * (180 / Math.PI);
  return ((az % 360) + 360) % 360;
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

  const yawOffset = useRef(0);
  const calibrated = useRef(false);
  const rawAzRef = useRef(0);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);

  const recalibrate = useCallback(() => {
    // Silently re-snap the yaw offset using fresh compass readings.
    // Keep calibrated=true so the current offset stays applied (no jump).
    headingSubRef.current?.remove();
    headingSubRef.current = null;

    const samples: number[] = [];
    Location.watchHeadingAsync((h) => {
      const heading = (h.trueHeading >= 0) ? h.trueHeading : h.magHeading;
      if (heading < 0) return;

      const diff = (heading - rawAzRef.current) * Math.PI / 180 + Math.PI;
      samples.push(diff);
      if (samples.length >= 3) {
        const sinSum = samples.reduce((s, a) => s + Math.sin(a), 0);
        const cosSum = samples.reduce((s, a) => s + Math.cos(a), 0);
        yawOffset.current = Math.atan2(sinSum / samples.length, cosSum / samples.length);
        headingSubRef.current?.remove();
        headingSubRef.current = null;
      }
    }).then(sub => { headingSubRef.current = sub; }).catch(() => {});
  }, []);

  useEffect(() => {
    const subs: Array<{ remove: () => void }> = [];
    let headingSub: Location.LocationSubscription | null = null;
    const headingSamples: number[] = [];

    (async () => {
      // Fallback: if DeviceMotion is unavailable, open in manual mode
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
      if (!dmAvail) { fallbackToManual(); return; }

      // Safety watchdog: if no motion data within 3.5s, fall back to manual
      const motionWatchdog = setTimeout(() => fallbackToManual(), 3500);
      subs.push({ remove: () => clearTimeout(motionWatchdog) });

      // Request location permission for heading
      try { await Location.requestForegroundPermissionsAsync(); } catch {}

      // Get heading for initial calibration — collect multiple samples for accuracy
      try {
        headingSub = await Location.watchHeadingAsync((h) => {
          const heading = (h.trueHeading >= 0) ? h.trueHeading : h.magHeading;
          if (heading < 0) return;

          if (!calibrated.current) {
            // Collect 5 samples then average for better calibration
            const diff = (heading - rawAzRef.current) * Math.PI / 180 + Math.PI;
            headingSamples.push(diff);
            if (headingSamples.length >= 5) {
              // Circular mean to handle wrap-around
              const sinSum = headingSamples.reduce((s, a) => s + Math.sin(a), 0);
              const cosSum = headingSamples.reduce((s, a) => s + Math.cos(a), 0);
              yawOffset.current = Math.atan2(sinSum / headingSamples.length, cosSum / headingSamples.length);
              calibrated.current = true;
              pointingRef.current = { ...pointingRef.current, calibrated: true };
              setPointing(p => ({ ...p, calibrated: true }));
              headingSub?.remove();
              headingSub = null;
            }
          }
        });
      } catch (e) {
        // Heading unavailable — force calibration so view opens
        calibrated.current = true;
        pointingRef.current = { ...pointingRef.current, calibrated: true };
        setPointing(p => ({ ...p, calibrated: true }));
      }

      // Watchdog: if calibration hasn't completed within 4s, force it
      const calibWatchdog = setTimeout(() => {
        if (!calibrated.current) {
          calibrated.current = true;
          pointingRef.current = { ...pointingRef.current, calibrated: true };
          setPointing(p => ({ ...p, calibrated: true }));
          headingSub?.remove();
          headingSub = null;
        }
      }, 4000);
      subs.push({ remove: () => clearTimeout(calibWatchdog) });

      DeviceMotion.setUpdateInterval(16);

      const sub = DeviceMotion.addListener((data) => {
        if (!data.rotation) return;
        const { alpha, beta, gamma } = data.rotation;

        // Build camera quaternion from DeviceMotion euler angles
        const deviceQ = eulerYXZToQuat(beta, alpha, -gamma);
        let camQ = qMul(deviceQ, Q_SCREEN);

        // Store raw azimuth for calibration
        rawAzRef.current = azimuthFromQuat(camQ);

        // Apply compass correction
        if (calibrated.current) {
          const ha = yawOffset.current / 2;
          const yawQ: Q = [0, Math.sin(ha), 0, Math.cos(ha)];
          camQ = qMul(yawQ, camQ);
        }

        // Extract display values
        const az = azimuthFromQuat(camQ);
        const [qx, qy, qz, qw] = camQ;
        const fy = 2 * (qw * qx - qy * qz);
        const alt = Math.asin(Math.max(-1, Math.min(1, fy))) * (180 / Math.PI);

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

      // Update React state for UI — only gate fields trigger AppContent re-render
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
      subs.forEach(s => s.remove());
      headingSub?.remove();
      headingSubRef.current?.remove();
    };
  }, []);

  return { pointing, pointingRef, recalibrate };
}
