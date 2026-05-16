import { describe, it, expect } from "vitest";
import {
  rectFT,
  triangleFT,
  expTwoSidedFT,
  expCausalFT,
  gaussianFT,
  magnitude,
  sampleFT,
} from "../algorithm";

describe("rectFT", () => {
  it("F(0) = T (DC = area under rect)", () => {
    expect(rectFT(2, 0).re).toBeCloseTo(2, 10);
    expect(rectFT(0.5, 0).re).toBeCloseTo(0.5, 10);
  });

  it("zeros at ω = 2πk/T (sinc zero crossings)", () => {
    const T = 1;
    // First zero at ω = 2π
    expect(rectFT(T, 2 * Math.PI).re).toBeCloseTo(0, 10);
    expect(rectFT(T, 4 * Math.PI).re).toBeCloseTo(0, 10);
  });

  it("RangeError on T <= 0", () => {
    expect(() => rectFT(0, 1)).toThrow(RangeError);
    expect(() => rectFT(-1, 1)).toThrow(RangeError);
  });
});

describe("triangleFT", () => {
  it("F(0) = T/2 (area under triangle of half-width T)", () => {
    expect(triangleFT(2, 0).re).toBeCloseTo(1, 10);
  });

  it("always non-negative (sinc² ≥ 0)", () => {
    for (let i = -10; i <= 10; i += 1) {
      expect(triangleFT(1, i).re).toBeGreaterThanOrEqual(-1e-12);
    }
  });
});

describe("expTwoSidedFT", () => {
  it("F(0) = 2/a", () => {
    expect(expTwoSidedFT(1, 0).re).toBeCloseTo(2, 10);
    expect(expTwoSidedFT(0.5, 0).re).toBeCloseTo(4, 10);
  });

  it("real-valued (even signal)", () => {
    for (let i = -5; i <= 5; i += 1) {
      expect(expTwoSidedFT(1, i).im).toBe(0);
    }
  });

  it("decays as ω → ∞ as 2a/ω²", () => {
    const fLarge = expTwoSidedFT(1, 100);
    expect(fLarge.re).toBeLessThan(0.001);
    expect(fLarge.re).toBeGreaterThan(0);
  });
});

describe("expCausalFT", () => {
  it("F(0) = 1/a (real)", () => {
    expect(expCausalFT(2, 0).re).toBeCloseTo(0.5, 10);
    expect(expCausalFT(2, 0).im).toBeCloseTo(0, 10);
  });

  it("|F(ω)|² = 1/(a²+ω²)", () => {
    const c = expCausalFT(1, 3);
    const mag2 = c.re * c.re + c.im * c.im;
    expect(mag2).toBeCloseTo(1 / (1 + 9), 10);
  });

  it("phase angle: arg(F) = -atan(ω/a)", () => {
    const a = 2;
    const w = 1;
    const c = expCausalFT(a, w);
    const expectedPhase = -Math.atan(w / a);
    expect(Math.atan2(c.im, c.re)).toBeCloseTo(expectedPhase, 10);
  });
});

describe("gaussianFT", () => {
  it("F(0) = √(π/a)", () => {
    expect(gaussianFT(1, 0).re).toBeCloseTo(Math.sqrt(Math.PI), 10);
    expect(gaussianFT(0.5, 0).re).toBeCloseTo(Math.sqrt(2 * Math.PI), 10);
  });

  it("Gaussian FT is Gaussian (sanity: positive and symmetric)", () => {
    expect(gaussianFT(1, 2).re).toBeCloseTo(gaussianFT(1, -2).re, 10);
    expect(gaussianFT(1, 0).re).toBeGreaterThan(gaussianFT(1, 1).re);
  });

  it("RangeError on a <= 0", () => {
    expect(() => gaussianFT(0, 0)).toThrow(RangeError);
  });
});

describe("magnitude + sampleFT", () => {
  it("magnitude = √(re² + im²)", () => {
    expect(magnitude({ re: 3, im: 4 })).toBe(5);
  });

  it("sampleFT iterates over omegas", () => {
    const omegas = [0, 1, 2, 3];
    const out = sampleFT("rect", 1, omegas);
    expect(out.length).toBe(4);
    expect(out[0]!.re).toBeCloseTo(1, 10);
  });
});
