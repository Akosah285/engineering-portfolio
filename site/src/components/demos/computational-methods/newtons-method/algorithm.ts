/**
 * newtonsMethod — pure 1D root finder via Newton's iteration (#77).
 *
 * Returns the full iterate trace so the React shell can render the
 * tangent-line steps. Status enum makes outcome handling explicit
 * (the demo will colour iterates by outcome).
 */

export interface NewtonInput {
  /** The function f whose zero we want. */
  readonly f: (x: number) => number;
  /** The derivative f' (we leave numeric differentiation to the caller). */
  readonly df: (x: number) => number;
  readonly x0: number;
  readonly tolerance: number;
  readonly maxIterations: number;
}

export type NewtonStatus = "converged" | "diverged" | "max-iterations";

export interface NewtonResult {
  readonly status: NewtonStatus;
  readonly root: number | null;
  readonly iterates: readonly number[];
}

const DERIVATIVE_EPSILON = 1e-15;

export function newtonsMethod(input: NewtonInput): NewtonResult {
  if (input.maxIterations <= 0) {
    throw new RangeError("newtonsMethod: maxIterations must be > 0.");
  }
  if (input.tolerance <= 0) {
    throw new RangeError("newtonsMethod: tolerance must be > 0.");
  }

  const { f, df, x0, tolerance, maxIterations } = input;
  const iterates: number[] = [x0];

  // Already at a root?
  if (Math.abs(f(x0)) < tolerance) {
    return { status: "converged", root: x0, iterates };
  }

  // Bad seed (horizontal tangent immediately)
  if (Math.abs(df(x0)) < DERIVATIVE_EPSILON) {
    return { status: "diverged", root: null, iterates };
  }

  let x = x0;
  for (let i = 0; i < maxIterations; i += 1) {
    const slope = df(x);
    if (!Number.isFinite(slope) || Math.abs(slope) < DERIVATIVE_EPSILON) {
      return { status: "diverged", root: null, iterates };
    }
    const next = x - f(x) / slope;
    if (!Number.isFinite(next)) {
      return { status: "diverged", root: null, iterates };
    }
    iterates.push(next);
    if (Math.abs(f(next)) < tolerance) {
      return { status: "converged", root: next, iterates };
    }
    x = next;
  }

  return { status: "max-iterations", root: null, iterates };
}
