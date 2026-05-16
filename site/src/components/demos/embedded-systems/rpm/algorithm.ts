// RPM measurement — convert encoder/tachometer pulse timestamps to revolutions
// per minute. Reference: Wescott, "Applied Control Theory for Embedded Systems",
// §4 (Velocity Estimation from Encoder Counts).
//
// Two strategies:
//
// 1) PERIOD METHOD: dt between two adjacent pulses. RPM = 60 / (dt * PPR).
//    Best at low RPM (avoids quantization).
//
// 2) FREQUENCY METHOD: count pulses over a fixed window. RPM = (count / PPR) * (60 / window).
//    Best at high RPM (averages noise).

export interface InstantRpm {
  /** Time (s) at which this RPM measurement is valid. */
  t: number;
  rpm: number;
}

export function instantRpmFromPulses(
  pulseTimes: readonly number[],
  pulsesPerRev: number,
): InstantRpm[] {
  if (pulsesPerRev <= 0 || !Number.isFinite(pulsesPerRev)) {
    throw new RangeError("pulsesPerRev must be > 0");
  }
  for (let i = 1; i < pulseTimes.length; i++) {
    if (pulseTimes[i]! <= pulseTimes[i - 1]!) {
      throw new RangeError("pulseTimes must be strictly increasing");
    }
  }
  if (pulseTimes.length < 2) return [];
  const out: InstantRpm[] = new Array(pulseTimes.length - 1);
  for (let i = 1; i < pulseTimes.length; i++) {
    const dt = pulseTimes[i]! - pulseTimes[i - 1]!;
    const revsPerSec = 1 / (dt * pulsesPerRev);
    out[i - 1] = { t: pulseTimes[i]!, rpm: revsPerSec * 60 };
  }
  return out;
}

// Frequency method: count pulses falling in [t, t + windowSec).
export function windowedRpm(
  pulseTimes: readonly number[],
  pulsesPerRev: number,
  windowSec: number,
  sampleTimes: readonly number[],
): InstantRpm[] {
  if (pulsesPerRev <= 0) throw new RangeError("pulsesPerRev must be > 0");
  if (windowSec <= 0) throw new RangeError("windowSec must be > 0");
  for (let i = 1; i < sampleTimes.length; i++) {
    if (sampleTimes[i]! < sampleTimes[i - 1]!) {
      throw new RangeError("sampleTimes must be non-decreasing");
    }
  }
  const out: InstantRpm[] = new Array(sampleTimes.length);
  for (let i = 0; i < sampleTimes.length; i++) {
    const t0 = sampleTimes[i]!;
    const t1 = t0 + windowSec;
    let count = 0;
    for (const p of pulseTimes) {
      if (p >= t0 && p < t1) count++;
    }
    const revs = count / pulsesPerRev;
    const rpm = (revs / windowSec) * 60;
    out[i] = { t: t0, rpm };
  }
  return out;
}

// Moving average over the last `N` instantaneous measurements.
export function movingAverageRpm(
  measurements: readonly InstantRpm[],
  N: number,
): InstantRpm[] {
  if (!Number.isInteger(N) || N <= 0) {
    throw new RangeError("N must be a positive integer");
  }
  if (measurements.length === 0) return [];
  const out: InstantRpm[] = [];
  let sum = 0;
  for (let i = 0; i < measurements.length; i++) {
    sum += measurements[i]!.rpm;
    if (i >= N) sum -= measurements[i - N]!.rpm;
    const windowSize = Math.min(i + 1, N);
    out.push({ t: measurements[i]!.t, rpm: sum / windowSize });
  }
  return out;
}
