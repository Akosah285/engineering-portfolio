import { describe, expect, it } from "vitest";
import {
  type TransferFunction,
  bodePlot,
  bodePoint,
  frequencyResponse,
  logspace,
} from "../algorithm";

// First-order low-pass: H(s) = 1 / (s + 1), pole at -1.
const LOWPASS: TransferFunction = {
  gain: 1,
  zeros: [],
  poles: [{ re: -1, im: 0 }],
};

// Pure gain of 10 (constant H(s) = 10): magnitude 20 dB, phase 0.
const GAIN_10: TransferFunction = {
  gain: 10,
  zeros: [],
  poles: [],
};

// Differentiator with finite pole: H(s) = s / (s + 100). Zero at 0, pole at -100.
const DIFFERENTIATOR_LOWPASS: TransferFunction = {
  gain: 1,
  zeros: [{ re: 0, im: 0 }],
  poles: [{ re: -100, im: 0 }],
};

describe("bodePoint — first-order low-pass H(s) = 1/(s+1)", () => {
  it("at ω=0 has magnitude 0 dB and phase 0°", () => {
    const p = bodePoint(LOWPASS, 0);
    expect(p.magnitudeDb).toBeCloseTo(0, 9);
    expect(p.phaseDeg).toBeCloseTo(0, 9);
  });

  it("at corner frequency ω=1 has magnitude -3 dB (within 0.05 dB) and phase -45°", () => {
    const p = bodePoint(LOWPASS, 1);
    // |1/(j+1)| = 1/sqrt(2) ⇒ -3.01 dB
    expect(p.magnitudeDb).toBeCloseTo(-20 * Math.log10(Math.sqrt(2)), 9);
    expect(p.phaseDeg).toBeCloseTo(-45, 9);
  });

  it("at ω=10 (a decade above corner) has magnitude ≈ -20 dB and phase → -90°", () => {
    const p = bodePoint(LOWPASS, 10);
    // |1/(j10+1)| ≈ 1/10
    expect(p.magnitudeDb).toBeCloseTo(20 * Math.log10(1 / Math.hypot(10, 1)), 9);
    expect(p.phaseDeg).toBeCloseTo(-Math.atan(10) * (180 / Math.PI), 9);
    // Roll-off heading toward -20 dB
    expect(p.magnitudeDb).toBeLessThan(-19);
    expect(p.magnitudeDb).toBeGreaterThan(-21);
  });

  it("magnitude rolls off at -20 dB/decade for ω >> ω_c", () => {
    const a = bodePoint(LOWPASS, 100);
    const b = bodePoint(LOWPASS, 1000);
    expect(b.magnitudeDb - a.magnitudeDb).toBeCloseTo(-20, 1);
  });
});

describe("bodePoint — pure gain", () => {
  it("returns 20·log10(K) dB and 0° at every frequency", () => {
    for (const w of [0, 1, 100, 1e6]) {
      const p = bodePoint(GAIN_10, w);
      expect(p.magnitudeDb).toBeCloseTo(20, 12);
      expect(p.phaseDeg).toBeCloseTo(0, 12);
    }
  });

  it("returns -∞ dB when gain is zero", () => {
    const p = bodePoint({ gain: 0, zeros: [], poles: [] }, 1);
    expect(p.magnitudeDb).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("bodePoint — differentiator-with-pole H(s) = s/(s+100)", () => {
  it("at ω=1 has +90° phase (zero at origin dominates) and magnitude ≈ -40 dB", () => {
    const p = bodePoint(DIFFERENTIATOR_LOWPASS, 1);
    // |j1 / (j1 + 100)| ≈ 1 / 100.005 ≈ 0.01 ⇒ -40 dB
    expect(p.magnitudeDb).toBeCloseTo(20 * Math.log10(1 / Math.hypot(100, 1)), 9);
    // Phase = arg(j1) - arg(j1 + 100) = 90 - tiny ≈ 89.4°
    expect(p.phaseDeg).toBeCloseTo(90 - Math.atan(1 / 100) * (180 / Math.PI), 9);
  });
});

describe("frequencyResponse", () => {
  it("returns H(jω) = 1/(jω+1) for the low-pass at ω=2", () => {
    const H = frequencyResponse(LOWPASS, 2);
    // H = 1 / (j2 + 1) = (1 - j2) / 5 = 0.2 - 0.4j
    expect(H.re).toBeCloseTo(0.2, 12);
    expect(H.im).toBeCloseTo(-0.4, 12);
  });

  it("throws on negative or non-finite omega", () => {
    expect(() => frequencyResponse(LOWPASS, -1)).toThrow(RangeError);
    expect(() => frequencyResponse(LOWPASS, Number.NaN)).toThrow(RangeError);
  });

  it("throws when a pole sits exactly on the requested jω point", () => {
    // Pole at +j2; querying ω=2 hits it exactly.
    const tf: TransferFunction = { gain: 1, zeros: [], poles: [{ re: 0, im: 2 }] };
    expect(() => frequencyResponse(tf, 2)).toThrow(RangeError);
  });
});

describe("logspace", () => {
  it("includes both decade endpoints when pointsPerDecade > 0", () => {
    const xs = logspace(0, 2, 10);
    expect(xs[0]).toBeCloseTo(1, 12);
    expect(xs[xs.length - 1]).toBeCloseTo(100, 9);
    expect(xs).toHaveLength(21);
  });

  it("starts at 10^startDecade and ends at 10^endDecade", () => {
    const xs = logspace(-2, 3, 5);
    expect(xs[0]).toBeCloseTo(0.01, 12);
    expect(xs[xs.length - 1]).toBeCloseTo(1000, 9);
  });

  it("throws on inverted decades", () => {
    expect(() => logspace(2, 1, 10)).toThrow(RangeError);
  });

  it("throws on non-positive pointsPerDecade", () => {
    expect(() => logspace(0, 1, 0)).toThrow(RangeError);
    expect(() => logspace(0, 1, 1.5)).toThrow(RangeError);
  });
});

describe("bodePlot", () => {
  it("returns one point per requested frequency", () => {
    const omegas = logspace(-1, 1, 10);
    const trace = bodePlot(LOWPASS, omegas);
    expect(trace).toHaveLength(omegas.length);
    expect(trace[0]!.omega).toBeCloseTo(omegas[0]!, 12);
  });

  it("phase decreases monotonically with frequency for a single LHP pole", () => {
    const omegas = [0.1, 1, 10, 100];
    const trace = bodePlot(LOWPASS, omegas);
    for (let i = 1; i < trace.length; i += 1) {
      expect(trace[i]!.phaseDeg).toBeLessThan(trace[i - 1]!.phaseDeg);
    }
  });
});
