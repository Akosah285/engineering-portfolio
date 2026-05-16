import { describe, expect, it } from "vitest";
import { solve } from "../algorithm";

describe("solve — Laplace on a rectangle, Dirichlet BCs", () => {
  it("uniform BCs: solution is the uniform value everywhere", () => {
    const r = solve({ nx: 5, ny: 5, top: 10, bottom: 10, left: 10, right: 10 });
    expect(r.converged).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        expect(r.u[i]![j]!).toBeCloseTo(10, 5);
      }
    }
  });

  it("center value of symmetric problem equals average of boundary", () => {
    // For top=100, others=0 on a square, the center → 25 (Laplace mean-value).
    const r = solve({
      nx: 21,
      ny: 21,
      top: 100,
      bottom: 0,
      left: 0,
      right: 0,
      maxIter: 20000,
      tol: 1e-7,
    });
    expect(r.converged).toBe(true);
    expect(r.u[10]![10]!).toBeCloseTo(25, 0);
  });

  it("solution is harmonic — discrete Laplacian ≈ 0 at interior", () => {
    const r = solve({
      nx: 11,
      ny: 11,
      top: 1,
      bottom: 0,
      left: 0.5,
      right: 0.5,
      tol: 1e-8,
      maxIter: 10000,
    });
    expect(r.converged).toBe(true);
    for (let i = 2; i < 9; i += 1) {
      for (let j = 2; j < 9; j += 1) {
        const lap =
          r.u[i - 1]![j]! +
          r.u[i + 1]![j]! +
          r.u[i]![j - 1]! +
          r.u[i]![j + 1]! -
          4 * r.u[i]![j]!;
        expect(Math.abs(lap)).toBeLessThan(1e-4);
      }
    }
  });

  it("respects Dirichlet boundary (interior never overwrites edges)", () => {
    const r = solve({ nx: 7, ny: 7, top: 5, bottom: 0, left: 0, right: 0 });
    // Check non-corner edge cells (corners are set by last-write convention).
    for (let j = 1; j < 6; j += 1) {
      expect(r.u[0]![j]!).toBe(5);
      expect(r.u[6]![j]!).toBe(0);
    }
    for (let i = 1; i < 6; i += 1) {
      expect(r.u[i]![0]!).toBe(0);
      expect(r.u[i]![6]!).toBe(0);
    }
  });

  it("omega = 1 (Gauss-Seidel) converges slower than omega = 1.5 (SOR)", () => {
    const gs = solve({
      nx: 21,
      ny: 21,
      top: 100,
      bottom: 0,
      left: 0,
      right: 0,
      omega: 1.0,
      tol: 1e-5,
      maxIter: 50000,
    });
    const sor = solve({
      nx: 21,
      ny: 21,
      top: 100,
      bottom: 0,
      left: 0,
      right: 0,
      omega: 1.7,
      tol: 1e-5,
      maxIter: 50000,
    });
    expect(gs.iterations).toBeGreaterThan(sor.iterations);
  });

  it("RangeError on grid too small", () => {
    expect(() => solve({ nx: 2, ny: 5, top: 0, bottom: 0, left: 0, right: 0 })).toThrow(
      RangeError,
    );
  });

  it("RangeError on omega out of (0, 2)", () => {
    expect(() =>
      solve({ nx: 5, ny: 5, top: 0, bottom: 0, left: 0, right: 0, omega: 2.1 }),
    ).toThrow(RangeError);
    expect(() =>
      solve({ nx: 5, ny: 5, top: 0, bottom: 0, left: 0, right: 0, omega: 0 }),
    ).toThrow(RangeError);
  });

  it("RangeError on non-finite BC", () => {
    expect(() =>
      solve({
        nx: 5,
        ny: 5,
        top: Number.POSITIVE_INFINITY,
        bottom: 0,
        left: 0,
        right: 0,
      }),
    ).toThrow(RangeError);
  });
});
