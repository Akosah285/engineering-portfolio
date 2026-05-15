// Naive O(N^2) Discrete Fourier Transform + inverse + amplitude/phase
// extraction.  Used by the v5 Computational Methods DFT demo and reused
// by anything needing simple frequency-domain math (no FFT-grade speed
// required for the demo's typical N <= 256).

export interface ComplexSample {
  readonly re: number;
  readonly im: number;
}

/** Forward DFT.  X[k] = sum_{n=0}^{N-1} x[n] * exp(-2πi k n / N). */
export function dft(x: readonly ComplexSample[]): ComplexSample[] {
  const N = x.length;
  if (N === 0) throw new RangeError("dft: input must be non-empty.");
  const out = new Array<ComplexSample>(N);
  for (let k = 0; k < N; k += 1) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n += 1) {
      const angle = (-2 * Math.PI * k * n) / N;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      re += x[n]!.re * c - x[n]!.im * s;
      im += x[n]!.re * s + x[n]!.im * c;
    }
    out[k] = { re, im };
  }
  return out;
}

/** Inverse DFT.  x[n] = (1/N) * sum_{k} X[k] * exp(+2πi k n / N). */
export function idft(X: readonly ComplexSample[]): ComplexSample[] {
  const N = X.length;
  if (N === 0) throw new RangeError("idft: input must be non-empty.");
  const out = new Array<ComplexSample>(N);
  for (let n = 0; n < N; n += 1) {
    let re = 0;
    let im = 0;
    for (let k = 0; k < N; k += 1) {
      const angle = (2 * Math.PI * k * n) / N;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      re += X[k]!.re * c - X[k]!.im * s;
      im += X[k]!.re * s + X[k]!.im * c;
    }
    out[n] = { re: re / N, im: im / N };
  }
  return out;
}

/** Convenience: lift a real signal to complex. */
export function realToComplex(x: readonly number[]): ComplexSample[] {
  return x.map((re) => ({ re, im: 0 }));
}

/** Magnitude spectrum |X[k]|. */
export function magnitudes(X: readonly ComplexSample[]): number[] {
  return X.map((c) => Math.hypot(c.re, c.im));
}

/** Phase spectrum atan2(im, re).  Phases of zero-magnitude bins clamp to 0. */
export function phases(X: readonly ComplexSample[]): number[] {
  return X.map((c) => (Math.hypot(c.re, c.im) < 1e-12 ? 0 : Math.atan2(c.im, c.re)));
}

/** Frequency in cycles/sample of bin k for an N-point DFT. */
export function binFrequency(k: number, N: number, sampleRate = 1): number {
  return (k * sampleRate) / N;
}
