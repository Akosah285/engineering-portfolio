import { describe, it, expect } from "vitest";
import { step, gaussianPulse } from "../algorithm";

describe("step — 2D wave equation", () => {
  it("zero source + zero IC → field stays zero", () => {
    const r = step({
      nx: 11,
      ny: 11,
      c: 1,
      dx: 1,
      dt: 0.5,
      steps: 50,
      source: () => 0,
    });
    expect(r.maxAmplitude).toBe(0);
    for (let i = 0; i < 11; i += 1) {
      for (let j = 0; j < 11; j += 1) {
        expect(r.u[i]![j]!).toBe(0);
      }
    }
  });

  it("pulse source produces a wave (non-zero amplitude)", () => {
    const r = step({
      nx: 21,
      ny: 21,
      c: 1,
      dx: 1,
      dt: 0.5,
      steps: 20,
      source: gaussianPulse(10, 10, 100, 1, 0),
    });
    expect(r.maxAmplitude).toBeGreaterThan(0);
  });

  it("Dirichlet BCs hold: boundary stays 0", () => {
    const r = step({
      nx: 21,
      ny: 21,
      c: 1,
      dx: 1,
      dt: 0.5,
      steps: 30,
      source: gaussianPulse(10, 10, 100, 1, 0),
    });
    for (let j = 0; j < 21; j += 1) {
      expect(r.u[0]![j]!).toBe(0);
      expect(r.u[20]![j]!).toBe(0);
    }
    for (let i = 0; i < 21; i += 1) {
      expect(r.u[i]![0]!).toBe(0);
      expect(r.u[i]![20]!).toBe(0);
    }
  });

  it("RangeError on CFL violation", () => {
    expect(() =>
      step({
        nx: 11,
        ny: 11,
        c: 1,
        dx: 1,
        dt: 0.8, // r = 0.8 > 1/√2 ≈ 0.707
        steps: 10,
        source: () => 0,
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on grid too small", () => {
    expect(() =>
      step({
        nx: 2,
        ny: 11,
        c: 1,
        dx: 1,
        dt: 0.5,
        steps: 1,
        source: () => 0,
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on bad steps", () => {
    expect(() =>
      step({
        nx: 11,
        ny: 11,
        c: 1,
        dx: 1,
        dt: 0.5,
        steps: 0,
        source: () => 0,
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on c <= 0", () => {
    expect(() =>
      step({
        nx: 11,
        ny: 11,
        c: 0,
        dx: 1,
        dt: 0.5,
        steps: 10,
        source: () => 0,
      }),
    ).toThrow(RangeError);
  });

  it("two-source interference: superposition non-zero at midline", () => {
    const sources = [gaussianPulse(10, 5, 100, 1, 0), gaussianPulse(10, 15, 100, 1, 0)];
    const r = step({
      nx: 21,
      ny: 21,
      c: 1,
      dx: 1,
      dt: 0.5,
      steps: 30,
      source: (i, j, n) => sources[0]!(i, j, n) + sources[1]!(i, j, n),
    });
    // Midline (j=10) should not be identically zero.
    let nonZero = 0;
    for (let i = 1; i < 20; i += 1) {
      if (Math.abs(r.u[i]![10]!) > 1e-6) nonZero += 1;
    }
    expect(nonZero).toBeGreaterThan(0);
  });
});

describe("gaussianPulse", () => {
  it("peak at center, zero far away", () => {
    const f = gaussianPulse(5, 5, 10, 1, 100);
    expect(f(5, 5, 0)).toBe(10);
    expect(f(50, 50, 0)).toBeCloseTo(0, 6);
  });

  it("zero after duration", () => {
    const f = gaussianPulse(5, 5, 10, 1, 3);
    expect(f(5, 5, 4)).toBe(0);
  });

  it("RangeError on width <= 0", () => {
    expect(() => gaussianPulse(0, 0, 1, 0, 5)).toThrow(RangeError);
  });

  it("RangeError on negative duration", () => {
    expect(() => gaussianPulse(0, 0, 1, 1, -1)).toThrow(RangeError);
  });
});
