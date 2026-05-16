// 1D wave equation solver: u_tt = c^2 u_xx with Dirichlet zero ends.
// Uses the standard explicit leapfrog scheme on a uniform grid; CFL
// condition r = c*dt/dx <= 1 is required for stability.
//
// Pure module used by the v7 Distributed Systems wave-equation demo.

export interface WaveStepInput {
  readonly uPrev: readonly number[];
  readonly uCurr: readonly number[];
  readonly c: number;
  readonly dx: number;
  readonly dt: number;
}

/** One leapfrog step.  Returns u^{n+1} given u^{n-1} and u^{n}. */
export function leapfrogStep(input: WaveStepInput): number[] {
  if (input.uPrev.length !== input.uCurr.length) {
    throw new RangeError("leapfrogStep: uPrev and uCurr must have the same length.");
  }
  const n = input.uCurr.length;
  if (n < 3) throw new RangeError("leapfrogStep: need at least 3 grid points.");
  if (!(input.c > 0 && Number.isFinite(input.c))) {
    throw new RangeError("leapfrogStep: c must be > 0.");
  }
  if (!(input.dx > 0 && Number.isFinite(input.dx))) {
    throw new RangeError("leapfrogStep: dx must be > 0.");
  }
  if (!(input.dt > 0 && Number.isFinite(input.dt))) {
    throw new RangeError("leapfrogStep: dt must be > 0.");
  }
  const r2 = ((input.c * input.dt) / input.dx) ** 2;
  const out = new Array<number>(n);
  out[0] = 0;
  out[n - 1] = 0;
  for (let i = 1; i < n - 1; i += 1) {
    out[i] =
      2 * input.uCurr[i]! -
      input.uPrev[i]! +
      r2 * (input.uCurr[i + 1]! - 2 * input.uCurr[i]! + input.uCurr[i - 1]!);
  }
  return out;
}

export interface FirstStepInput {
  readonly u0: readonly number[];
  readonly v0: readonly number[];
  readonly c: number;
  readonly dx: number;
  readonly dt: number;
}

/**
 * Special first step that uses the initial velocity v0 to advance
 * u^0 to u^1 without needing a phantom u^{-1}.
 *
 * Standard derivation:  u^1[i] = u^0[i] + dt * v0[i] + 0.5 * r^2 * (u0[i+1] - 2u0[i] + u0[i-1])
 */
export function firstStep(input: FirstStepInput): number[] {
  if (input.u0.length !== input.v0.length) {
    throw new RangeError("firstStep: u0 and v0 must have the same length.");
  }
  const n = input.u0.length;
  if (n < 3) throw new RangeError("firstStep: need at least 3 grid points.");
  if (!(input.c > 0)) throw new RangeError("firstStep: c must be > 0.");
  if (!(input.dx > 0)) throw new RangeError("firstStep: dx must be > 0.");
  if (!(input.dt > 0)) throw new RangeError("firstStep: dt must be > 0.");
  const r2 = ((input.c * input.dt) / input.dx) ** 2;
  const out = new Array<number>(n);
  out[0] = 0;
  out[n - 1] = 0;
  for (let i = 1; i < n - 1; i += 1) {
    out[i] =
      input.u0[i]! +
      input.dt * input.v0[i]! +
      0.5 * r2 * (input.u0[i + 1]! - 2 * input.u0[i]! + input.u0[i - 1]!);
  }
  return out;
}

/** CFL ratio r = c*dt/dx; stable iff r <= 1. */
export function cflRatio(c: number, dx: number, dt: number): number {
  return (c * dt) / dx;
}

export interface IntegrateWaveInput {
  readonly u0: readonly number[];
  readonly v0: readonly number[];
  readonly c: number;
  readonly dx: number;
  readonly dt: number;
  readonly nSteps: number;
}

/** Integrate the wave equation for nSteps and return final u. */
export function integrate(input: IntegrateWaveInput): number[] {
  if (!Number.isInteger(input.nSteps) || input.nSteps < 0) {
    throw new RangeError("integrate: nSteps must be a non-negative integer.");
  }
  if (input.nSteps === 0) return input.u0.slice();
  let prev = input.u0.slice();
  let curr = firstStep({
    u0: input.u0,
    v0: input.v0,
    c: input.c,
    dx: input.dx,
    dt: input.dt,
  });
  for (let s = 1; s < input.nSteps; s += 1) {
    const next = leapfrogStep({
      uPrev: prev,
      uCurr: curr,
      c: input.c,
      dx: input.dx,
      dt: input.dt,
    });
    prev = curr;
    curr = next;
  }
  return curr;
}

export interface AnalyticalStringInput {
  readonly L: number;
  readonly c: number;
  readonly t: number;
  readonly nGrid: number;
  readonly mode: number;
}

/**
 * Analytical standing-wave solution u(x,t) = sin(mπx/L) cos(c·mπ·t/L).
 *
 * Useful as a ground truth for the leapfrog integrator.
 */
export function analyticalStanding(input: AnalyticalStringInput): number[] {
  if (!(input.L > 0)) throw new RangeError("analyticalStanding: L must be > 0.");
  if (!(input.c > 0)) throw new RangeError("analyticalStanding: c must be > 0.");
  if (!Number.isInteger(input.nGrid) || input.nGrid < 3) {
    throw new RangeError("analyticalStanding: nGrid must be an integer >= 3.");
  }
  if (!Number.isInteger(input.mode) || input.mode < 1) {
    throw new RangeError("analyticalStanding: mode must be a positive integer.");
  }
  if (input.t < 0) throw new RangeError("analyticalStanding: t must be >= 0.");
  const k = (input.mode * Math.PI) / input.L;
  const omega = input.c * k;
  const out = new Array<number>(input.nGrid);
  for (let i = 0; i < input.nGrid; i += 1) {
    const x = (i / (input.nGrid - 1)) * input.L;
    out[i] = Math.sin(k * x) * Math.cos(omega * input.t);
  }
  return out;
}
