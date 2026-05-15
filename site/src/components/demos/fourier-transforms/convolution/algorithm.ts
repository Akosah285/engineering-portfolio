// Discrete linear convolution + a few canonical signal generators used by
// the v3 Fourier convolution demo.  Pure math, no React.

export type Sample = { t: number; value: number };

export interface ConvolveInput {
  readonly f: readonly number[];
  readonly g: readonly number[];
  readonly dt?: number;
}

/**
 * Discrete linear convolution h[n] = sum_k f[k] g[n-k].
 *
 * Output length is f.length + g.length - 1.  When `dt` is provided the
 * sum is multiplied by dt so the result approximates the continuous
 * convolution integral with rectangle-rule accuracy.
 *
 * Complexity: O(|f| * |g|).  The demo never exceeds a few hundred
 * samples so the naive double loop is fine.
 */
export function convolve(input: ConvolveInput): number[] {
  if (!Array.isArray(input.f) || !Array.isArray(input.g)) {
    throw new RangeError("convolve: f and g must be arrays of numbers.");
  }
  if (input.dt !== undefined && (!Number.isFinite(input.dt) || input.dt <= 0)) {
    throw new RangeError("convolve: dt must be a positive finite number.");
  }
  const f = input.f;
  const g = input.g;
  if (f.length === 0 || g.length === 0) return [];
  const N = f.length + g.length - 1;
  const out = new Array<number>(N).fill(0);
  for (let n = 0; n < N; n += 1) {
    const kMin = Math.max(0, n - (g.length - 1));
    const kMax = Math.min(f.length - 1, n);
    let acc = 0;
    for (let k = kMin; k <= kMax; k += 1) {
      acc += f[k]! * g[n - k]!;
    }
    out[n] = acc;
  }
  if (input.dt !== undefined) {
    const dt = input.dt;
    for (let i = 0; i < N; i += 1) out[i] = out[i]! * dt;
  }
  return out;
}

export interface RectInput {
  readonly width: number;
  readonly height: number;
  readonly nSamples: number;
  readonly tMin: number;
  readonly tMax: number;
  readonly center?: number;
}

/** Sampled rectangular pulse of given width centered at `center` (default 0). */
export function rect(input: RectInput): Sample[] {
  if (input.width <= 0 || !Number.isFinite(input.width)) {
    throw new RangeError("rect: width must be > 0.");
  }
  if (!Number.isInteger(input.nSamples) || input.nSamples < 2) {
    throw new RangeError("rect: nSamples must be an integer >= 2.");
  }
  if (input.tMax <= input.tMin) {
    throw new RangeError("rect: tMax must be > tMin.");
  }
  const c = input.center ?? 0;
  const half = input.width / 2;
  const out: Sample[] = new Array(input.nSamples);
  for (let i = 0; i < input.nSamples; i += 1) {
    const t = input.tMin + (i / (input.nSamples - 1)) * (input.tMax - input.tMin);
    out[i] = { t, value: Math.abs(t - c) <= half ? input.height : 0 };
  }
  return out;
}

export interface ExpDecayInput {
  readonly tau: number;
  readonly nSamples: number;
  readonly tMin: number;
  readonly tMax: number;
}

/** Causal exponential decay: e^{-t/tau} for t>=0, 0 otherwise. */
export function expDecay(input: ExpDecayInput): Sample[] {
  if (input.tau <= 0 || !Number.isFinite(input.tau)) {
    throw new RangeError("expDecay: tau must be > 0.");
  }
  if (!Number.isInteger(input.nSamples) || input.nSamples < 2) {
    throw new RangeError("expDecay: nSamples must be an integer >= 2.");
  }
  if (input.tMax <= input.tMin) {
    throw new RangeError("expDecay: tMax must be > tMin.");
  }
  const out: Sample[] = new Array(input.nSamples);
  for (let i = 0; i < input.nSamples; i += 1) {
    const t = input.tMin + (i / (input.nSamples - 1)) * (input.tMax - input.tMin);
    out[i] = { t, value: t < 0 ? 0 : Math.exp(-t / input.tau) };
  }
  return out;
}

/** Sum of a numeric array (helper, used in tests + by the React shell). */
export function sum(xs: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < xs.length; i += 1) s += xs[i]!;
  return s;
}
