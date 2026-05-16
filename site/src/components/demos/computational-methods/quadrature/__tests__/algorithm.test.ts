import { describe, expect, it } from "vitest";
import {
  type IntegrationInput,
  midpointRule,
  rectangleRule,
  simpsonRule,
  trapezoidRule,
} from "../algorithm";

/**
 * Pure brain of v5 Numerical Integration Comparator (#79).
 *
 * Each rule is a separate exported function so the React shell can compare
 * them side-by-side. They all share the same input shape.
 */

const linear: IntegrationInput = {
  f: (x) => 2 * x + 3,
  a: 0,
  b: 4,
  n: 16,
}; // exact = 4^2 + 12 = 28

const quadratic: IntegrationInput = {
  f: (x) => x * x,
  a: 0,
  b: 3,
  n: 64,
}; // exact = 9

describe("rectangleRule (left-endpoint)", () => {
  it("integrates a constant exactly", () => {
    expect(rectangleRule({ f: () => 5, a: 0, b: 2, n: 10 })).toBeCloseTo(10, 12);
  });

  it("approaches the true value of integral(0..3) x^2 dx as n grows", () => {
    const coarse = rectangleRule({ ...quadratic, n: 8 });
    const fine = rectangleRule({ ...quadratic, n: 1024 });
    expect(Math.abs(fine - 9)).toBeLessThan(Math.abs(coarse - 9));
  });

  it("rejects n <= 0", () => {
    expect(() => rectangleRule({ f: (x) => x, a: 0, b: 1, n: 0 })).toThrow(RangeError);
  });
});

describe("midpointRule", () => {
  it("integrates a linear function exactly", () => {
    // Midpoint rule is exact for affine functions.
    expect(midpointRule(linear)).toBeCloseTo(28, 10);
  });

  it("converges quadratically for x^2", () => {
    const e1 = Math.abs(midpointRule({ ...quadratic, n: 16 }) - 9);
    const e2 = Math.abs(midpointRule({ ...quadratic, n: 32 }) - 9);
    // Midpoint is O(h^2); doubling n should drop error by ~4x. Loosen for fp noise.
    expect(e2).toBeLessThan(e1 * 0.4);
  });
});

describe("trapezoidRule", () => {
  it("integrates a linear function exactly", () => {
    expect(trapezoidRule(linear)).toBeCloseTo(28, 10);
  });

  it("approaches integral(0..pi) sin(x) dx = 2", () => {
    const result = trapezoidRule({
      f: Math.sin,
      a: 0,
      b: Math.PI,
      n: 256,
    });
    expect(result).toBeCloseTo(2, 4);
  });

  it("rejects n <= 0", () => {
    expect(() => trapezoidRule({ f: (x) => x, a: 0, b: 1, n: -1 })).toThrow(RangeError);
  });
});

describe("simpsonRule", () => {
  it("integrates a quadratic exactly", () => {
    // Simpson's rule is exact for cubics (and below).
    expect(simpsonRule({ f: (x) => x * x, a: 0, b: 3, n: 4 })).toBeCloseTo(9, 10);
  });

  it("integrates a cubic exactly", () => {
    expect(simpsonRule({ f: (x) => x * x * x, a: 0, b: 2, n: 4 })).toBeCloseTo(4, 10);
  });

  it("approaches integral(0..pi) sin(x) dx = 2 to high precision", () => {
    const result = simpsonRule({
      f: Math.sin,
      a: 0,
      b: Math.PI,
      n: 256,
    });
    expect(result).toBeCloseTo(2, 8);
  });

  it("rejects odd n (Simpson's rule needs an even number of subintervals)", () => {
    expect(() => simpsonRule({ f: (x) => x, a: 0, b: 1, n: 5 })).toThrow(/even/i);
  });

  it("rejects n <= 0", () => {
    expect(() => simpsonRule({ f: (x) => x, a: 0, b: 1, n: 0 })).toThrow(RangeError);
  });
});

describe("all rules behave consistently when a > b (negation)", () => {
  it("integral(b..a) f = -integral(a..b) f for trapezoid", () => {
    const forward = trapezoidRule({ f: (x) => x * x, a: 0, b: 2, n: 10 });
    const reverse = trapezoidRule({ f: (x) => x * x, a: 2, b: 0, n: 10 });
    expect(reverse).toBeCloseTo(-forward, 10);
  });

  it("integral(b..a) f = -integral(a..b) f for simpson", () => {
    const forward = simpsonRule({ f: (x) => x * x * x, a: 0, b: 2, n: 8 });
    const reverse = simpsonRule({ f: (x) => x * x * x, a: 2, b: 0, n: 8 });
    expect(reverse).toBeCloseTo(-forward, 10);
  });
});
