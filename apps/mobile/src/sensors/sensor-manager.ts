/**
 * Sensor Manager for Expo — Gravity + Magnetometer Sky Navigation
 * 
 * Expo's DeviceMotion.rotation is NOT anchored to North — it's relative
 * to an arbitrary reference. So we can't use it for compass heading.
 * 
 * Instead, we replicate what Android's SensorManager.getRotationMatrix does:
 * 1. Use gravity vector (from accelerometer) to determine "down"
 * 2. Use magnetometer to determine "North"  
 * 3. Build a rotation matrix from these two vectors
 * 4. Extract the phone's pointing direction from the rotation matrix
 * 
 * This is the same approach used by Google Sky Map (Stardroid).
 * The rotation matrix maps device coordinates to Earth coordinates:
 *   Earth: X=East, Y=North, Z=Up
 *   Device: X=Right, Y=Top, Z=ScreenOut
 */

import { Accelerometer, Magnetometer } from 'expo-sensors';
import { Vector3D, LowPassFilter } from './low-pass-filter';

export interface DeviceOrientation {
  heading: number;
  pitch: number;
  roll: number;
  azimuth: number;
  altitude: number;
  confidence: number;
}

export type SensorState = 'available' | 'unavailable' | 'denied';

export interface SensorStatus {
  magnetometer: SensorState;
  accelerometer: SensorState;
  gyroscope: SensorState;
  deviceMotion: SensorState;
}

export interface SensorError {
  type: 'permission_denied' | 'sensor_unavailable' | 'initialization_failed';
  sensor?: 'magnetometer' | 'accelerometer' | 'gyroscope' | 'deviceMotion' | undefined;
  message: string;
}

export interface SensorManagerConfig {
  filterAlpha?: number;
  fusionConfig?: any;
  onError?: (error: SensorError) => void;
}

type OrientationCallback = (orientation: DeviceOrientation) => void;
type ErrorCallback = (error: SensorError) => void;

const RAD_TO_DEG = 180 / Math.PI;

export class SensorManager {
  private accelFilter: LowPassFilter;
  private magFilter: LowPassFilter;

  private status: SensorStatus = {
    magnetometer: 'unavailable',
    accelerometer: 'unavailable',
    gyroscope: 'unavailable',
    deviceMotion: 'unavailable',
  };

  private listeners: Set<OrientationCallback> = new Set();
  private errorCallback: ErrorCallback | null = null;
  private isRunning = false;
  private subscriptions: Array<{ remove: () => void }> = [];

  // Latest sensor readings
  private gravity: Vector3D = { x: 0, y: 0, z: -1 };
  private mag: Vector3D = { x: 0, y: 0, z: 0 };
  private hasMag = false;

  // Smoothing
  private smoothedAzimuth = 0;
  private smoothedAltitude = 45;
  private hasFirstReading = false;

  private lastValidOrientation: DeviceOrientation | null = null;

  constructor(config: SensorManagerConfig = {}) {
    // Use heavier filtering for smoother output
    this.accelFilter = new LowPassFilter(0.15);
    this.magFilter = new LowPassFilter(0.1);
    this.errorCallback = config.onError ?? null;
  }

  async initialize(): Promise<SensorStatus> {
    const [accelAvail, magAvail] = await Promise.all([
      Accelerometer.isAvailableAsync().catch(() => false),
      Magnetometer.isAvailableAsync().catch(() => false),
    ]);
    this.status.accelerometer = accelAvail ? 'available' : 'unavailable';
    this.status.magnetometer = magAvail ? 'available' : 'unavailable';

    if (!accelAvail) {
      this.emitError({
        type: 'sensor_unavailable', sensor: 'accelerometer',
        message: 'Accelerometer unavailable.',
      });
    }
    if (!magAvail) {
      this.emitError({
        type: 'sensor_unavailable', sensor: 'magnetometer',
        message: 'Magnetometer unavailable — cannot determine North.',
      });
    }
    return this.status;
  }

  startUpdates(updateRateHz: number = 60): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = Math.floor(1000 / Math.max(30, updateRateHz));

    if (this.status.accelerometer === 'available') {
      Accelerometer.setUpdateInterval(intervalMs);
      const sub = Accelerometer.addListener((data) => {
        // Expo accelerometer returns values in G's (1G ≈ 9.81 m/s²)
        // When phone is flat face-up: z ≈ -1 (gravity pulling down)
        this.gravity = this.accelFilter.filter(data);
        if (this.hasMag) this.computeOrientation();
      });
      this.subscriptions.push(sub);
    }

    if (this.status.magnetometer === 'available') {
      Magnetometer.setUpdateInterval(intervalMs);
      const sub = Magnetometer.addListener((data) => {
        this.mag = this.magFilter.filter(data);
        this.hasMag = true;
      });
      this.subscriptions.push(sub);
    }
  }

  /**
   * Compute orientation from gravity + magnetometer.
   * Replicates Android's SensorManager.getRotationMatrix().
   * 
   * The rotation matrix R transforms device coords to Earth coords:
   *   Earth: X=East, Y=North, Z=Up
   * 
   * For a phone held in portrait (upright, screen facing user):
   *   The phone's Y axis (top edge) points at the sky
   *   We extract where the Y axis points in Earth frame = column 1 of R
   */
  private computeOrientation(): void {
    const g = this.gravity;
    const m = this.mag;

    // Normalize gravity (points "down" in device frame)
    const gLen = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    if (gLen < 0.01) return;
    // In Expo, gravity when flat face-up: z ≈ -1
    // We want "up" direction, so negate
    const upX = -g.x / gLen;
    const upY = -g.y / gLen;
    const upZ = -g.z / gLen;

    // East = cross(mag, up) — perpendicular to both magnetic field and gravity
    let eastX = m.y * upZ - m.z * upY;
    let eastY = m.z * upX - m.x * upZ;
    let eastZ = m.x * upY - m.y * upX;
    const eastLen = Math.sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ);
    if (eastLen < 0.01) return;
    eastX /= eastLen;
    eastY /= eastLen;
    eastZ /= eastLen;

    // North = cross(up, east) — perpendicular to both up and east
    const northX = upY * eastZ - upZ * eastY;
    const northY = upZ * eastX - upX * eastZ;
    const northZ = upX * eastY - upY * eastX;

    // Rotation matrix R maps device coords to Earth coords: v_earth = R * v_device
    // Earth frame: (East, North, Up)
    // Device frame: (Right, Top, ScreenOut)
    //
    // R = [eastX  northX  upX]   ← these are device X,Y,Z expressed in Earth-East
    //     [eastY  northY  upY]   ← these are device X,Y,Z expressed in Earth-North
    //     [eastZ  northZ  upZ]   ← these are device X,Y,Z expressed in Earth-Up
    //
    // Phone held upright in portrait: the screen faces the user.
    // The direction the phone "looks at" is the NEGATIVE Z axis (into the screen).
    // Device -Z in Earth frame = negative of column 2 = (-upX, -upY, -upZ)
    //   -upX = how much of device -Z goes East
    //   -upY = how much of device -Z goes North
    //   -upZ = how much of device -Z goes Up

    const pointEast = -upX;
    const pointNorth = -upY;
    const pointUp = -upZ;

    // Azimuth: clockwise from North
    let azimuthDeg = Math.atan2(pointEast, pointNorth) * RAD_TO_DEG;
    azimuthDeg = ((azimuthDeg % 360) + 360) % 360;

    // Altitude: angle above horizon
    let altitudeDeg = Math.asin(Math.max(-1, Math.min(1, pointUp))) * RAD_TO_DEG;
    altitudeDeg = Math.max(-90, Math.min(90, altitudeDeg));

    // Smooth
    if (!this.hasFirstReading) {
      this.smoothedAzimuth = azimuthDeg;
      this.smoothedAltitude = altitudeDeg;
      this.hasFirstReading = true;
    } else {
      this.smoothedAzimuth = circularLerp(this.smoothedAzimuth, azimuthDeg, 0.15);
      this.smoothedAltitude += 0.15 * (altitudeDeg - this.smoothedAltitude);
    }

    this.emit({
      heading: this.smoothedAzimuth,
      pitch: altitudeDeg,
      roll: 0,
      azimuth: this.smoothedAzimuth,
      altitude: this.smoothedAltitude,
      confidence: 1,
    });
  }

  stopUpdates(): void {
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions = [];
    this.isRunning = false;
  }

  onOrientationChange(callback: OrientationCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getStatus(): SensorStatus { return { ...this.status }; }
  isUsingNativeFusion(): boolean { return false; }

  resetFusion(): void {
    this.accelFilter.reset();
    this.magFilter.reset();
    this.lastValidOrientation = null;
    this.hasFirstReading = false;
    this.hasMag = false;
  }

  setFilterAlpha(alpha: number): void {
    const a = Math.max(0.05, Math.min(0.5, alpha));
    this.accelFilter.setAlpha(a);
    this.magFilter.setAlpha(a);
  }

  getFilterAlpha(): number { return this.accelFilter.getAlpha(); }
  setErrorCallback(callback: ErrorCallback | null): void { this.errorCallback = callback; }

  // API compatibility stubs
  calibrate(): void {}
  resetCalibration(): void {}
  getIsCalibrated(): boolean { return true; }
  getIsCalibrating(): boolean { return false; }
  onCalibrationChange(callback: (calibrated: boolean) => void): () => void {
    setTimeout(() => callback(true), 0);
    return () => {};
  }

  updateSensorData(magnetometer?: Vector3D, accelerometer?: Vector3D): void {
    if (accelerometer) this.gravity = this.accelFilter.filter(accelerometer);
    if (magnetometer) {
      this.mag = this.magFilter.filter(magnetometer);
      this.hasMag = true;
    }
    if (this.hasMag) this.computeOrientation();
  }

  simulatePermissionDenied(sensor: 'magnetometer' | 'accelerometer' | 'gyroscope'): void {
    this.status[sensor] = 'denied';
    this.emitError({ type: 'permission_denied', sensor, message: `Permission denied for ${sensor}.` });
  }

  simulateSensorUnavailable(sensor: 'magnetometer' | 'accelerometer' | 'gyroscope'): void {
    this.status[sensor] = 'unavailable';
    this.emitError({ type: 'sensor_unavailable', sensor, message: `${sensor} is not available.` });
  }

  private emit(orientation: DeviceOrientation): void {
    if (this.isValid(orientation)) {
      this.lastValidOrientation = orientation;
      for (const cb of this.listeners) cb(orientation);
    } else if (this.lastValidOrientation) {
      for (const cb of this.listeners) cb(this.lastValidOrientation);
    }
  }

  private emitError(error: SensorError): void { this.errorCallback?.(error); }

  private isValid(o: DeviceOrientation): boolean {
    return Number.isFinite(o.heading) && Number.isFinite(o.pitch) &&
      Number.isFinite(o.roll) && Number.isFinite(o.azimuth) && Number.isFinite(o.altitude);
  }
}

function circularLerp(current: number, target: number, alpha: number): number {
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (((current + alpha * diff) % 360) + 360) % 360;
}

export default SensorManager;
