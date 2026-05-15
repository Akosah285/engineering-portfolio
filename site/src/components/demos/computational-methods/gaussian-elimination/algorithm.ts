// Gaussian elimination with partial pivoting + back substitution.
// Produces the upper-triangular trace step-by-step so the v5 demo can
// animate row operations.  Pure math, no React.

export type Matrix = readonly (readonly number[])[];
export type Vector = readonly number[];

export type RowOpKind = "swap" | "eliminate" | "scale";

export interface RowOp {
  readonly kind: RowOpKind;
  readonly i: number;
  readonly j: number;
  readonly factor?: number;
}

export interface EliminationStep {
  readonly op: RowOp;
  readonly matrixAfter: number[][];
  readonly rhsAfter: number[];
}

export interface SolveResult {
  readonly U: number[][];
  readonly y: number[];
  readonly x: number[];
  readonly steps: EliminationStep[];
  readonly singular: boolean;
}

const TINY = 1e-12;

function clone2D(M: Matrix): number[][] {
  return M.map((row) => row.slice());
}

/**
 * Solve Ax = b with Gaussian elimination + partial pivoting.
 *
 * Returns the augmented upper-triangular form, the right-hand-side
 * after elimination, the back-substituted solution, the full sequence
 * of row operations performed, and a `singular` flag set when a pivot
 * with magnitude below TINY is encountered.
 *
 * For singular systems the returned `x` array is filled with NaN so
 * callers can short-circuit visualization without crashing.
 */
export function solve(A: Matrix, b: Vector): SolveResult {
  const n = A.length;
  if (n === 0) throw new RangeError("solve: A must be a non-empty matrix.");
  for (let i = 0; i < n; i += 1) {
    if (A[i]!.length !== n) throw new RangeError("solve: A must be square.");
  }
  if (b.length !== n) throw new RangeError("solve: b must have the same length as A.");
  const U = clone2D(A);
  const y = b.slice();
  const steps: EliminationStep[] = [];
  let singular = false;
  for (let k = 0; k < n; k += 1) {
    // Partial pivot: find row with max |U[r][k]| for r in [k, n)
    let maxRow = k;
    let maxVal = Math.abs(U[k]![k]!);
    for (let r = k + 1; r < n; r += 1) {
      const v = Math.abs(U[r]![k]!);
      if (v > maxVal) {
        maxVal = v;
        maxRow = r;
      }
    }
    if (maxVal < TINY) {
      singular = true;
      break;
    }
    if (maxRow !== k) {
      const tmp = U[k]!;
      U[k] = U[maxRow]!;
      U[maxRow] = tmp;
      const ty = y[k]!;
      y[k] = y[maxRow]!;
      y[maxRow] = ty;
      steps.push({
        op: { kind: "swap", i: k, j: maxRow },
        matrixAfter: clone2D(U),
        rhsAfter: y.slice(),
      });
    }
    // Eliminate below the pivot
    const pivot = U[k]![k]!;
    for (let r = k + 1; r < n; r += 1) {
      const factor = U[r]![k]! / pivot;
      if (factor === 0) continue;
      for (let c = k; c < n; c += 1) {
        U[r]![c] = U[r]![c]! - factor * U[k]![c]!;
      }
      y[r] = y[r]! - factor * y[k]!;
      steps.push({
        op: { kind: "eliminate", i: r, j: k, factor },
        matrixAfter: clone2D(U),
        rhsAfter: y.slice(),
      });
    }
  }
  const x = new Array<number>(n).fill(0);
  if (singular) {
    for (let i = 0; i < n; i += 1) x[i] = Number.NaN;
    return { U, y, x, steps, singular };
  }
  // Back substitution
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = y[i]!;
    for (let j = i + 1; j < n; j += 1) s -= U[i]![j]! * x[j]!;
    x[i] = s / U[i]![i]!;
  }
  return { U, y, x, steps, singular };
}

/** Multiply A x and return the result, useful for residual checks in tests. */
export function matVec(A: Matrix, x: Vector): number[] {
  const n = A.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let s = 0;
    for (let j = 0; j < n; j += 1) s += A[i]![j]! * x[j]!;
    out[i] = s;
  }
  return out;
}
