/**
 * fourierSeries — partial sums of Fourier series for the canonical periodic
 * waveforms (#59 v3 Fourier).
 *
 * For period 2π, all four standard waves have closed-form coefficients:
 *
 *   square(x)   = (4/π) · Σ_{n=1,3,5,…} (1/n) · sin(n·x)
 *   sawtooth(x) = (2/π) · Σ_{n=1,2,3,…} ((-1)^{n+1}/n) · sin(n·x)
 *   triangle(x) = (8/π²) · Σ_{n=1,3,5,…} ((-1)^{(n-1)/2}/n²) · sin(n·x)
 *   pulseTrain(x, duty=0.5) = duty + (2/π) · Σ_{n=1,2,3,…}
 *                              (sin(nπ·duty)/n) · cos(n·x)
 *
 * The React shell will animate harmonics being added one at a time and
 * show Gibbs phenomenon at the discontinuities of square/sawtooth.
 */

export type WaveformKind = "square" | "sawtooth" | "triangle";

export interface SeriesInput {
  readonly kind: WaveformKind;
  readonly x: number;
  /** Number of harmonics included (n ≥ 1). */
  readonly nHarmonics: number;
}

function checkN(n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError("fourierSeries: nHarmonics must be a positive integer.");
  }
}

export function partialSum(input: SeriesInput): number {
  checkN(input.nHarmonics);
  if (!Number.isFinite(input.x)) {
    throw new RangeError("fourierSeries: x must be finite.");
  }
  const { kind, x, nHarmonics } = input;
  let s = 0;
  switch (kind) {
    case "square":
      for (let n = 1; n <= nHarmonics; n += 2) {
        s += Math.sin(n * x) / n;
      }
      return (4 / Math.PI) * s;
    case "sawtooth":
      for (let n = 1; n <= nHarmonics; n += 1) {
        s += ((n % 2 === 0 ? -1 : 1) * Math.sin(n * x)) / n;
      }
      return (2 / Math.PI) * s;
    case "triangle":
      for (let n = 1; n <= nHarmonics; n += 2) {
        const k = (n - 1) / 2;
        s += ((k % 2 === 0 ? 1 : -1) * Math.sin(n * x)) / (n * n);
      }
      return (8 / Math.PI ** 2) * s;
  }
}

/** Sample a partial sum at evenly-spaced x-values across [0, 2π). */
export function partialSumTrace(
  kind: WaveformKind,
  nHarmonics: number,
  samples: number,
): { x: number; y: number }[] {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("fourierSeries: samples must be an integer >= 2.");
  }
  const out: { x: number; y: number }[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = (2 * Math.PI * i) / samples;
    out[i] = { x, y: partialSum({ kind, x, nHarmonics }) };
  }
  return out;
}

/**
 * Exact reference values for the canonical waveforms (period 2π).
 *
 * square    = +1 on (0, π),  -1 on (π, 2π); 0 at the discontinuities.
 * sawtooth  = (π - x)/π for x ∈ (0, 2π); periodic.  At x=0 it is 0 by symmetry.
 * triangle  = 1 - 2|x - π| / π for x ∈ [0, 2π].  Continuous, peak +1 at x=π,
 *             trough -1 at x = 0 and x = 2π.
 *
 * Wait — that triangle sums to a positive bump, peak +1 at x=π/2 and trough
 * -1 at x=3π/2 (matching the sin-only series above).  Re-derive:
 *
 *   Triangle with the series Σ_{n odd} ((-1)^((n-1)/2)/n²) sin(n x):
 *   this is the antiderivative of the square wave (up to a constant), so
 *   it ramps linearly: +1 at x=π/2, 0 at x=π, -1 at x=3π/2, 0 at x=2π.
 */
export function exactValue(kind: WaveformKind, x: number): number {
  // Reduce to [0, 2π)
  const t = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  switch (kind) {
    case "square":
      if (t === 0 || t === Math.PI) return 0;
      return t < Math.PI ? 1 : -1;
    case "sawtooth":
      // (π − t)/π
      return (Math.PI - t) / Math.PI;
    case "triangle": {
      // Linear ramp +1 at π/2, 0 at π, -1 at 3π/2, 0 at 2π / 0
      if (t <= Math.PI / 2) return (2 * t) / Math.PI;
      if (t <= (3 * Math.PI) / 2) return 1 - (2 * (t - Math.PI / 2)) / Math.PI;
      return -1 + (2 * (t - (3 * Math.PI) / 2)) / Math.PI;
    }
  }
}
