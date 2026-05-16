// Latch vs Flip-Flop — level- vs edge-sensitive storage element behavior.
// Reference: Brown & Vranesic, "Fundamentals of Digital Logic", §7.1-§7.4.
//
// D latch: while enable is HIGH, Q follows D (transparent). When enable goes
// LOW, Q holds whatever D was at the moment of the falling edge.
//
// D flip-flop: Q updates ONLY on a rising edge of the clock, sampling D at
// that exact instant. Between edges, Q is held regardless of D activity.

export type Bit = 0 | 1;

export interface Sample {
  /** Time (arbitrary units, monotonically non-decreasing). */
  t: number;
  d: Bit;
  /** For latch, this is `enable`; for flip-flop, this is `clk`. */
  ctrl: Bit;
}

export function simulateDLatch(samples: readonly Sample[]): Bit[] {
  if (samples.length === 0) return [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]!.t < samples[i - 1]!.t) {
      throw new RangeError("simulateDLatch: samples must be time-ordered");
    }
  }
  let q: Bit = 0;
  const out: Bit[] = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (s.ctrl === 1) {
      q = s.d; // transparent
    }
    out[i] = q;
  }
  return out;
}

export function simulateDFlipFlop(samples: readonly Sample[]): Bit[] {
  if (samples.length === 0) return [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]!.t < samples[i - 1]!.t) {
      throw new RangeError("simulateDFlipFlop: samples must be time-ordered");
    }
  }
  let q: Bit = 0;
  let prevClk: Bit = samples[0]!.ctrl;
  const out: Bit[] = new Array(samples.length);
  // First sample: no rising edge possible.
  out[0] = q;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i]!;
    if (prevClk === 0 && s.ctrl === 1) {
      q = s.d;
    }
    prevClk = s.ctrl;
    out[i] = q;
  }
  return out;
}

// Compare the two — return per-sample tuples that highlight transparency
// differences. Useful for side-by-side visualization.
export interface Comparison {
  t: number;
  latch: Bit;
  ff: Bit;
  divergent: boolean;
}

export function compare(samples: readonly Sample[]): Comparison[] {
  const latch = simulateDLatch(samples);
  const ff = simulateDFlipFlop(samples);
  const out: Comparison[] = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = {
      t: samples[i]!.t,
      latch: latch[i]!,
      ff: ff[i]!,
      divergent: latch[i] !== ff[i],
    };
  }
  return out;
}
