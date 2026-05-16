// Sensor fusion: complementary filter combining a noisy gyroscope with a
// drift-free but noisy accelerometer estimate of tilt angle.
//
//   θ_fused[k] = α · (θ_fused[k-1] + ω_gyro[k] · dt) + (1 - α) · θ_acc[k]
//
// where α near 1 trusts the gyroscope short-term, (1 - α) trusts the
// accelerometer long-term.
//
// References: Gade, "Practical Sensor Fusion" — also baseline for the lab
// IMU + encoder fusion in v8 Mechatronics.

export interface ComplementaryInput {
  readonly alpha: number;
  readonly dt: number;
  readonly omegaGyro: readonly number[]; // rad/s
  readonly thetaAcc: readonly number[]; // rad
  readonly theta0?: number; // initial angle (defaults to thetaAcc[0])
}

export interface ComplementaryResult {
  readonly thetaFused: readonly number[];
}

export function complementaryFilter(input: ComplementaryInput): ComplementaryResult {
  const { alpha, dt, omegaGyro, thetaAcc } = input;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError("alpha must be in [0, 1]");
  }
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError("dt must be > 0");
  }
  if (omegaGyro.length !== thetaAcc.length) {
    throw new RangeError("omegaGyro and thetaAcc must have equal length");
  }
  if (omegaGyro.length === 0) throw new RangeError("input series cannot be empty");
  const out = new Array<number>(omegaGyro.length);
  out[0] = input.theta0 ?? thetaAcc[0]!;
  for (let k = 1; k < omegaGyro.length; k += 1) {
    out[k] = alpha * (out[k - 1]! + omegaGyro[k]! * dt) + (1 - alpha) * thetaAcc[k]!;
  }
  return { thetaFused: out };
}

// Fuse encoder-based odometry (counts per loop) with IMU yaw integration.
// Same complementary structure on the heading angle.
//   heading[k] = α · (heading[k-1] + Δyaw_imu[k]) + (1 - α) · heading_enc[k]
export interface HeadingFusionInput {
  readonly alpha: number;
  readonly dyawImu: readonly number[];
  readonly headingEnc: readonly number[];
  readonly heading0?: number;
}

export function fuseHeading(input: HeadingFusionInput): { heading: readonly number[] } {
  const { alpha, dyawImu, headingEnc } = input;
  if (alpha < 0 || alpha > 1) throw new RangeError("alpha must be in [0, 1]");
  if (dyawImu.length !== headingEnc.length) {
    throw new RangeError("dyawImu and headingEnc must have equal length");
  }
  if (dyawImu.length === 0) throw new RangeError("input series cannot be empty");
  const out = new Array<number>(dyawImu.length);
  out[0] = input.heading0 ?? headingEnc[0]!;
  for (let k = 1; k < dyawImu.length; k += 1) {
    out[k] = alpha * (out[k - 1]! + dyawImu[k]!) + (1 - alpha) * headingEnc[k]!;
  }
  return { heading: out };
}
