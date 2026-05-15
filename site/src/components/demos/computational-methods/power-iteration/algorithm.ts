/**
 * powerIteration — dominant-eigenvalue solver via Rayleigh-quotient iteration (#85).
 *
 * Computes the largest-magnitude eigenvalue λ₁ and a corresponding
 * eigenvector v₁ of a square real matrix A by repeating
 *
 *     v ← A·v
 *     v ← v / ‖v‖
 *     λ ← v·(A·v)             (Rayleigh quotient: x^T A x / x^T x)
 *
 * Converges geometrically with rate |λ₂/λ₁|; fails for matrices whose
 * top two eigenvalues have equal magnitude (e.g. ±λ).  We start from a
 * uniform vector by default; the React shell can override `initial`.
 */

export type Matrix = ReadonlyArray<ReadonlyArray<number>>;
export type Vector = ReadonlyArray<number>;

export interface PowerIterationInput {
  readonly A: Matrix;
  /** Optional initial vector. Must match A's dimension. */
  readonly initial?: Vector;
  /** L2 distance between successive normalised vectors. Default 1e-10. */
  readonly tol?: number;
  /** Maximum iterations. Default 1000. */
  readonly maxIterations?: number;
}

export interface PowerIterationResult {
  readonly eigenvalue: number;
  readonly eigenvector: number[];
  readonly iterations: number;
  readonly converged: boolean;
}

function assertSquare(A: Matrix): number {
  const n = A.length;
  if (n === 0) {
    throw new RangeError("powerIteration: matrix must be non-empty.");
  }
  for (const row of A) {
    if (row.length !== n) {
      throw new RangeError("powerIteration: matrix must be square.");
    }
    for (const v of row) {
      if (!Number.isFinite(v)) {
        throw new RangeError("powerIteration: matrix entries must be finite.");
      }
    }
  }
  return n;
}

function matVec(A: Matrix, x: Vector): number[] {
  const n = A.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = A[i]!;
    let s = 0;
    for (let j = 0; j < n; j += 1) {
      s += row[j]! * x[j]!;
    }
    out[i] = s;
  }
  return out;
}

function dot(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i]! * b[i]!;
  return s;
}

function norm(x: Vector): number {
  return Math.sqrt(dot(x, x));
}

function normalise(x: Vector): number[] {
  const m = norm(x);
  if (m === 0) {
    throw new RangeError("powerIteration: zero vector cannot be normalised.");
  }
  return x.map((v) => v / m);
}

function l2Diff(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return Math.sqrt(s);
}

export function powerIteration(input: PowerIterationInput): PowerIterationResult {
  const n = assertSquare(input.A);
  const tol = input.tol ?? 1e-10;
  const maxIterations = input.maxIterations ?? 1000;
  if (!(tol > 0) || !Number.isFinite(tol)) {
    throw new RangeError("powerIteration: tol must be > 0 and finite.");
  }
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new RangeError("powerIteration: maxIterations must be a positive integer.");
  }

  const initial: Vector = input.initial
    ? input.initial
    : new Array<number>(n).fill(1 / Math.sqrt(n));
  if (initial.length !== n) {
    throw new RangeError("powerIteration: initial vector must match matrix dimension.");
  }
  if (norm(initial) === 0) {
    throw new RangeError("powerIteration: initial vector cannot be zero.");
  }

  let v: number[] = normalise(initial);
  let converged = false;
  let iterations = 0;
  // Sign convention: align successive iterates so we converge to a unique
  // representative even when λ < 0 (where v ↦ −v alternates sign).
  for (let i = 0; i < maxIterations; i += 1) {
    iterations = i + 1;
    const Av = matVec(input.A, v);
    const norm_Av = norm(Av);
    if (norm_Av === 0) {
      // v is in the null space of A; eigenvalue is 0.
      return { eigenvalue: 0, eigenvector: v.slice(), iterations, converged: true };
    }
    let next = Av.map((x) => x / norm_Av);
    // Flip sign if needed to align with previous iterate.
    if (dot(next, v) < 0) next = next.map((x) => -x);
    if (l2Diff(next, v) < tol) {
      v = next;
      converged = true;
      break;
    }
    v = next;
  }

  // Rayleigh quotient: λ = v^T A v / v^T v  (denominator = 1 since v is unit).
  const Av = matVec(input.A, v);
  const eigenvalue = dot(v, Av);
  return { eigenvalue, eigenvector: v.slice(), iterations, converged };
}
