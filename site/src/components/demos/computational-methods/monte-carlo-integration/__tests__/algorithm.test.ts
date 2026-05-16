import { describe, it, expect } from "vitest";
import { integrate1D, integrate2D } from "../algorithm";

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("integrate1D", () => {
  it("∫₀¹ 1 dx = 1 (constant function, exact)", () => {
    const r = integrate1D({ f: () => 1, a: 0, b: 1, n: 100 });
    expect(r.estimate).toBeCloseTo(1, 10);
  });

  it("∫₀¹ x dx = 1/2 (linear, exact in mean)", () => {
    const r = integrate1D({ f: (x) => x, a: 0, b: 1, n: 50000, rng: seededRng(11) });
    expect(r.estimate).toBeCloseTo(0.5, 1);
  });

  it("∫₀¹ x² dx = 1/3", () => {
    const r = integrate1D({
      f: (x) => x * x,
      a: 0,
      b: 1,
      n: 50000,
      rng: seededRng(22),
    });
    expect(r.estimate).toBeCloseTo(1 / 3, 1);
  });

  it("∫₀^π sin x dx = 2", () => {
    const r = integrate1D({
      f: Math.sin,
      a: 0,
      b: Math.PI,
      n: 100000,
      rng: seededRng(33),
    });
    expect(r.estimate).toBeCloseTo(2, 1);
  });

  it("std error shrinks ~1/√N", () => {
    const small = integrate1D({
      f: (x) => x * x,
      a: 0,
      b: 1,
      n: 1000,
      rng: seededRng(44),
    });
    const large = integrate1D({
      f: (x) => x * x,
      a: 0,
      b: 1,
      n: 100000,
      rng: seededRng(44),
    });
    // 100x more samples → ~10x smaller std error
    expect(large.stdError).toBeLessThan(small.stdError / 5);
  });

  it("CI half-width = 1.96 * stdError", () => {
    const r = integrate1D({ f: (x) => x, a: 0, b: 1, n: 1000, rng: seededRng(55) });
    expect(r.ci95HalfWidth).toBeCloseTo(1.96 * r.stdError, 10);
  });

  it("RangeError on a >= b", () => {
    expect(() => integrate1D({ f: () => 0, a: 1, b: 1, n: 100 })).toThrow(RangeError);
    expect(() => integrate1D({ f: () => 0, a: 2, b: 1, n: 100 })).toThrow(RangeError);
  });

  it("RangeError on n < 1", () => {
    expect(() => integrate1D({ f: () => 0, a: 0, b: 1, n: 0 })).toThrow(RangeError);
  });

  it("RangeError on non-finite integrand value", () => {
    expect(() =>
      integrate1D({ f: () => NaN, a: 0, b: 1, n: 10, rng: seededRng(1) }),
    ).toThrow(RangeError);
  });
});

describe("integrate2D", () => {
  it("∫∫ 1 dA over [0,1]² = 1", () => {
    const r = integrate2D({
      f: () => 1,
      ax: 0,
      bx: 1,
      ay: 0,
      by: 1,
      n: 100,
    });
    expect(r.estimate).toBeCloseTo(1, 10);
  });

  it("π via unit-disk indicator: ∫∫ 1[x²+y²<1] dA on [-1,1]² = π", () => {
    const r = integrate2D({
      f: (x, y) => (x * x + y * y < 1 ? 1 : 0),
      ax: -1,
      bx: 1,
      ay: -1,
      by: 1,
      n: 100000,
      rng: seededRng(2024),
    });
    expect(r.estimate).toBeCloseTo(Math.PI, 1);
  });

  it("∫∫ xy dA over [0,1]² = 1/4", () => {
    const r = integrate2D({
      f: (x, y) => x * y,
      ax: 0,
      bx: 1,
      ay: 0,
      by: 1,
      n: 50000,
      rng: seededRng(777),
    });
    expect(r.estimate).toBeCloseTo(0.25, 1);
  });
});
