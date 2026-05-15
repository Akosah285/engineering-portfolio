/**
 * bode — magnitude (dB) and phase (deg) of a rational transfer function (#111).
 *
 * Given a transfer function in pole-zero-gain form
 *
 *     H(s) = K · Π(s − z_i) / Π(s − p_j)
 *
 * the frequency response is H(jω) for real ω ≥ 0.  The magnitude in dB is
 * 20·log₁₀|H(jω)| and the phase in degrees is unwrapped per Bode tradition
 * (the helper returns the principal-value phase ∈ (−180, 180]; the React
 * shell can unwrap across the trace if it wants smooth curves).
 *
 * Frequencies are decade-spaced via a separate helper so the demo can ask
 * for a clean log-axis Bode plot.
 */

export interface TransferFunction {
  /** Real gain K. */
  readonly gain: number;
  /** Zeros (real or complex). Complex zeros must come in conjugate pairs. */
  readonly zeros: ReadonlyArray<Complex>;
  /** Poles (real or complex). Complex poles must come in conjugate pairs. */
  readonly poles: ReadonlyArray<Complex>;
}

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export interface BodePoint {
  readonly omega: number;
  readonly magnitudeDb: number;
  readonly phaseDeg: number;
}

const DEG_PER_RAD = 180 / Math.PI;

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}
function cArg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

function checkFiniteComplex(c: Complex, name: string): void {
  if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) {
    throw new RangeError(`bode: ${name} must have finite real and imaginary parts.`);
  }
}

function evaluate(tf: TransferFunction, s: Complex): Complex {
  let numer: Complex = { re: tf.gain, im: 0 };
  for (const z of tf.zeros) {
    numer = cMul(numer, cSub(s, z));
  }
  let denom: Complex = { re: 1, im: 0 };
  for (const p of tf.poles) {
    denom = cMul(denom, cSub(s, p));
  }
  if (cAbs(denom) === 0) {
    throw new RangeError("bode: denominator is zero — pole on jω axis at this frequency.");
  }
  return cDiv(numer, denom);
}

function checkTransferFunction(tf: TransferFunction): void {
  if (!Number.isFinite(tf.gain)) {
    throw new RangeError("bode: gain must be finite.");
  }
  for (const z of tf.zeros) checkFiniteComplex(z, "zero");
  for (const p of tf.poles) checkFiniteComplex(p, "pole");
}

export function frequencyResponse(tf: TransferFunction, omega: number): Complex {
  if (!Number.isFinite(omega) || omega < 0) {
    throw new RangeError("bode: omega must be >= 0 and finite.");
  }
  checkTransferFunction(tf);
  return evaluate(tf, { re: 0, im: omega });
}

export function bodePoint(tf: TransferFunction, omega: number): BodePoint {
  const H = frequencyResponse(tf, omega);
  const mag = cAbs(H);
  if (mag === 0) {
    // log10(0) = −∞; report a deeply negative dB sentinel.
    return { omega, magnitudeDb: Number.NEGATIVE_INFINITY, phaseDeg: 0 };
  }
  return {
    omega,
    magnitudeDb: 20 * Math.log10(mag),
    phaseDeg: cArg(H) * DEG_PER_RAD,
  };
}

/**
 * Logarithmically spaced frequencies from 10^startDecade to 10^endDecade
 * with `pointsPerDecade` samples per decade (inclusive endpoints).
 */
export function logspace(
  startDecade: number,
  endDecade: number,
  pointsPerDecade = 20,
): number[] {
  if (!Number.isFinite(startDecade) || !Number.isFinite(endDecade)) {
    throw new RangeError("logspace: decade endpoints must be finite.");
  }
  if (endDecade < startDecade) {
    throw new RangeError("logspace: endDecade must be >= startDecade.");
  }
  if (!Number.isInteger(pointsPerDecade) || pointsPerDecade < 1) {
    throw new RangeError("logspace: pointsPerDecade must be a positive integer.");
  }
  const total = Math.round((endDecade - startDecade) * pointsPerDecade) + 1;
  const out: number[] = new Array(total);
  for (let i = 0; i < total; i += 1) {
    const exp = startDecade + i / pointsPerDecade;
    out[i] = 10 ** exp;
  }
  return out;
}

export function bodePlot(tf: TransferFunction, omegas: ReadonlyArray<number>): BodePoint[] {
  return omegas.map((w) => bodePoint(tf, w));
}
