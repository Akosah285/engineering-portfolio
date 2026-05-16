// Solar tracker logic. Two LDR (light-dependent resistor) readings (east, west)
// drive a servo step decision: if the east sensor sees more light than west by
// more than a deadband threshold, step east; if west sees more, step west; else
// hold.
//
// Outputs a discrete decision and (optionally) a clamped servo angle update.

export type Direction = "east" | "west" | "hold";

export interface TrackerInput {
  readonly east: number;
  readonly west: number;
  readonly deadband?: number;
  readonly currentAngle?: number;
  readonly stepDeg?: number;
  readonly minAngle?: number;
  readonly maxAngle?: number;
}

export interface TrackerResult {
  readonly direction: Direction;
  readonly nextAngle: number;
  readonly delta: number;
  readonly clamped: boolean;
}

export function decide(input: TrackerInput): TrackerResult {
  const east = input.east;
  const west = input.west;
  if (!Number.isFinite(east) || !Number.isFinite(west)) {
    throw new RangeError("LDR readings must be finite");
  }
  if (east < 0 || west < 0) {
    throw new RangeError("LDR readings must be non-negative");
  }
  const deadband = input.deadband ?? 5;
  if (deadband < 0) throw new RangeError("deadband must be >= 0");

  const stepDeg = input.stepDeg ?? 2;
  if (stepDeg <= 0) throw new RangeError("stepDeg must be positive");

  const cur = input.currentAngle ?? 0;
  const lo = input.minAngle ?? -90;
  const hi = input.maxAngle ?? 90;
  if (lo > hi) throw new RangeError("minAngle must be <= maxAngle");
  if (cur < lo || cur > hi) {
    throw new RangeError("currentAngle out of [minAngle, maxAngle]");
  }

  const diff = east - west;
  let direction: Direction;
  let delta: number;
  if (Math.abs(diff) <= deadband) {
    direction = "hold";
    delta = 0;
  } else if (diff > 0) {
    direction = "east";
    delta = -stepDeg; // assume east-rotating servo means negative angle
  } else {
    direction = "west";
    delta = stepDeg;
  }

  let next = cur + delta;
  let clamped = false;
  if (next < lo) {
    next = lo;
    clamped = true;
  } else if (next > hi) {
    next = hi;
    clamped = true;
  }
  // Recompute delta after clamp.
  delta = next - cur;
  return { direction, nextAngle: next, delta, clamped };
}

// Helper: read a digital threshold (e.g., "is it dark out?" → night mode).
export function isNight(brightness: number, nightThreshold: number): boolean {
  if (!Number.isFinite(brightness) || !Number.isFinite(nightThreshold)) {
    throw new RangeError("brightness/threshold must be finite");
  }
  return brightness < nightThreshold;
}
