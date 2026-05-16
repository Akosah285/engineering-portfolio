// Monte Carlo integration over [a, b] (1D) and over a bounding box (2D).
// Estimates ∫ f dx ≈ (volume) * (1/N) Σ f(x_i)  with x_i ~ U(box).
//
// Returns mean estimate + 95% confidence half-width via sample variance:
//   CI half-width = 1.96 * s / √N  (Strang CSE §3.6).

export interface MC1DInput {
  readonly f: (x: number) => number;
  readonly a: number;
  readonly b: number;
  readonly n: number;
  readonly rng?: () => number;
}

export interface MCResult {
  readonly estimate: number;
  readonly stdError: number;
  readonly ci95HalfWidth: number;
  readonly samples: number;
}

function validate1D({ a, b, n }: { a: number; b: number; n: number }): void {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new RangeError("a, b must be finite");
  }
  if (a >= b) throw new RangeError("a must be < b");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n must be a positive integer");
}

export function integrate1D(input: MC1DInput): MCResult {
  validate1D(input);
  const rng = input.rng ?? Math.random;
  const w = input.b - input.a;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < input.n; i += 1) {
    const x = input.a + w * rng();
    const v = input.f(x);
    if (!Number.isFinite(v)) {
      throw new RangeError("integrand returned non-finite value");
    }
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / input.n;
  const variance = sumSq / input.n - mean * mean;
  const stdError = w * Math.sqrt(Math.max(0, variance) / input.n);
  return {
    estimate: w * mean,
    stdError,
    ci95HalfWidth: 1.96 * stdError,
    samples: input.n,
  };
}

export interface MC2DInput {
  readonly f: (x: number, y: number) => number;
  readonly ax: number;
  readonly bx: number;
  readonly ay: number;
  readonly by: number;
  readonly n: number;
  readonly rng?: () => number;
}

export function integrate2D(input: MC2DInput): MCResult {
  const { ax, bx, ay, by, n, f } = input;
  validate1D({ a: ax, b: bx, n });
  validate1D({ a: ay, b: by, n });
  const rng = input.rng ?? Math.random;
  const wx = bx - ax;
  const wy = by - ay;
  const area = wx * wy;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const x = ax + wx * rng();
    const y = ay + wy * rng();
    const v = f(x, y);
    if (!Number.isFinite(v)) throw new RangeError("integrand returned non-finite value");
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdError = area * Math.sqrt(Math.max(0, variance) / n);
  return {
    estimate: area * mean,
    stdError,
    ci95HalfWidth: 1.96 * stdError,
    samples: n,
  };
}
