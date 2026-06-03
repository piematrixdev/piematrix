/**
 * Quaternion math for 3D rotation representation.
 * Quaternions avoid gimbal lock and provide smooth interpolation
 * for device orientation tracking in AR sky navigation.
 */

export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export function identity(): Quaternion {
  return { w: 1, x: 0, y: 0, z: 0 };
}

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function normalize(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (len < 1e-10) return identity();
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
}

export function conjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/**
 * Spherical linear interpolation between two quaternions.
 * Used for smooth blending between gyro-predicted and absolute orientations.
 */
export function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

  // If dot is negative, negate one quaternion to take the shorter path
  let bAdj = b;
  if (dot < 0) {
    bAdj = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
    dot = -dot;
  }

  // If quaternions are very close, use linear interpolation
  if (dot > 0.9995) {
    return normalize({
      w: a.w + t * (bAdj.w - a.w),
      x: a.x + t * (bAdj.x - a.x),
      y: a.y + t * (bAdj.y - a.y),
      z: a.z + t * (bAdj.z - a.z),
    });
  }

  const theta = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return normalize({
    w: wa * a.w + wb * bAdj.w,
    x: wa * a.x + wb * bAdj.x,
    y: wa * a.y + wb * bAdj.y,
    z: wa * a.z + wb * bAdj.z,
  });
}

/**
 * Create quaternion from axis-angle representation.
 * Used to integrate gyroscope angular velocity over a time step.
 */
export function fromAxisAngle(ax: number, ay: number, az: number, angle: number): Quaternion {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  const len = Math.sqrt(ax * ax + ay * ay + az * az);
  if (len < 1e-10) return identity();
  return normalize({
    w: Math.cos(halfAngle),
    x: (ax / len) * s,
    y: (ay / len) * s,
    z: (az / len) * s,
  });
}

/**
 * Create quaternion from gyroscope angular velocity (rad/s) and time delta.
 * Integrates the rotation: q_new = q_old * deltaQ
 */
export function fromGyroscope(gx: number, gy: number, gz: number, dt: number): Quaternion {
  const angle = Math.sqrt(gx * gx + gy * gy + gz * gz) * dt;
  if (angle < 1e-10) return identity();
  return fromAxisAngle(gx, gy, gz, angle);
}

/**
 * Convert quaternion to Euler angles (heading, pitch, roll) in degrees.
 * Uses aerospace convention: Z-Y-X (yaw-pitch-roll).
 */
export function toEuler(q: Quaternion): { heading: number; pitch: number; roll: number } {
  // Heading (yaw) - rotation around Z axis
  const sinYaw = 2 * (q.w * q.z + q.x * q.y);
  const cosYaw = 1 - 2 * (q.y * q.y + q.z * q.z);
  let heading = Math.atan2(sinYaw, cosYaw) * (180 / Math.PI);
  if (heading < 0) heading += 360;

  // Pitch - rotation around Y axis (clamped to avoid gimbal lock)
  const sinPitch = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinPitch) >= 1
    ? Math.sign(sinPitch) * 90
    : Math.asin(sinPitch) * (180 / Math.PI);

  // Roll - rotation around X axis
  const sinRoll = 2 * (q.w * q.x + q.y * q.z);
  const cosRoll = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinRoll, cosRoll) * (180 / Math.PI);

  return { heading, pitch, roll };
}

/**
 * Create quaternion from accelerometer + magnetometer (absolute reference).
 * This gives a drift-free but noisy orientation estimate.
 */
export function fromAccelMag(
  acc: { x: number; y: number; z: number },
  mag: { x: number; y: number; z: number },
): Quaternion {
  // Normalize accelerometer (gravity direction = "down")
  const aNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
  if (aNorm < 1e-6) return identity();
  const ax = acc.x / aNorm;
  const ay = acc.y / aNorm;
  const az = acc.z / aNorm;

  // Pitch and roll from gravity
  const pitch = Math.asin(-ax);
  const roll = Math.atan2(ay, az);

  // Tilt-compensated magnetometer heading
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  const magX = mag.x * cp + mag.z * sp;
  const magY = mag.x * sr * sp + mag.y * cr - mag.z * sr * cp;
  let heading = Math.atan2(-magY, magX);

  // Build rotation quaternion from Euler angles (ZYX order)
  const cy = Math.cos(heading / 2);
  const sy = Math.sin(heading / 2);
  const cpi = Math.cos(pitch / 2);
  const spi = Math.sin(pitch / 2);
  const cro = Math.cos(roll / 2);
  const sro = Math.sin(roll / 2);

  return normalize({
    w: cy * cpi * cro + sy * spi * sro,
    x: cy * cpi * sro - sy * spi * cro,
    y: cy * spi * cro + sy * cpi * sro,
    z: sy * cpi * cro - cy * spi * sro,
  });
}
