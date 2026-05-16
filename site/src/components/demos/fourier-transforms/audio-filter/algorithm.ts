// Biquad filter design + sample processing.
// Reference: Robert Bristow-Johnson, "Cookbook formulae for audio EQ biquad
// filter coefficients" (RBJ Audio EQ Cookbook).
//
// Each biquad implements the difference equation:
//   y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
//                       - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]

export type BiquadType = "lowpass" | "highpass" | "bandpass" | "notch";

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

export interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function makeBiquad(
  type: BiquadType,
  cutoffHz: number,
  sampleRate: number,
  Q: number,
): BiquadCoeffs {
  if (sampleRate <= 0) {
    throw new RangeError("makeBiquad: sampleRate must be > 0");
  }
  if (cutoffHz <= 0 || cutoffHz >= sampleRate / 2) {
    throw new RangeError(
      "makeBiquad: cutoffHz must be in (0, sampleRate/2) (Nyquist)",
    );
  }
  if (Q <= 0) {
    throw new RangeError("makeBiquad: Q must be > 0");
  }
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosW = Math.cos(w0);
  const sinW = Math.sin(w0);
  const alpha = sinW / (2 * Q);

  let b0: number;
  let b1: number;
  let b2: number;
  let a0: number;
  let a1: number;
  let a2: number;

  switch (type) {
    case "lowpass": {
      b0 = (1 - cosW) / 2;
      b1 = 1 - cosW;
      b2 = (1 - cosW) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
      break;
    }
    case "highpass": {
      b0 = (1 + cosW) / 2;
      b1 = -(1 + cosW);
      b2 = (1 + cosW) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
      break;
    }
    case "bandpass": {
      // constant skirt gain (peak gain = Q)
      b0 = sinW / 2;
      b1 = 0;
      b2 = -sinW / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
      break;
    }
    case "notch": {
      b0 = 1;
      b1 = -2 * cosW;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
      break;
    }
    default: {
      throw new RangeError(`makeBiquad: unknown type ${type as string}`);
    }
  }
  return { b0, b1, b2, a0, a1, a2 };
}

export function initState(): BiquadState {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

// Process a single sample, mutating state in-place.
export function processSample(
  c: BiquadCoeffs,
  s: BiquadState,
  x: number,
): number {
  const y =
    (c.b0 / c.a0) * x +
    (c.b1 / c.a0) * s.x1 +
    (c.b2 / c.a0) * s.x2 -
    (c.a1 / c.a0) * s.y1 -
    (c.a2 / c.a0) * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

export function processBuffer(c: BiquadCoeffs, input: number[]): number[] {
  const s = initState();
  const out = new Array<number>(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = processSample(c, s, input[i]!);
  }
  return out;
}

// Magnitude response |H(e^{jw})| at a probe frequency, normalized by a0.
// H(z) = (b0 + b1 z^-1 + b2 z^-2) / (a0 + a1 z^-1 + a2 z^-2).
export function magnitudeResponse(
  c: BiquadCoeffs,
  freqHz: number,
  sampleRate: number,
): number {
  if (sampleRate <= 0) {
    throw new RangeError("magnitudeResponse: sampleRate must be > 0");
  }
  if (freqHz < 0 || freqHz > sampleRate / 2) {
    throw new RangeError("magnitudeResponse: freqHz out of [0, Nyquist]");
  }
  const w = (2 * Math.PI * freqHz) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  const numRe = c.b0 + c.b1 * cosW + c.b2 * cos2W;
  const numIm = -c.b1 * sinW - c.b2 * sin2W;
  const denRe = c.a0 + c.a1 * cosW + c.a2 * cos2W;
  const denIm = -c.a1 * sinW - c.a2 * sin2W;

  const numMag = Math.hypot(numRe, numIm);
  const denMag = Math.hypot(denRe, denIm);
  return numMag / denMag;
}
