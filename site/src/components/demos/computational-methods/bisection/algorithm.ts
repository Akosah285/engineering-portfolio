/**
 * bisection — pure 1D root finder via interval bisection (#78).
 *
 * Caller MUST supply a valid bracket [a, b] with f(a) * f(b) < 0
 * (or one endpoint be exactly zero). We return the full sequence of
 * brackets so the React shell can render the shrinking interval.
 */

export interface BisectionInput {
  readonly f: (x: number) => number;
  readonly a: number;
  readonly b: number;
  readonly tolerance: number;
  readonly maxIterations: number;
}

export type BisectionStatus = "converged" | "max-iterations";

export type Bracket = readonly [number, number];

export interface BisectionResult {
  readonly status: BisectionStatus;
  readonly root: number | null;
  readonly brackets: readonly Bracket[];
}

export function bisection(input: BisectionInput): BisectionResult {
  if (input.maxIterations <= 0) {
    throw new RangeError("bisection: maxIterations must be > 0.");
  }
  if (input.tolerance <= 0) {
    throw new RangeError("bisection: tolerance must be > 0.");
  }
  if (input.a === input.b) {
    throw new RangeError("bisection: bracket endpoints must differ.");
  }

  const { f, tolerance, maxIterations } = input;
  let lo = Math.min(input.a, input.b);
  let hi = Math.max(input.a, input.b);
  let fLo = f(lo);
  let fHi = f(hi);

  // Endpoint already a root?
  if (Math.abs(fLo) < tolerance) {
    return { status: "converged", root: lo, brackets: [[lo, hi]] };
  }
  if (Math.abs(fHi) < tolerance) {
    return { status: "converged", root: hi, brackets: [[lo, hi]] };
  }

  if (fLo * fHi > 0) {
    throw new Error(
      "bisection: f(a) and f(b) must have opposite signs (or one be zero).",
    );
  }

  const brackets: Bracket[] = [[lo, hi]];

  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) {
      brackets.push([mid, mid]);
      return { status: "converged", root: mid, brackets };
    }
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    brackets.push([lo, hi]);
  }

  return { status: "max-iterations", root: null, brackets };
}
