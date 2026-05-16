// Step-position controller for the lab "step_position" Mechatronics module.
// Drives a stepper to a target tick count by issuing N steps at a fixed
// stepRate, ramping if requested.
//
// Returns the full step sequence (timestamps + position) for visualization.
//
// Reference: lab step_position.ino — closed-loop position seeking with
// trapezoidal velocity profile.

export interface StepPlanInput {
  readonly currentTicks: number;
  readonly targetTicks: number;
  readonly maxStepsPerSec: number;
  readonly accelStepsPerSecSq?: number;
}

export interface StepEvent {
  readonly t: number; // seconds
  readonly position: number; // ticks
}

export interface StepPlan {
  readonly events: readonly StepEvent[];
  readonly direction: 1 | -1 | 0;
  readonly totalSteps: number;
  readonly elapsed: number;
}

export function plan(input: StepPlanInput): StepPlan {
  const { currentTicks, targetTicks, maxStepsPerSec } = input;
  if (!Number.isInteger(currentTicks) || !Number.isInteger(targetTicks)) {
    throw new RangeError("ticks must be integers");
  }
  if (!Number.isFinite(maxStepsPerSec) || maxStepsPerSec <= 0) {
    throw new RangeError("maxStepsPerSec must be > 0");
  }
  const accel = input.accelStepsPerSecSq;
  if (accel !== undefined && (!Number.isFinite(accel) || accel <= 0)) {
    throw new RangeError("accelStepsPerSecSq must be > 0 if provided");
  }
  const delta = targetTicks - currentTicks;
  const direction: 1 | -1 | 0 = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const N = Math.abs(delta);
  if (N === 0) {
    return { events: [{ t: 0, position: currentTicks }], direction, totalSteps: 0, elapsed: 0 };
  }

  const events: StepEvent[] = [{ t: 0, position: currentTicks }];

  if (accel === undefined) {
    // Constant-rate stepping at maxStepsPerSec.
    const dt = 1 / maxStepsPerSec;
    let pos = currentTicks;
    for (let k = 1; k <= N; k += 1) {
      pos += direction;
      events.push({ t: k * dt, position: pos });
    }
    return { events, direction, totalSteps: N, elapsed: N * dt };
  }

  // Trapezoidal velocity profile:
  //   accel from 0 to maxStepsPerSec, cruise, decel symmetric back to 0.
  //   ramp distance = maxStepsPerSec² / (2·accel)
  const rampDist = (maxStepsPerSec * maxStepsPerSec) / (2 * accel);
  let nRamp = Math.floor(rampDist);
  let nCruise: number;
  if (2 * nRamp >= N) {
    // Triangular profile (never reach max velocity).
    nRamp = Math.floor(N / 2);
    nCruise = N - 2 * nRamp;
  } else {
    nCruise = N - 2 * nRamp;
  }

  let pos = currentTicks;
  let t = 0;
  // Accel phase: step k happens at time = √(2k/accel)
  for (let k = 1; k <= nRamp; k += 1) {
    t = Math.sqrt((2 * k) / accel);
    pos += direction;
    events.push({ t, position: pos });
  }
  // Cruise phase: constant dt = 1/maxStepsPerSec
  const dtCruise = 1 / maxStepsPerSec;
  for (let k = 1; k <= nCruise; k += 1) {
    t += dtCruise;
    pos += direction;
    events.push({ t, position: pos });
  }
  // Decel phase: symmetric — step times shrink back toward 0 (i.e. accel reverses).
  // Time for kth decel step relative to start of decel: t_k = √(2(nRamp²/accel
  //   - (nRamp - k)²/accel)) — simpler: mirror accel phase reversed.
  for (let k = 1; k <= nRamp; k += 1) {
    const remaining = nRamp - k + 1;
    const dt = Math.sqrt((2 * (2 * remaining - 1)) / accel) - Math.sqrt((2 * (2 * remaining - 2)) / accel);
    // Approximation: average step length during decel mirrors accel.
    // Cleaner: just symmetric — kth decel = (nRamp - k + 1)th accel.
    void dt;
    const kFromTop = nRamp - k + 1;
    const dtSym = Math.sqrt((2 * kFromTop) / accel) - Math.sqrt((2 * (kFromTop - 1)) / accel);
    t += dtSym;
    pos += direction;
    events.push({ t, position: pos });
  }
  return { events, direction, totalSteps: N, elapsed: t };
}
