// Birthday-paradox math: exact collision probability + asymptotic
// approximations + smallest n needed for a target probability.
// Pure module used by the v4 Discrete & Probability demo.

export interface BirthdayInput {
  readonly n: number;
  readonly daysInYear?: number;
}

/**
 * Exact probability that at least two of n people share a birthday in a
 * year of D equally-likely days.
 *
 * Computed in log space so it stays numerically stable for large n / D.
 */
export function exactCollisionProbability(input: BirthdayInput): number {
  const D = input.daysInYear ?? 365;
  if (!Number.isInteger(input.n) || input.n < 0) {
    throw new RangeError("exactCollisionProbability: n must be a non-negative integer.");
  }
  if (!Number.isInteger(D) || D < 1) {
    throw new RangeError(
      "exactCollisionProbability: daysInYear must be a positive integer.",
    );
  }
  if (input.n <= 1) return 0;
  if (input.n > D) return 1;
  let logP = 0;
  for (let k = 1; k < input.n; k += 1) {
    logP += Math.log1p(-k / D);
  }
  return 1 - Math.exp(logP);
}

/**
 * Standard 1 - exp(-n(n-1)/(2D)) approximation.  Useful for showing how
 * the exact curve and the asymptotic curve diverge for tiny n and
 * essentially agree past about n = 10.
 */
export function approximateCollisionProbability(input: BirthdayInput): number {
  const D = input.daysInYear ?? 365;
  if (!Number.isInteger(input.n) || input.n < 0) {
    throw new RangeError(
      "approximateCollisionProbability: n must be a non-negative integer.",
    );
  }
  if (!Number.isInteger(D) || D < 1) {
    throw new RangeError(
      "approximateCollisionProbability: daysInYear must be a positive integer.",
    );
  }
  if (input.n <= 1) return 0;
  return 1 - Math.exp((-input.n * (input.n - 1)) / (2 * D));
}

export interface SmallestNInput {
  readonly target: number;
  readonly daysInYear?: number;
  readonly nMax?: number;
}

/**
 * Smallest n such that the exact collision probability is at least `target`.
 *
 * For target=0.5, daysInYear=365 this returns 23 (the textbook answer).
 */
export function smallestNForProbability(input: SmallestNInput): number {
  if (!(input.target >= 0 && input.target <= 1)) {
    throw new RangeError("smallestNForProbability: target must be in [0,1].");
  }
  const D = input.daysInYear ?? 365;
  const cap = input.nMax ?? D + 1;
  if (!Number.isInteger(D) || D < 1) {
    throw new RangeError(
      "smallestNForProbability: daysInYear must be a positive integer.",
    );
  }
  if (!Number.isInteger(cap) || cap < 1) {
    throw new RangeError("smallestNForProbability: nMax must be a positive integer.");
  }
  if (input.target === 0) return 0;
  for (let n = 2; n <= cap; n += 1) {
    if (exactCollisionProbability({ n, daysInYear: D }) >= input.target) return n;
  }
  return cap;
}

export interface CurvePoint {
  readonly n: number;
  readonly exact: number;
  readonly approx: number;
}

/** Build the comparison curve (exact vs approximate) from n=1..nMax. */
export function curve(nMax: number, daysInYear = 365): CurvePoint[] {
  if (!Number.isInteger(nMax) || nMax < 1) {
    throw new RangeError("curve: nMax must be a positive integer.");
  }
  const out: CurvePoint[] = new Array(nMax);
  for (let n = 1; n <= nMax; n += 1) {
    out[n - 1] = {
      n,
      exact: exactCollisionProbability({ n, daysInYear }),
      approx: approximateCollisionProbability({ n, daysInYear }),
    };
  }
  return out;
}
