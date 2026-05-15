/**
 * markovChain — discrete-time finite-state chains (#66 v4 hero).
 *
 * Operates on row-stochastic transition matrices: P[i][j] is the probability
 * of moving from state i to state j. State distributions are row vectors;
 * one step is `pi_next = pi @ P`.
 *
 * Stationary distribution is found via power iteration with a strict
 * L1 convergence tolerance; the demo can stop early when the change drops
 * below `tol` between iterations, otherwise it caps at `maxIterations`.
 */

export type Matrix = ReadonlyArray<ReadonlyArray<number>>;
export type Vector = ReadonlyArray<number>;

const DEFAULT_TOL = 1e-12;
const DEFAULT_MAX_ITER = 10_000;

export interface StationaryInput {
  readonly P: Matrix;
  readonly tol?: number;
  readonly maxIterations?: number;
}

export interface StationaryResult {
  readonly distribution: number[];
  readonly iterations: number;
  readonly converged: boolean;
}

export function isStochastic(P: Matrix, tol = 1e-9): boolean {
  if (P.length === 0) return false;
  const n = P.length;
  for (const row of P) {
    if (row.length !== n) return false;
    let s = 0;
    for (const p of row) {
      if (!Number.isFinite(p) || p < 0) return false;
      s += p;
    }
    if (Math.abs(s - 1) > tol) return false;
  }
  return true;
}

function assertStochastic(P: Matrix): void {
  if (!isStochastic(P)) {
    throw new RangeError(
      "markovChain: P must be square, row-stochastic, with non-negative entries.",
    );
  }
}

function assertDistribution(pi: Vector, n: number): void {
  if (pi.length !== n) {
    throw new RangeError("markovChain: distribution length must match P size.");
  }
  let s = 0;
  for (const p of pi) {
    if (!Number.isFinite(p) || p < 0) {
      throw new RangeError("markovChain: distribution entries must be finite and >= 0.");
    }
    s += p;
  }
  if (Math.abs(s - 1) > 1e-9) {
    throw new RangeError("markovChain: distribution must sum to 1.");
  }
}

export function step(pi: Vector, P: Matrix): number[] {
  assertStochastic(P);
  assertDistribution(pi, P.length);
  const n = P.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const pii = pi[i]!;
    if (pii === 0) continue;
    const row = P[i]!;
    for (let j = 0; j < n; j += 1) {
      out[j]! += pii * row[j]!;
    }
  }
  return out;
}

export function nStep(pi: Vector, P: Matrix, n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("markovChain: n must be a non-negative integer.");
  }
  let curr: Vector = pi.slice();
  for (let i = 0; i < n; i += 1) {
    curr = step(curr, P);
  }
  return curr.slice();
}

function l1Diff(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i]! - b[i]!);
  return s;
}

export function stationary(input: StationaryInput): StationaryResult {
  assertStochastic(input.P);
  const P = input.P;
  const n = P.length;
  const tol = input.tol ?? DEFAULT_TOL;
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITER;
  if (tol <= 0 || !Number.isFinite(tol)) {
    throw new RangeError("stationary: tol must be > 0 and finite.");
  }
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new RangeError("stationary: maxIterations must be a positive integer.");
  }

  // Start from the uniform distribution; this is a reasonable seed for any
  // ergodic chain and the natural choice when we have no prior information.
  let curr: Vector = new Array<number>(n).fill(1 / n);
  let converged = false;
  let iterations = 0;
  for (let i = 0; i < maxIterations; i += 1) {
    const next = step(curr, P);
    iterations = i + 1;
    if (l1Diff(curr, next) < tol) {
      curr = next;
      converged = true;
      break;
    }
    curr = next;
  }
  return { distribution: curr.slice(), iterations, converged };
}
