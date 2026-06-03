/**
 * Sensor Fusion Engine
 * 
 * Implements a complementary filter that fuses:
 * - Gyroscope: fast, smooth, low-latency rotation tracking (but drifts over time)
 * - Accelerometer + Magnetometer: absolute orientation reference (noisy but drift-free)
 * 
 * The gyroscope drives the high-frequency orientation updates for responsive AR,
 * while accel+mag slowly corrects drift. This gives the best of both worlds:
 * smooth, responsive tracking that stays accurate over time.
 * 
 * For devices with native DeviceMotion API (iOS/Android), we can use the
 * platform's built-in sensor fusion via rotation matrix, which is even better.
 */

import {
  Quaternion,
  identity,
  normalize,
  multiply,
  slerp,
  fromGyroscope,
  fromAccelMag,
  toEuler,
} from './quaternion';
import { Vector3D } from './low-pass-filter';

export interface FusedOrientation {
  /** Compass heading 0-360° (0=North, 90=East, 180=South, 270=West) */
  heading: number;
  /** Device pitch -90 to +90° (negative=tilted forward, positive=tilted back) */
  pitch: number;
  /** Device roll -180 to +180° */
  roll: number;
  /** Azimuth where the device is pointing (same as heading for landscape-corrected) */
  azimuth: number;
  /** Altitude angle the device is pointing at (-90=ground, 0=horizon, 90=zenith) */
  altitude: number;
  /** Confidence in the orientation estimate (0-1) */
  confidence: number;
  /** Timestamp of this reading */
  timestamp: number;
}

export interface SensorFusionConfig {
  /**
   * Complementary filter alpha (0-1).
   * Higher = trust gyroscope more (smoother but may drift).
   * Lower = trust accel+mag more (noisier but drift-free).
   * Default: 0.98 (heavily favor gyro for smooth AR)
   */
  gyroWeight?: number;
  /** Whether to use device's native motion API when available. Default: true */
  useNativeMotion?: boolean;
  /** Minimum time between orientation callbacks in ms. Default: 16 (~60fps) */
  minUpdateInterval?: number;
}

type OrientationListener = (orientation: FusedOrientation) => void;

export class SensorFusion {
  private orientation: Quaternion = identity();
  private gyroWeight: number;
  private useNativeMotion: boolean;
  private minUpdateInterval: number;

  private lastGyroTimestamp: number = 0;
  private lastEmitTimestamp: number = 0;
  private hasInitialOrientation: boolean = false;
  private gyroSampleCount: number = 0;

  // Track whether we're using native rotation or manual fusion
  private usingNativeRotation: boolean = false;

  private listeners: Set<OrientationListener> = new Set();

  // Adaptive confidence based on sensor agreement
  private confidence: number = 0;
  private lastAbsoluteOrientation: Quaternion = identity();

  constructor(config: SensorFusionConfig = {}) {
    this.gyroWeight = Math.max(0, Math.min(1, config.gyroWeight ?? 0.98));
    this.useNativeMotion = config.useNativeMotion ?? true;
    this.minUpdateInterval = config.minUpdateInterval ?? 16;
  }

  /**
   * Subscribe to fused orientation updates.
   * Returns unsubscribe function.
   */
  onOrientation(listener: OrientationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Feed in a native device rotation matrix (from iOS CoreMotion or Android SensorManager).
   * This is the preferred path — the OS does sensor fusion in hardware/firmware.
   * 
   * The rotation matrix should be a 3x3 or 4x4 column-major matrix representing
   * the device's orientation relative to Earth frame (North-East-Down or similar).
   */
  handleNativeRotationMatrix(matrix: number[]): void {
    this.usingNativeRotation = true;

    // Extract quaternion from 3x3 rotation matrix (column-major)
    // R = [m0 m3 m6]
    //     [m1 m4 m7]
    //     [m2 m5 m8]
    const m = matrix;
    const trace = m[0] + m[4] + m[8];
    let q: Quaternion;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      q = {
        w: 0.25 / s,
        x: (m[5] - m[7]) * s,
        y: (m[6] - m[2]) * s,
        z: (m[1] - m[3]) * s,
      };
    } else if (m[0] > m[4] && m[0] > m[8]) {
      const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
      q = {
        w: (m[5] - m[7]) / s,
        x: 0.25 * s,
        y: (m[3] + m[1]) / s,
        z: (m[6] + m[2]) / s,
      };
    } else if (m[4] > m[8]) {
      const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
      q = {
        w: (m[6] - m[2]) / s,
        x: (m[3] + m[1]) / s,
        y: 0.25 * s,
        z: (m[7] + m[5]) / s,
      };
    } else {
      const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
      q = {
        w: (m[1] - m[3]) / s,
        x: (m[6] + m[2]) / s,
        y: (m[7] + m[5]) / s,
        z: 0.25 * s,
      };
    }

    this.orientation = normalize(q);
    this.confidence = 1; // Native fusion is high confidence
    this.hasInitialOrientation = true;
    this.emitOrientation();
  }

  /**
   * Feed in a native device quaternion directly (e.g., from expo-sensors DeviceMotion).
   * Some platforms provide the fused quaternion directly.
   */
  handleNativeQuaternion(w: number, x: number, y: number, z: number): void {
    this.usingNativeRotation = true;
    this.orientation = normalize({ w, x, y, z });
    this.confidence = 1;
    this.hasInitialOrientation = true;
    this.emitOrientation();
  }

  /**
   * Feed raw gyroscope data (angular velocity in rad/s).
   * This is the high-frequency path for smooth tracking.
   */
  handleGyroscope(gyro: Vector3D, timestamp: number): void {
    if (this.usingNativeRotation) return; // Skip if using native fusion

    if (this.lastGyroTimestamp === 0) {
      this.lastGyroTimestamp = timestamp;
      return;
    }

    const dt = (timestamp - this.lastGyroTimestamp) / 1000; // Convert ms to seconds
    this.lastGyroTimestamp = timestamp;

    // Reject unreasonable dt (e.g., app was backgrounded)
    if (dt <= 0 || dt > 0.5) return;

    // Integrate gyroscope rotation
    const deltaQ = fromGyroscope(gyro.x, gyro.y, gyro.z, dt);
    const gyroPredicted = normalize(multiply(this.orientation, deltaQ));

    if (!this.hasInitialOrientation) {
      // No absolute reference yet — just use gyro (will be corrected once accel+mag arrives)
      this.orientation = gyroPredicted;
      this.gyroSampleCount++;
      // Low confidence until we have absolute reference
      this.confidence = Math.min(0.3, this.gyroSampleCount * 0.01);
    } else {
      // Blend gyro prediction with last absolute reference using complementary filter
      this.orientation = slerp(this.lastAbsoluteOrientation, gyroPredicted, this.gyroWeight);
    }

    this.emitOrientation();
  }

  /**
   * Feed raw accelerometer + magnetometer data.
   * This is the low-frequency absolute reference that corrects gyro drift.
   */
  handleAccelMag(accel: Vector3D, mag: Vector3D): void {
    if (this.usingNativeRotation) return;

    const absoluteQ = fromAccelMag(accel, mag);
    this.lastAbsoluteOrientation = absoluteQ;

    if (!this.hasInitialOrientation) {
      // First absolute reading — initialize orientation
      this.orientation = absoluteQ;
      this.hasInitialOrientation = true;
      this.confidence = 0.5;
    } else {
      // Gently correct the current orientation toward the absolute reference
      // Use inverse of gyroWeight so accel+mag has (1 - gyroWeight) influence
      this.orientation = slerp(absoluteQ, this.orientation, this.gyroWeight);
    }

    // Update confidence based on how well gyro and absolute agree
    const euler1 = toEuler(this.orientation);
    const euler2 = toEuler(absoluteQ);
    const headingDiff = Math.abs(euler1.heading - euler2.heading);
    const normalizedDiff = Math.min(headingDiff, 360 - headingDiff);
    // Good agreement (< 5°) = high confidence, poor (> 30°) = low
    this.confidence = Math.max(0.2, Math.min(1, 1 - normalizedDiff / 30));

    this.emitOrientation();
  }

  /**
   * Reset the fusion state (e.g., when app resumes from background).
   */
  reset(): void {
    this.orientation = identity();
    this.hasInitialOrientation = false;
    this.lastGyroTimestamp = 0;
    this.lastEmitTimestamp = 0;
    this.gyroSampleCount = 0;
    this.confidence = 0;
    this.usingNativeRotation = false;
  }

  /**
   * Get the current fused orientation.
   */
  getCurrentOrientation(): FusedOrientation {
    return this.buildFusedOrientation();
  }

  /**
   * Whether we're using the device's native sensor fusion.
   */
  isUsingNativeFusion(): boolean {
    return this.usingNativeRotation;
  }

  private buildFusedOrientation(): FusedOrientation {
    const euler = toEuler(this.orientation);
    const now = Date.now();

    // Convert device orientation to sky-pointing direction:
    // When phone is held up to the sky:
    // - heading → azimuth (compass direction you're facing)
    // - pitch → altitude (how high you're looking)
    //   pitch=0 means phone is vertical (looking at horizon)
    //   pitch=90 means phone is flat face-up (looking at zenith)
    //   pitch=-90 means phone is flat face-down (looking at ground)
    const altitude = Math.max(-90, Math.min(90, euler.pitch));

    return {
      heading: euler.heading,
      pitch: euler.pitch,
      roll: euler.roll,
      azimuth: euler.heading,
      altitude,
      confidence: this.confidence,
      timestamp: now,
    };
  }

  private emitOrientation(): void {
    const now = Date.now();
    if (now - this.lastEmitTimestamp < this.minUpdateInterval) return;
    this.lastEmitTimestamp = now;

    const orientation = this.buildFusedOrientation();
    for (const listener of this.listeners) {
      listener(orientation);
    }
  }
}
