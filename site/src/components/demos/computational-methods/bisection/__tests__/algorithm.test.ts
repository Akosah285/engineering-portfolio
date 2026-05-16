import { describe, expect, it } from "vitest";
import { type BisectionResult, bisection } from "../algorithm";

/**
 * Pure brain of v5 Bisection demo (#78).
 *
 * Returns the bracket sequence so the React shell can render the
 * shrinking interval. We require `f(a)` and `f(b)` to have opposite signs
 * (or one of them be exactly zero) — caller must establish a valid bracket.
 */

describe("bisection", () => {
  it("converges on f(x) = x^2 - 2 over [0, 2] to sqrt(2)", () => {
    const result = bisection({
      f: (x) => x * x - 2,
      a: 0,
      b: 2,
      tolerance: 1e-10,
      maxIterations: 60,
    });
    expect(result.status).toBe("converged");
    expect(result.root).not.toBeNull();
    expect(result.root).toBeCloseTo(Math.SQRT2, 8);
  });

  it("returns the bracket trace shrinking each step", () => {
    const result = bisection({
      f: (x) => x - 1,
      a: 0,
      b: 4,
      tolerance: 1e-6,
      maxIterations: 50,
    });
    expect(result.brackets[0]).toEqual([0, 4]);
    // Each bracket is half the previous width — except the very last one,
    // which we collapse to [mid, mid] when convergence is reached.
    const upTo =
      result.status === "converged" ? result.brackets.length - 1 : result.brackets.length;
    for (let i = 1; i < upTo; i += 1) {
      const prev = result.brackets[i - 1]!;
      const curr = result.brackets[i]!;
      const prevWidth = prev[1] - prev[0];
      const currWidth = curr[1] - curr[0];
      expect(currWidth).toBeCloseTo(prevWidth / 2, 12);
    }
  });

  it("rejects a bracket with same-sign endpoints", () => {
    expect(() =>
      bisection({
        f: (x) => x * x + 1,
        a: -1,
        b: 1,
        tolerance: 1e-6,
        maxIterations: 50,
      }),
    ).toThrow(/sign/i);
  });

  it("returns the endpoint immediately if it's exactly a root", () => {
    const result = bisection({
      f: (x) => x,
      a: 0, // f(a) = 0 already
      b: 1,
      tolerance: 1e-9,
      maxIterations: 50,
    });
    expect(result.status).toBe("converged");
    expect(result.root).toBe(0);
  });

  it("works with a < b reversed (auto-corrects)", () => {
    const result = bisection({
      f: (x) => x - 3,
      a: 5,
      b: 0, // intentionally reversed
      tolerance: 1e-8,
      maxIterations: 50,
    });
    expect(result.status).toBe("converged");
    expect(result.root).toBeCloseTo(3, 7);
  });

  it("flags 'max-iterations' when budget is too small", () => {
    const result: BisectionResult = bisection({
      f: (x) => x - 1,
      a: 0,
      b: 1024,
      tolerance: 1e-15,
      maxIterations: 3,
    });
    // 1 initial + 3 steps = 4 brackets max
    expect(result.brackets.length).toBeLessThanOrEqual(4);
    expect(result.status).toBe("max-iterations");
  });

  it("rejects non-positive maxIterations", () => {
    expect(() =>
      bisection({
        f: (x) => x,
        a: -1,
        b: 1,
        tolerance: 1e-6,
        maxIterations: 0,
      }),
    ).toThrow(RangeError);
  });

  it("rejects non-positive tolerance", () => {
    expect(() =>
      bisection({
        f: (x) => x,
        a: -1,
        b: 1,
        tolerance: 0,
        maxIterations: 10,
      }),
    ).toThrow(RangeError);
  });

  it("rejects identical bracket endpoints", () => {
    expect(() =>
      bisection({
        f: (x) => x,
        a: 1,
        b: 1,
        tolerance: 1e-6,
        maxIterations: 10,
      }),
    ).toThrow(/bracket/i);
  });
});
