import { describe, expect, it } from "vitest";
import { newtonsMethod, type NewtonResult } from "../algorithm";

/**
 * Pure brain of v5 Newton's Method demo (#77).
 *
 * The function returns the iterates so the React shell can render the
 * tangent-line steps; convergence/divergence/cycle detection is part of
 * the brain so the demo can colour-code outcomes consistently.
 */

describe("newtonsMethod", () => {
  it("converges on f(x) = x^2 - 2 to sqrt(2)", () => {
    const result = newtonsMethod({
      f: (x) => x * x - 2,
      df: (x) => 2 * x,
      x0: 1.5,
      tolerance: 1e-10,
      maxIterations: 50,
    });
    expect(result.status).toBe("converged");
    expect(result.root).not.toBeNull();
    expect(result.root).toBeCloseTo(Math.SQRT2, 9);
  });

  it("converges on f(x) = cos(x) - x to the Dottie number", () => {
    const result = newtonsMethod({
      f: (x) => Math.cos(x) - x,
      df: (x) => -Math.sin(x) - 1,
      x0: 0.5,
      tolerance: 1e-10,
      maxIterations: 50,
    });
    expect(result.status).toBe("converged");
    expect(result.root).toBeCloseTo(0.7390851332, 8);
  });

  it("returns the iterate trace including the seed", () => {
    const result = newtonsMethod({
      f: (x) => x * x - 4,
      df: (x) => 2 * x,
      x0: 3,
      tolerance: 1e-8,
      maxIterations: 20,
    });
    // Seed is the first entry; after that each step should approach 2
    expect(result.iterates[0]).toBe(3);
    expect(result.iterates.length).toBeGreaterThan(1);
    expect(result.iterates[result.iterates.length - 1]).toBeCloseTo(2, 7);
  });

  it("flags 'diverged' when df(x) hits zero (horizontal tangent)", () => {
    const result = newtonsMethod({
      f: (x) => x * x + 1,
      df: (x) => 2 * x,
      x0: 0,
      tolerance: 1e-9,
      maxIterations: 20,
    });
    expect(result.status).toBe("diverged");
    expect(result.root).toBeNull();
  });

  it("flags 'max-iterations' when convergence is too slow", () => {
    // f(x) = x^3 has a triple root at 0; Newton converges only linearly.
    const result = newtonsMethod({
      f: (x) => x * x * x,
      df: (x) => 3 * x * x,
      x0: 1,
      tolerance: 1e-15,
      maxIterations: 5,
    });
    expect(result.status).toBe("max-iterations");
  });

  it("handles f' = 0 at the seed itself by reporting diverged immediately", () => {
    const result = newtonsMethod({
      f: (x) => x * x - 1,
      df: (x) => 2 * x,
      x0: 0,
      tolerance: 1e-9,
      maxIterations: 10,
    });
    expect(result.status).toBe("diverged");
    expect(result.iterates).toEqual([0]);
  });

  it("respects maxIterations exactly", () => {
    const result: NewtonResult = newtonsMethod({
      f: (x) => x * x - 9,
      df: (x) => 2 * x,
      x0: 100, // slow start
      tolerance: 1e-30,
      maxIterations: 3,
    });
    // 1 seed + 3 steps = 4 iterates max
    expect(result.iterates.length).toBeLessThanOrEqual(4);
  });

  it("returns 'converged' immediately when |f(x0)| < tolerance", () => {
    const result = newtonsMethod({
      f: (x) => x - 5,
      df: () => 1,
      x0: 5, // exact root
      tolerance: 1e-6,
      maxIterations: 10,
    });
    expect(result.status).toBe("converged");
    expect(result.root).toBe(5);
    expect(result.iterates).toEqual([5]);
  });

  it("rejects non-positive maxIterations with RangeError", () => {
    expect(() =>
      newtonsMethod({
        f: (x) => x,
        df: () => 1,
        x0: 1,
        tolerance: 1e-6,
        maxIterations: 0,
      }),
    ).toThrow(RangeError);
  });

  it("rejects non-positive tolerance with RangeError", () => {
    expect(() =>
      newtonsMethod({
        f: (x) => x,
        df: () => 1,
        x0: 1,
        tolerance: 0,
        maxIterations: 10,
      }),
    ).toThrow(RangeError);
  });
});
