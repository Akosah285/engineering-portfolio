// LU decomposition with partial pivoting (Doolittle form: L unit-lower, U upper).
// Used by the v5 Computational Methods LU demo + reused by anything needing
// repeated solves with the same A.
//
// PA = LU.  L has 1's on the diagonal, U is upper triangular, P encoded as
// a permutation array (perm[i] = original row now living at row i).

export type Matrix = readonly (readonly number[])[];

export interface LUResult {
  readonly L: number[][];
  readonly U: number[][];
  readonly perm: number[];
  readonly sign: 1 | -1;
  readonly singular: boolean;
}

const TINY = 1e-12;

function clone2D(M: Matrix): number[][] {
  return M.map((row) => row.slice());
}

function eye(n: number): number[][] {
  const I: number[][] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = new Array<number>(n).fill(0);
    row[i] = 1;
    I[i] = row;
  }
  return I;
}

/**
 * Compute PA = LU.  Returns L (unit lower), U (upper), perm (row indices),
 * sign of the permutation (useful for det(A) = sign * prod(diag(U))),
 * and a singular flag set when the column has no usable pivot.
 *
 * Singular matrices return the partially-factored L, U, perm with the
 * remaining columns left as the working snapshot for the demo to render.
 */
export function decompose(A: Matrix): LUResult {
  const n = A.length;
  if (n === 0) throw new RangeError("decompose: A must be non-empty.");
  for (let i = 0; i < n; i += 1) {
    if (A[i]!.length !== n) throw new RangeError("decompose: A must be square.");
  }
  const U = clone2D(A);
  const L = eye(n);
  const perm: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) perm[i] = i;
  let sign: 1 | -1 = 1;
  let singular = false;
  for (let k = 0; k < n; k += 1) {
    // Partial pivot
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
      continue;
    }
    if (maxRow !== k) {
      const tmpU = U[k]!;
      U[k] = U[maxRow]!;
      U[maxRow] = tmpU;
      const tmpP = perm[k]!;
      perm[k] = perm[maxRow]!;
      perm[maxRow] = tmpP;
      // Swap L's already-computed sub-diagonal entries (cols < k)
      for (let c = 0; c < k; c += 1) {
        const tmpL = L[k]![c]!;
        L[k]![c] = L[maxRow]![c]!;
        L[maxRow]![c] = tmpL;
      }
      sign = sign === 1 ? -1 : 1;
    }
    const pivot = U[k]![k]!;
    for (let r = k + 1; r < n; r += 1) {
      const factor = U[r]![k]! / pivot;
      L[r]![k] = factor;
      for (let c = k; c < n; c += 1) {
        U[r]![c] = U[r]![c]! - factor * U[k]![c]!;
      }
    }
  }
  return { L, U, perm, sign, singular };
}

export interface SolveLUInput {
  readonly lu: LUResult;
  readonly b: readonly number[];
}

/** Solve PAx = Pb given a precomputed LU factorization. */
export function solveWithLU(input: SolveLUInput): number[] {
  const n = input.lu.L.length;
  if (input.b.length !== n) throw new RangeError("solveWithLU: b length must match L size.");
  if (input.lu.singular) {
    const out = new Array<number>(n).fill(Number.NaN);
    return out;
  }
  // Apply permutation: Pb
  const pb = new Array<number>(n);
  for (let i = 0; i < n; i += 1) pb[i] = input.b[input.lu.perm[i]!]!;
  // Forward solve Ly = Pb
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let s = pb[i]!;
    for (let j = 0; j < i; j += 1) s -= input.lu.L[i]![j]! * y[j]!;
    y[i] = s; // L is unit lower, no division needed
  }
  // Back solve Ux = y
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = y[i]!;
    for (let j = i + 1; j < n; j += 1) s -= input.lu.U[i]![j]! * x[j]!;
    x[i] = s / input.lu.U[i]![i]!;
  }
  return x;
}

/** Determinant via the LU sign and the diagonal of U. */
export function determinantFromLU(lu: LUResult): number {
  if (lu.singular) return 0;
  let d: number = lu.sign;
  for (let i = 0; i < lu.U.length; i += 1) d *= lu.U[i]![i]!;
  return d;
}
