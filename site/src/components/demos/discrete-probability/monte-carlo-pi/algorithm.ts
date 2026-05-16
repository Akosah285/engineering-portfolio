/**
 * monteCarloPi — π estimation by random sampling in the unit square (#74).
 *
 * Throws darts into [0,1]² and counts how many fall inside the quarter-disc
 * x²+y² ≤ 1.  The ratio (inside / total) ≈ π/4, so π̂ = 4·inside/total.
 *
 * Uses a seeded Mulberry32 PRNG so the demo is fully deterministic — the
 * React shell can replay the same trajectory of samples for animation.
 *
 * The 95% confidence half-width for π̂ is roughly 4·√(p(1−p)/n) where
 * p ≈ π/4; that's ≈ 1.6/√n. We expose `standardError` so the React shell
 * can plot ±2σ error bars alongside the running estimate.
 */

export interface PiEstimateInput {
  /** Number of samples. Must be a positive integer. */
  readonly samples: number;
  /** PRNG seed (any 32-bit unsigned integer). */
  readonly seed: number;
}

export interface PiEstimateResult {
  /** Estimated π. */
  readonly estimate: number;
  /** Number of samples that fell inside the quarter-disc. */
  readonly inside: number;
  /** Total samples used. */
  readonly total: number;
  /** Standard error of π̂ (one-sigma). */
  readonly standardError: number;
}

/**
 * Mulberry32 — small, fast, well-distributed 32-bit PRNG. Returns a function
 * that yields the next uniform [0, 1) value on each call. Pure-JS, no deps.
 */
export function mulberry32(seed: number): () => number {
  if (!Number.isFinite(seed)) {
    throw new RangeError("mulberry32: seed must be finite.");
  }
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function estimatePi(input: PiEstimateInput): PiEstimateResult {
  if (!Number.isInteger(input.samples) || input.samples <= 0) {
    throw new RangeError("monteCarloPi: samples must be a positive integer.");
  }
  const rand = mulberry32(input.seed);
  let inside = 0;
  for (let i = 0; i < input.samples; i += 1) {
    const x = rand();
    const y = rand();
    if (x * x + y * y <= 1) inside += 1;
  }
  const total = input.samples;
  const estimate = (4 * inside) / total;
  // SE for 4·p̂ where p̂ = inside/total has variance p(1-p)/n; multiply by 4.
  const p = inside / total;
  const standardError = 4 * Math.sqrt((p * (1 - p)) / total);
  return { estimate, inside, total, standardError };
}

/**
 * Same input as `estimatePi` but returns the running estimate at each step.
 * Useful for the React shell's progressive convergence animation.
 */
export function runningEstimate(input: PiEstimateInput): number[] {
  if (!Number.isInteger(input.samples) || input.samples <= 0) {
    throw new RangeError("monteCarloPi: samples must be a positive integer.");
  }
  const rand = mulberry32(input.seed);
  const out: number[] = new Array(input.samples);
  let inside = 0;
  for (let i = 0; i < input.samples; i += 1) {
    const x = rand();
    const y = rand();
    if (x * x + y * y <= 1) inside += 1;
    out[i] = (4 * inside) / (i + 1);
  }
  return out;
}
