/**
 * Madgwick AHRS Filter — fuses gyroscope, accelerometer, and magnetometer
 * into a stable orientation quaternion.
 *
 * Based on Sebastian Madgwick's 2010 paper:
 * "An efficient orientation filter for inertial and inertial/magnetic sensor arrays"
 *
 * This gives smooth, drift-free orientation with absolute north reference.
 */

export type Quat = [number, number, number, number]; // [x, y, z, w]

export class MadgwickAHRS {
  private q: Quat = [0, 0, 0, 1]; // orientation quaternion [x, y, z, w]
  private beta: number; // filter gain (higher = more magnetometer trust, more noise)
  private samplePeriod: number;

  constructor(sampleFreq = 60, beta = 0.1) {
    this.samplePeriod = 1 / sampleFreq;
    this.beta = beta;
  }

  /** Get current orientation quaternion [x, y, z, w] */
  getQuaternion(): Quat {
    return [...this.q] as Quat;
  }

  /** Set the filter gain (0.01 = very smooth/slow, 0.5 = fast/noisy) */
  setBeta(beta: number) {
    this.beta = beta;
  }

  /**
   * Update with gyroscope + accelerometer + magnetometer (9-DOF).
   * All inputs in sensor frame.
   *
   * @param gx, gy, gz - Gyroscope in rad/s
   * @param ax, ay, az - Accelerometer (any unit, will be normalized)
   * @param mx, my, mz - Magnetometer (any unit, will be normalized)
   */
  update(
    gx: number, gy: number, gz: number,
    ax: number, ay: number, az: number,
    mx: number, my: number, mz: number,
    dt?: number,
  ) {
    const samplePeriod = dt ?? this.samplePeriod;
    let [q1, q2, q3, q4] = this.q; // x, y, z, w

    // Normalize accelerometer
    let norm = Math.sqrt(ax * ax + ay * ay + az * az);
    if (norm === 0) return;
    ax /= norm; ay /= norm; az /= norm;

    // Normalize magnetometer
    norm = Math.sqrt(mx * mx + my * my + mz * mz);
    if (norm === 0) {
      // No magnetometer data — fall back to IMU-only update
      this.updateIMU(gx, gy, gz, ax, ay, az, samplePeriod);
      return;
    }
    mx /= norm; my /= norm; mz /= norm;

    // Reference direction of Earth's magnetic field
    const _2q1mx = 2 * q1 * mx;
    const _2q1my = 2 * q1 * my;
    const _2q1mz = 2 * q1 * mz;
    const _2q2mx = 2 * q2 * mx;
    const hx = mx * q4 * q4 - _2q1my * q3 + _2q1mz * q2 + mx * q1 * q1 + _2q2mx * q2 + my * q2 * q2 + mz * q2 * q2 - mx * q3 * q3 - mx * q3 * q3;

    // Simplified: compute reference direction of magnetic field
    const _2q4 = 2 * q4;
    const _2q1 = 2 * q1;
    const _2q2 = 2 * q2;
    const _2q3 = 2 * q3;
    const q4q4 = q4 * q4;
    const q1q1 = q1 * q1;
    const q2q2 = q2 * q2;
    const q3q3 = q3 * q3;

    const hx2 = 2 * mx * (0.5 - q2q2 - q3q3) + 2 * my * (q1 * q2 - q4 * q3) + 2 * mz * (q1 * q3 + q4 * q2);
    const hy2 = 2 * mx * (q1 * q2 + q4 * q3) + 2 * my * (0.5 - q1q1 - q3q3) + 2 * mz * (q2 * q3 - q4 * q1);
    const _2bx = Math.sqrt(hx2 * hx2 + hy2 * hy2);
    const _2bz = 2 * mx * (q1 * q3 - q4 * q2) + 2 * my * (q2 * q3 + q4 * q1) + 2 * mz * (0.5 - q1q1 - q2q2);

    // Gradient descent corrective step
    const f1 = _2q1 * q3 - _2q4 * q2 - ax;
    const f2 = _2q4 * q1 + _2q2 * q3 - ay;
    const f3 = 1 - _2q1 * q1 - _2q2 * q2 - az;
    const f4 = _2bx * (0.5 - q2q2 - q3q3) + _2bz * (q1 * q3 - q4 * q2) - mx;
    const f5 = _2bx * (q1 * q2 - q4 * q3) + _2bz * (q4 * q1 + q2 * q3) - my;
    const f6 = _2bx * (q4 * q2 + q1 * q3) + _2bz * (0.5 - q1q1 - q2q2) - mz;

    // Jacobian
    const J11 = _2q3;
    const J12 = -_2q4;
    const J13 = _2q1;
    const J14 = -_2q2;
    const J21 = _2q4;
    const J22 = _2q3;
    const J23 = _2q2;
    const J24 = _2q1;
    const J31 = -2 * _2q1;
    const J32 = -2 * _2q2;
    const J33 = 0;
    const J34 = 0;
    const J41 = _2bz * q3;
    const J42 = -_2bz * q4 - 2 * _2bx * q2;
    const J43 = _2bz * q1 - 2 * _2bx * q3;
    const J44 = _2bz * q2;
    const J51 = -_2bx * q3 + _2bz * q1;
    const J52 = _2bx * q2 + _2bz * q4;
    const J53 = -_2bx * q1 + _2bz * q3;
    const J54 = -_2bx * q4 + _2bz * q2;
    const J61 = _2bx * q2;
    const J62 = _2bx * q3 - 2 * _2bz * q1;
    const J63 = _2bx * q4 - 2 * _2bz * q2;
    const J64 = _2bx * q1;

    // Gradient
    let s1 = J11 * f1 + J21 * f2 + J31 * f3 + J41 * f4 + J51 * f5 + J61 * f6;
    let s2 = J12 * f1 + J22 * f2 + J32 * f3 + J42 * f4 + J52 * f5 + J62 * f6;
    let s3 = J13 * f1 + J23 * f2 + J33 * f3 + J43 * f4 + J53 * f5 + J63 * f6;
    let s4 = J14 * f1 + J24 * f2 + J34 * f3 + J44 * f4 + J54 * f5 + J64 * f6;

    // Normalize gradient
    norm = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3 + s4 * s4);
    if (norm > 0) { s1 /= norm; s2 /= norm; s3 /= norm; s4 /= norm; }

    // Compute rate of change of quaternion
    const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * s1;
    const qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy) - this.beta * s2;
    const qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx) - this.beta * s3;
    const qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx) - this.beta * s4;

    // Integrate
    q1 += qDot1 * samplePeriod;
    q2 += qDot2 * samplePeriod;
    q3 += qDot3 * samplePeriod;
    q4 += qDot4 * samplePeriod;

    // Normalize quaternion
    norm = Math.sqrt(q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4);
    this.q = [q1 / norm, q2 / norm, q3 / norm, q4 / norm];
  }

  /**
   * IMU-only update (no magnetometer) — uses gyro + accelerometer.
   * Corrects pitch/roll drift but yaw will drift.
   */
  private updateIMU(
    gx: number, gy: number, gz: number,
    ax: number, ay: number, az: number,
    dt: number,
  ) {
    let [q1, q2, q3, q4] = this.q;

    const _2q1 = 2 * q1, _2q2 = 2 * q2, _2q3 = 2 * q3, _2q4 = 2 * q4;

    // Gradient descent corrective step (gravity only)
    let s1 = _2q1 * q3 - _2q4 * q2 - ax;
    let s2 = _2q4 * q1 + _2q2 * q3 - ay;
    let s3 = 1 - _2q1 * q1 - _2q2 * q2 - az;

    const J11 = _2q3, J12 = -_2q4, J21 = _2q4, J22 = _2q3;
    const J23 = _2q2, J24 = _2q1, J31 = -2 * _2q1, J32 = -2 * _2q2;

    let g1 = J11 * s1 + J21 * s2 + J31 * s3;
    let g2 = J12 * s1 + J22 * s2 + J32 * s3;
    let g3 = J11 * s1 + J23 * s2;
    let g4 = J12 * s1 + J24 * s2;

    let norm = Math.sqrt(g1 * g1 + g2 * g2 + g3 * g3 + g4 * g4);
    if (norm > 0) { g1 /= norm; g2 /= norm; g3 /= norm; g4 /= norm; }

    const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * g1;
    const qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy) - this.beta * g2;
    const qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx) - this.beta * g3;
    const qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx) - this.beta * g4;

    q1 += qDot1 * dt;
    q2 += qDot2 * dt;
    q3 += qDot3 * dt;
    q4 += qDot4 * dt;

    norm = Math.sqrt(q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4);
    this.q = [q1 / norm, q2 / norm, q3 / norm, q4 / norm];
  }
}
