/**
 * pwm — pulse-width modulation waveform analysis (#127 v10 Embedded).
 *
 * A square pulse train at frequency f with duty cycle D ∈ [0, 1]:
 *
 *     v(t) = V_high  for fmod(t, T) < D·T,  else V_low
 *
 * where T = 1/f.  Useful aggregate quantities:
 *
 *     average     = V_low + D · (V_high − V_low)
 *     RMS         = sqrt(D · V_high² + (1−D) · V_low²)
 *     peakToPeak  = |V_high − V_low|
 *
 * The React shell can plot the waveform alongside its DC equivalent and
 * its RMS-equivalent — the two quantities a microcontroller datasheet
 * cares about for motor control vs heater dimming respectively.
 */

export interface PwmParams {
  /** Frequency [Hz]. Must be > 0. */
  readonly frequency: number;
  /** Duty cycle ∈ [0, 1]. */
  readonly duty: number;
  /** High output level (e.g. 5 V). */
  readonly vHigh: number;
  /** Low output level (e.g. 0 V). */
  readonly vLow: number;
}

export interface PwmAggregates {
  readonly period: number;
  readonly average: number;
  readonly rms: number;
  readonly peakToPeak: number;
  readonly highTime: number;
  readonly lowTime: number;
}

function checkParams(p: PwmParams): void {
  if (!Number.isFinite(p.frequency) || p.frequency <= 0) {
    throw new RangeError("pwm: frequency must be > 0 and finite.");
  }
  if (!Number.isFinite(p.duty) || p.duty < 0 || p.duty > 1) {
    throw new RangeError("pwm: duty must be in [0, 1].");
  }
  if (!Number.isFinite(p.vHigh) || !Number.isFinite(p.vLow)) {
    throw new RangeError("pwm: vHigh and vLow must be finite.");
  }
}

export function valueAt(params: PwmParams, t: number): number {
  checkParams(params);
  if (!Number.isFinite(t)) {
    throw new RangeError("pwm: t must be finite.");
  }
  const T = 1 / params.frequency;
  const phase = ((t % T) + T) % T;
  return phase < params.duty * T ? params.vHigh : params.vLow;
}

export function aggregates(params: PwmParams): PwmAggregates {
  checkParams(params);
  const T = 1 / params.frequency;
  const highTime = params.duty * T;
  const lowTime = T - highTime;
  const average = params.vLow + params.duty * (params.vHigh - params.vLow);
  const rms = Math.sqrt(
    params.duty * params.vHigh ** 2 + (1 - params.duty) * params.vLow ** 2,
  );
  return {
    period: T,
    average,
    rms,
    peakToPeak: Math.abs(params.vHigh - params.vLow),
    highTime,
    lowTime,
  };
}

/**
 * Discrete waveform sampling for plotting.  Returns evenly-spaced (t, v)
 * pairs over [0, tEnd].  Sample exactly at edge transitions to avoid
 * antialiasing artifacts in the canvas trace.
 */
export function trace(
  params: PwmParams,
  tEnd: number,
  samples: number,
): { t: number; v: number }[] {
  checkParams(params);
  if (!Number.isFinite(tEnd) || tEnd <= 0) {
    throw new RangeError("pwm: tEnd must be > 0 and finite.");
  }
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("pwm: samples must be an integer >= 2.");
  }
  const out: { t: number; v: number }[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = (i / (samples - 1)) * tEnd;
    out[i] = { t, v: valueAt(params, t) };
  }
  return out;
}
