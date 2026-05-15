// 1D heat equation solver with a few canonical analytical solutions.
// Used by the v7 Distributed Systems heat-equation demo.
//
// PDE:  u_t = alpha * u_xx,  0 <= x <= L,  with Dirichlet u(0,t)=u(L,t)=0.
//
// Numerical scheme: explicit forward-time central-space (FTCS) Euler.
// Stability requires r = alpha * dt / dx^2 <= 0.5.

export interface HeatStepInput {
  readonly u: readonly number[];
  readonly alpha: number;
  readonly dx: number;
  readonly dt: number;
}

/** One explicit Euler step of u_t = alpha * u_xx with Dirichlet zero ends. */
export function ftcsStep(input: HeatStepInput): number[] {
  if (input.u.length < 3) throw new RangeError("ftcsStep: need at least 3 grid points.");
  if (!(input.alpha > 0 && Number.isFinite(input.alpha))) {
    throw new RangeError("ftcsStep: alpha must be > 0.");
  }
  if (!(input.dx > 0 && Number.isFinite(input.dx))) {
    throw new RangeError("ftcsStep: dx must be > 0.");
  }
  if (!(input.dt > 0 && Number.isFinite(input.dt))) {
    throw new RangeError("ftcsStep: dt must be > 0.");
  }
  const r = (input.alpha * input.dt) / (input.dx * input.dx);
  const n = input.u.length;
  const out = new Array<number>(n);
  out[0] = 0;
  out[n - 1] = 0;
  for (let i = 1; i < n - 1; i += 1) {
    out[i] = input.u[i]! + r * (input.u[i + 1]! - 2 * input.u[i]! + input.u[i - 1]!);
  }
  return out;
}

/** Stability ratio r for the FTCS scheme. */
export function stabilityRatio(alpha: number, dx: number, dt: number): number {
  return (alpha * dt) / (dx * dx);
}

export interface AnalyticalInput {
  readonly L: number;
  readonly alpha: number;
  readonly t: number;
  readonly nGrid: number;
  readonly mode: number;
}

/**
 * Single-mode separable solution: u(x,t) = sin(m π x / L) * exp(-alpha (mπ/L)^2 t).
 *
 * Useful as a ground truth: FTCS evolution of this initial condition
 * should match the analytical decay essentially perfectly.
 */
export function analyticalMode(input: AnalyticalInput): number[] {
  if (!(input.L > 0)) throw new RangeError("analyticalMode: L must be > 0.");
  if (!(input.alpha > 0)) throw new RangeError("analyticalMode: alpha must be > 0.");
  if (!Number.isInteger(input.nGrid) || input.nGrid < 3) {
    throw new RangeError("analyticalMode: nGrid must be an integer >= 3.");
  }
  if (!Number.isInteger(input.mode) || input.mode < 1) {
    throw new RangeError("analyticalMode: mode must be a positive integer.");
  }
  if (input.t < 0) throw new RangeError("analyticalMode: t must be >= 0.");
  const out = new Array<number>(input.nGrid);
  const k = (input.mode * Math.PI) / input.L;
  const decay = Math.exp(-input.alpha * k * k * input.t);
  for (let i = 0; i < input.nGrid; i += 1) {
    const x = (i / (input.nGrid - 1)) * input.L;
    out[i] = Math.sin(k * x) * decay;
  }
  return out;
}

export interface IntegrateInput {
  readonly initial: readonly number[];
  readonly alpha: number;
  readonly dx: number;
  readonly dt: number;
  readonly nSteps: number;
}

/** Integrate FTCS for nSteps and return the final u. */
export function integrate(input: IntegrateInput): number[] {
  if (!Number.isInteger(input.nSteps) || input.nSteps < 0) {
    throw new RangeError("integrate: nSteps must be a non-negative integer.");
  }
  let u = input.initial.slice();
  for (let s = 0; s < input.nSteps; s += 1) {
    u = ftcsStep({ u, alpha: input.alpha, dx: input.dx, dt: input.dt });
  }
  return u;
}
