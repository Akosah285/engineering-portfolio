// Epicycle drawing — discrete Fourier coefficients of a closed parametric path.
// Reference: 3Blue1Brown's "But what is a Fourier series?" + Bracewell §3.
//
// Given N sample points along a closed contour z[n] = x[n] + i*y[n], the DFT
// produces N complex coefficients C[k]. Reconstruction at time t (0..1) is
//   z(t) = sum over k of C[k] * exp(i * 2π * freq[k] * t)
// where freq[k] are integer frequencies arranged so the largest |C[k]| draw first.

export interface Complex {
  re: number;
  im: number;
}

export interface Epicycle {
  freq: number;
  amp: number;
  phase: number;
  coeff: Complex;
}

const TAU = Math.PI * 2;

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

export function cAbs(z: Complex): number {
  return Math.hypot(z.re, z.im);
}

export function cArg(z: Complex): number {
  return Math.atan2(z.im, z.re);
}

// Naive DFT (O(N^2)) — good enough for N ≤ 512 typical for epicycle demos.
export function dft(samples: Complex[]): Complex[] {
  if (samples.length === 0) {
    throw new RangeError("dft: samples must be non-empty");
  }
  const N = samples.length;
  const out: Complex[] = new Array(N);
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (-TAU * k * n) / N;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      re += samples[n]!.re * c - samples[n]!.im * s;
      im += samples[n]!.re * s + samples[n]!.im * c;
    }
    out[k] = { re: re / N, im: im / N };
  }
  return out;
}

// Convert DFT bins (indices 0..N-1) to centered frequencies (-N/2..N/2-1).
// Returns epicycles sorted by descending amplitude so largest circles draw first.
export function buildEpicycles(coeffs: Complex[]): Epicycle[] {
  if (coeffs.length === 0) {
    throw new RangeError("buildEpicycles: coeffs must be non-empty");
  }
  const N = coeffs.length;
  const half = Math.floor(N / 2);
  const eps: Epicycle[] = [];
  for (let k = 0; k < N; k++) {
    const freq = k <= half ? k : k - N;
    const c = coeffs[k]!;
    eps.push({
      freq,
      amp: cAbs(c),
      phase: cArg(c),
      coeff: c,
    });
  }
  eps.sort((a, b) => b.amp - a.amp);
  return eps;
}

// Evaluate the partial reconstruction at parameter t ∈ [0,1] using the first
// `numTerms` epicycles. Returns the full chain of joint positions plus the tip.
export function epicycleChain(
  eps: Epicycle[],
  t: number,
  numTerms?: number,
): { points: Complex[]; tip: Complex } {
  if (eps.length === 0) {
    throw new RangeError("epicycleChain: eps must be non-empty");
  }
  const limit = numTerms ?? eps.length;
  if (limit < 0 || limit > eps.length) {
    throw new RangeError("epicycleChain: numTerms out of range");
  }
  const points: Complex[] = [{ re: 0, im: 0 }];
  let cur: Complex = { re: 0, im: 0 };
  for (let i = 0; i < limit; i++) {
    const e = eps[i]!;
    const theta = TAU * e.freq * t + e.phase;
    const delta: Complex = {
      re: e.amp * Math.cos(theta),
      im: e.amp * Math.sin(theta),
    };
    cur = cAdd(cur, delta);
    points.push(cur);
  }
  return { points, tip: cur };
}

// Convenience: sample a parametric path z(t) at N equally-spaced t in [0,1).
export function samplePath(fn: (t: number) => Complex, N: number): Complex[] {
  if (N <= 0 || !Number.isInteger(N)) {
    throw new RangeError("samplePath: N must be a positive integer");
  }
  const out: Complex[] = new Array(N);
  for (let n = 0; n < N; n++) {
    out[n] = fn(n / N);
  }
  return out;
}
