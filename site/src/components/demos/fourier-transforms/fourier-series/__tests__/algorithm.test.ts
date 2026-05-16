import { describe, expect, it } from "vitest";
import { exactValue, partialSum, partialSumTrace } from "../algorithm";

describe("partialSum — square wave", () => {
  it("first harmonic at x=π/2 is exactly 4/π (only n=1 term contributes)", () => {
    expect(partialSum({ kind: "square", x: Math.PI / 2, nHarmonics: 1 })).toBeCloseTo(
      4 / Math.PI,
      12,
    );
  });

  it("converges to +1 at x=π/2 as more harmonics are added", () => {
    const cheap = partialSum({ kind: "square", x: Math.PI / 2, nHarmonics: 5 });
    const rich = partialSum({ kind: "square", x: Math.PI / 2, nHarmonics: 99 });
    expect(Math.abs(rich - 1)).toBeLessThan(Math.abs(cheap - 1));
    expect(Math.abs(rich - 1)).toBeLessThan(0.02);
  });

  it("is exactly 0 at x=0 (every odd-sine term is 0 there)", () => {
    expect(partialSum({ kind: "square", x: 0, nHarmonics: 99 })).toBeCloseTo(0, 12);
  });

  it("converges to -1 at x=3π/2", () => {
    const v = partialSum({ kind: "square", x: (3 * Math.PI) / 2, nHarmonics: 99 });
    expect(Math.abs(v - -1)).toBeLessThan(0.02);
  });

  it("Gibbs overshoot at the discontinuity stays finite (within ~9% above ±1)", () => {
    // Just before the jump at x=π
    const x = Math.PI - 0.01;
    const v = partialSum({ kind: "square", x, nHarmonics: 199 });
    // Classic Gibbs: ~8.95% overshoot of the half-jump (so peak ~1.179 on a unit square)
    expect(v).toBeGreaterThan(1.0);
    expect(v).toBeLessThan(1.2);
  });
});

describe("partialSum — sawtooth", () => {
  it("first harmonic at x=π/2 is exactly 2/π (only n=1 term contributes)", () => {
    expect(partialSum({ kind: "sawtooth", x: Math.PI / 2, nHarmonics: 1 })).toBeCloseTo(
      2 / Math.PI,
      12,
    );
  });

  it("approaches 0.5 at x=π/2 with many harmonics", () => {
    // Exact value at x=π/2: (π − π/2)/π = 0.5
    const v = partialSum({ kind: "sawtooth", x: Math.PI / 2, nHarmonics: 199 });
    expect(Math.abs(v - 0.5)).toBeLessThan(0.005);
  });

  it("converges to 0 at the centre x=π (mid-period)", () => {
    const v = partialSum({ kind: "sawtooth", x: Math.PI, nHarmonics: 99 });
    expect(v).toBeCloseTo(0, 12); // every sin(nπ) = 0
  });
});

describe("partialSum — triangle", () => {
  it("converges to its true value at the +1 peak (x=π/2)", () => {
    // Triangle 1/n² convergence with odd-only n=99 gives error ~ 1/200 ≈ 0.005;
    // 2-decimal tolerance is the realistic target without going to n>>1000.
    const v = partialSum({ kind: "triangle", x: Math.PI / 2, nHarmonics: 99 });
    expect(v).toBeCloseTo(1, 2);
  });

  it("is 0 at x=0", () => {
    expect(partialSum({ kind: "triangle", x: 0, nHarmonics: 99 })).toBeCloseTo(0, 12);
  });
});

describe("partialSumTrace", () => {
  it("returns the requested number of samples", () => {
    const trace = partialSumTrace("square", 5, 64);
    expect(trace).toHaveLength(64);
    expect(trace[0]!.x).toBe(0);
  });

  it("first and last sampled x-values span [0, 2π)", () => {
    const trace = partialSumTrace("square", 5, 8);
    expect(trace[0]!.x).toBe(0);
    expect(trace[7]!.x).toBeCloseTo((2 * Math.PI * 7) / 8, 12);
  });

  it("throws on samples < 2", () => {
    expect(() => partialSumTrace("square", 5, 1)).toThrow(RangeError);
  });
});

describe("validation", () => {
  it("throws on non-positive or non-integer nHarmonics", () => {
    expect(() => partialSum({ kind: "square", x: 0, nHarmonics: 0 })).toThrow(RangeError);
    expect(() => partialSum({ kind: "square", x: 0, nHarmonics: 1.5 })).toThrow(
      RangeError,
    );
  });

  it("throws on non-finite x", () => {
    expect(() => partialSum({ kind: "square", x: Number.NaN, nHarmonics: 1 })).toThrow(
      RangeError,
    );
  });
});

describe("exactValue", () => {
  it("square is +1 in (0,π) and -1 in (π,2π)", () => {
    expect(exactValue("square", 0.5)).toBe(1);
    expect(exactValue("square", 4)).toBe(-1);
  });

  it("square is 0 exactly at the discontinuities x=0 and x=π", () => {
    expect(exactValue("square", 0)).toBe(0);
    expect(exactValue("square", Math.PI)).toBe(0);
  });

  it("sawtooth equals (π - x)/π in (0, 2π)", () => {
    expect(exactValue("sawtooth", Math.PI)).toBeCloseTo(0, 12);
    expect(exactValue("sawtooth", Math.PI / 2)).toBeCloseTo(0.5, 12);
  });

  it("triangle peaks at +1 at x=π/2 and -1 at x=3π/2", () => {
    expect(exactValue("triangle", Math.PI / 2)).toBeCloseTo(1, 12);
    expect(exactValue("triangle", (3 * Math.PI) / 2)).toBeCloseTo(-1, 12);
  });

  it("is periodic with period 2π", () => {
    expect(exactValue("square", 0.5 + 2 * Math.PI)).toBe(exactValue("square", 0.5));
    expect(exactValue("triangle", 1 + 4 * Math.PI)).toBeCloseTo(
      exactValue("triangle", 1),
      12,
    );
  });
});
