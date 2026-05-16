// Accelerometer — tilt computation + shake detection.
// Reference: Pedley, "Tilt Sensing Using a Three-Axis Accelerometer"
// (Freescale AN3461) and Madgwick, "An efficient orientation filter for
// inertial and inertial/magnetic sensor arrays" (2010).
//
// At rest, the accelerometer reads the gravity vector. Tilt angles are
// derived directly from the gravity components:
//   roll  = atan2(ay, az)
//   pitch = atan2(-ax, sqrt(ay^2 + az^2))
// When the device is moving, a complementary filter blends this gravity
// estimate with gyro-integrated angular velocity for low-noise tracking.

export interface AccelSample {
  ax: number; // m/s^2
  ay: number;
  az: number;
}

export interface ImuSample {
  ax: number;
  ay: number;
  az: number;
  /** angular velocity around x, y in rad/s. */
  gx: number;
  gy: number;
  /** time in seconds since previous sample. */
  dt: number;
}

export interface TiltAngles {
  /** rotation around x-axis (rad), range (-π, π]. */
  roll: number;
  /** rotation around y-axis (rad), range (-π/2, π/2). */
  pitch: number;
}

export function tiltFromAccel(s: AccelSample): TiltAngles {
  if (s.ax === 0 && s.ay === 0 && s.az === 0) {
    throw new RangeError("tiltFromAccel: zero gravity vector — degenerate");
  }
  const roll = Math.atan2(s.ay, s.az);
  const pitch = Math.atan2(-s.ax, Math.hypot(s.ay, s.az));
  return { roll, pitch };
}

// Complementary filter: prev = previous fused estimate; alpha = gyro weight in [0,1].
export function complementaryFilter(
  prev: TiltAngles,
  sample: ImuSample,
  alpha: number,
): TiltAngles {
  if (alpha < 0 || alpha > 1) {
    throw new RangeError("complementaryFilter: alpha must be in [0,1]");
  }
  if (sample.dt < 0) {
    throw new RangeError("complementaryFilter: dt must be ≥ 0");
  }
  const fromAccel = tiltFromAccel({
    ax: sample.ax,
    ay: sample.ay,
    az: sample.az,
  });
  // gyro-integrated update
  const rollGyro = prev.roll + sample.gx * sample.dt;
  const pitchGyro = prev.pitch + sample.gy * sample.dt;
  return {
    roll: alpha * rollGyro + (1 - alpha) * fromAccel.roll,
    pitch: alpha * pitchGyro + (1 - alpha) * fromAccel.pitch,
  };
}

// Shake detection: a "shake" is a sample whose acceleration magnitude exceeds
// `thresholdG` relative to 1g for at least `minSamples` consecutive samples.
// Returns indices at which a shake event begins.
export function detectShakes(
  samples: readonly AccelSample[],
  thresholdG: number,
  minSamples: number,
): number[] {
  if (thresholdG <= 0) {
    throw new RangeError("detectShakes: thresholdG must be > 0");
  }
  if (!Number.isInteger(minSamples) || minSamples <= 0) {
    throw new RangeError("detectShakes: minSamples must be a positive integer");
  }
  const G = 9.81;
  const limit = (1 + thresholdG) * G;
  const events: number[] = [];
  let run = 0;
  let runStart = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const mag = Math.hypot(s.ax, s.ay, s.az);
    if (mag >= limit) {
      if (run === 0) runStart = i;
      run++;
      if (run === minSamples) events.push(runStart);
    } else {
      run = 0;
    }
  }
  return events;
}

// Convenience: convert angles from radians to degrees.
export function toDegrees(angles: TiltAngles): TiltAngles {
  const k = 180 / Math.PI;
  return { roll: angles.roll * k, pitch: angles.pitch * k };
}
