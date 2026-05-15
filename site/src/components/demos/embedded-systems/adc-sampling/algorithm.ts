// ADC sampling + aliasing simulation for the v10 Embedded Systems
// ADC demo (#125).  Pure math: no React.

export interface SignalInput {
  readonly amplitude: number;
  readonly frequency: number;
  readonly phase?: number;
  readonly sampleRate: number;
  readonly nSamples: number;
}

export interface Sample {
  readonly t: number;
  readonly value: number;
}

/**
 * Sample a sine wave at a given sample rate and length.  Returns a
 * sequence of (t, value) pairs starting at t=0 and stepping by 1/fs.
 */
export function sampleSine(input: SignalInput): Sample[] {
  if (!(input.sampleRate > 0)) throw new RangeError("sampleSine: sampleRate must be > 0.");
  if (!Number.isInteger(input.nSamples) || input.nSamples < 1) {
    throw new RangeError("sampleSine: nSamples must be a positive integer.");
  }
  if (!Number.isFinite(input.frequency)) {
    throw new RangeError("sampleSine: frequency must be finite.");
  }
  if (!(input.amplitude >= 0)) throw new RangeError("sampleSine: amplitude must be >= 0.");
  const phase = input.phase ?? 0;
  const dt = 1 / input.sampleRate;
  const out = new Array<Sample>(input.nSamples);
  for (let i = 0; i < input.nSamples; i += 1) {
    const t = i * dt;
    out[i] = { t, value: input.amplitude * Math.sin(2 * Math.PI * input.frequency * t + phase) };
  }
  return out;
}

/**
 * Aliased apparent frequency when sampling a continuous signal of true
 * frequency `f` at rate `fs`.  Returns the value in [0, fs/2] (Nyquist).
 *
 * Standard Shannon-Nyquist folding:
 *   f_aliased = | f - round(f / fs) * fs |
 */
export function aliasedFrequency(f: number, fs: number): number {
  if (!(fs > 0)) throw new RangeError("aliasedFrequency: fs must be > 0.");
  if (!Number.isFinite(f)) throw new RangeError("aliasedFrequency: f must be finite.");
  const folded = Math.abs(f - Math.round(f / fs) * fs);
  // folded is in [0, fs/2]
  return folded;
}

/** Returns true iff f exceeds the Nyquist frequency fs/2 (will alias). */
export function willAlias(f: number, fs: number): boolean {
  if (!(fs > 0)) throw new RangeError("willAlias: fs must be > 0.");
  return Math.abs(f) > fs / 2;
}

export interface QuantizeInput {
  readonly bits: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly value: number;
}

/**
 * Mid-tread uniform quantizer: maps a continuous value in [vMin, vMax]
 * to one of 2^bits levels and returns the reconstructed analog value.
 */
export function quantize(input: QuantizeInput): number {
  if (!Number.isInteger(input.bits) || input.bits < 1 || input.bits > 24) {
    throw new RangeError("quantize: bits must be an integer in [1, 24].");
  }
  if (!(input.vMax > input.vMin)) {
    throw new RangeError("quantize: vMax must be > vMin.");
  }
  if (!Number.isFinite(input.value)) throw new RangeError("quantize: value must be finite.");
  const levels = 2 ** input.bits;
  const span = input.vMax - input.vMin;
  const lsb = span / levels;
  // Clip into range first.
  const v = Math.min(input.vMax, Math.max(input.vMin, input.value));
  // Mid-tread: round((v - vMin) / lsb) gives the level index 0..levels-1.
  let idx = Math.round((v - input.vMin) / lsb);
  if (idx < 0) idx = 0;
  if (idx > levels - 1) idx = levels - 1;
  return input.vMin + idx * lsb;
}

/** Quantization step size in volts for a given config. */
export function lsb(bits: number, vRange: number): number {
  if (!Number.isInteger(bits) || bits < 1) throw new RangeError("lsb: bits must be >= 1.");
  if (!(vRange > 0)) throw new RangeError("lsb: vRange must be > 0.");
  return vRange / 2 ** bits;
}
