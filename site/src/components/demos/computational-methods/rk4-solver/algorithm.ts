/**
 * rk4Solver — generic 4th-order Runge-Kutta integrator (#76 v5 hero).
 *
 * Designed for systems of first-order ODEs:  dy/dt = f(t, y),  y, f ∈ ℝⁿ.
 * Works for scalar problems by passing y as a 1-element array.
 *
 * The shell will reuse this for #98 wave (line of coupled oscillators),
 * #99 heat (1D rod via method of lines), and #102 RC/RL step response.
 */

export type DerivativeFn = (t: number, y: ReadonlyArray<number>) => ReadonlyArray<number>;

export interface Rk4StepInput {
  readonly f: DerivativeFn;
  readonly t: number;
  readonly y: ReadonlyArray<number>;
  readonly dt: number;
}

export interface Rk4IntegrateInput {
  readonly f: DerivativeFn;
  readonly t0: number;
  readonly y0: ReadonlyArray<number>;
  readonly tEnd: number;
  readonly dt: number;
}

export interface TrajectoryPoint {
  readonly t: number;
  readonly y: ReadonlyArray<number>;
}

function add(a: ReadonlyArray<number>, b: ReadonlyArray<number>, scale = 1): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = a[i]! + scale * b[i]!;
  return out;
}

function dimensionMismatch(a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean {
  return a.length !== b.length;
}

export function rk4Step(input: Rk4StepInput): number[] {
  if (!Number.isFinite(input.dt) || input.dt <= 0) {
    throw new RangeError("rk4Step: dt must be > 0 and finite.");
  }
  const { f, t, y, dt } = input;
  const k1 = f(t, y);
  if (dimensionMismatch(k1, y)) {
    throw new RangeError("rk4Step: f returned wrong-length derivative vector.");
  }
  const k2 = f(t + dt / 2, add(y, k1, dt / 2));
  const k3 = f(t + dt / 2, add(y, k2, dt / 2));
  const k4 = f(t + dt, add(y, k3, dt));

  const out = new Array<number>(y.length);
  for (let i = 0; i < y.length; i += 1) {
    out[i] = y[i]! + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
  }
  return out;
}

export function rk4Integrate(input: Rk4IntegrateInput): TrajectoryPoint[] {
  if (!Number.isFinite(input.dt) || input.dt <= 0) {
    throw new RangeError("rk4Integrate: dt must be > 0 and finite.");
  }
  if (!Number.isFinite(input.t0) || !Number.isFinite(input.tEnd)) {
    throw new RangeError("rk4Integrate: t0 and tEnd must be finite.");
  }
  if (input.tEnd < input.t0) {
    throw new RangeError("rk4Integrate: tEnd must be >= t0 (no backward integration).");
  }

  const { f, t0, y0, tEnd, dt } = input;
  const traj: TrajectoryPoint[] = [{ t: t0, y: y0.slice() }];
  let t = t0;
  let y: ReadonlyArray<number> = y0;
  // Use a step-count derived from dt to avoid floating-point drift on the loop bound.
  const nSteps = Math.max(0, Math.round((tEnd - t0) / dt));
  for (let i = 0; i < nSteps; i += 1) {
    y = rk4Step({ f, t, y, dt });
    t = t0 + (i + 1) * dt;
    traj.push({ t, y: y.slice() });
  }
  return traj;
}
