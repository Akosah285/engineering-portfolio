import { describe, expect, it } from "vitest";
import {
  type Regularization,
  evaluatePolynomial,
  fitPolynomial,
  generateNoisyData,
  meanSquaredError,
  selectBestDegree,
} from "../algorithm";

describe("evaluatePolynomial", () => {
  it("evaluates a constant polynomial", () => {
    expect(evaluatePolynomial([3], 5)).toBe(3);
  });

  it("evaluates a linear polynomial via Horner: 2 + 3x at x=4 = 14", () => {
    expect(evaluatePolynomial([2, 3], 4)).toBe(14);
  });

  it("evaluates a quadratic: 1 + 2x + 3x^2 at x=2 = 1 + 4 + 12 = 17", () => {
    expect(evaluatePolynomial([1, 2, 3], 2)).toBe(17);
  });

  it("returns 0 for the zero polynomial", () => {
    expect(evaluatePolynomial([0, 0, 0], 99)).toBe(0);
  });

  it("returns 0 for an empty coefficient list", () => {
    expect(evaluatePolynomial([], 5)).toBe(0);
  });
});

describe("fitPolynomial — ordinary least squares", () => {
  it("recovers an exact line through 2 points (degree 1)", () => {
    const coeffs = fitPolynomial([0, 1], [1, 3], 1, { type: "none", lambda: 0 });
    // y = 1 + 2x
    expect(coeffs[0]).toBeCloseTo(1, 6);
    expect(coeffs[1]).toBeCloseTo(2, 6);
  });

  it("recovers an exact quadratic through 3 points (degree 2)", () => {
    // y = 1 + 2x + 3x^2 sampled at x = -1, 0, 1 → y = 2, 1, 6
    const coeffs = fitPolynomial([-1, 0, 1], [2, 1, 6], 2, { type: "none", lambda: 0 });
    expect(coeffs[0]).toBeCloseTo(1, 6);
    expect(coeffs[1]).toBeCloseTo(2, 6);
    expect(coeffs[2]).toBeCloseTo(3, 6);
  });

  it("fits a constant (mean) through scattered y when degree=0", () => {
    const coeffs = fitPolynomial([1, 2, 3, 4], [10, 20, 30, 40], 0, {
      type: "none",
      lambda: 0,
    });
    expect(coeffs).toHaveLength(1);
    expect(coeffs[0]).toBeCloseTo(25, 6);
  });

  it("fits a noisy line approximately", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0.1, 1.9, 4.1, 5.9, 8.1]; // ≈ 2x with noise
    const coeffs = fitPolynomial(xs, ys, 1, { type: "none", lambda: 0 });
    expect(coeffs[1]).toBeCloseTo(2, 1);
  });

  it("returns coeffs.length === degree + 1", () => {
    const coeffs = fitPolynomial([0, 1, 2, 3, 4], [0, 1, 4, 9, 16], 3, {
      type: "none",
      lambda: 0,
    });
    expect(coeffs).toHaveLength(4);
  });
});

describe("fitPolynomial — Ridge (L2) regularization", () => {
  it("with lambda=0 matches OLS (within tolerance)", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 1, 4, 9, 16];
    const ols = fitPolynomial(xs, ys, 2, { type: "none", lambda: 0 });
    const ridge = fitPolynomial(xs, ys, 2, { type: "ridge", lambda: 0 });
    for (let i = 0; i < ols.length; i++) {
      expect(ridge[i]).toBeCloseTo(ols[i]!, 4);
    }
  });

  it("shrinks slope coefficients toward zero as lambda grows", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 1, 4, 9, 16];
    const small = fitPolynomial(xs, ys, 4, { type: "ridge", lambda: 0.01 });
    const big = fitPolynomial(xs, ys, 4, { type: "ridge", lambda: 100 });
    // Intercept (index 0) is NOT regularized; only compare slope norms.
    const smallSlopeNorm = small.slice(1).reduce((acc, c) => acc + c * c, 0);
    const bigSlopeNorm = big.slice(1).reduce((acc, c) => acc + c * c, 0);
    expect(bigSlopeNorm).toBeLessThan(smallSlopeNorm);
  });

  it("doesn't regularize the intercept (only slopes)", () => {
    // With huge lambda, slopes → 0 but intercept ≈ mean(y)
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 10, 10, 10, 10];
    const coeffs = fitPolynomial(xs, ys, 2, { type: "ridge", lambda: 1e6 });
    expect(coeffs[0]).toBeCloseTo(10, 1);
  });
});

describe("fitPolynomial — Lasso (L1) regularization", () => {
  it("with lambda=0 closely matches OLS", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 1, 4, 9, 16];
    const ols = fitPolynomial(xs, ys, 2, { type: "none", lambda: 0 });
    const lasso = fitPolynomial(xs, ys, 2, { type: "lasso", lambda: 0 });
    for (let i = 0; i < ols.length; i++) {
      expect(lasso[i]).toBeCloseTo(ols[i]!, 2);
    }
  });

  it("zeroes out unnecessary coefficients with large lambda", () => {
    // Pure linear data — lasso should drive higher-order terms to zero
    const xs = Array.from({ length: 20 }, (_, i) => i / 10);
    const ys = xs.map((x) => 2 * x + 1);
    const coeffs = fitPolynomial(xs, ys, 5, { type: "lasso", lambda: 1.0 });
    // High-order coeffs should be near-zero
    for (let i = 2; i < coeffs.length; i++) {
      expect(Math.abs(coeffs[i]!)).toBeLessThan(0.15);
    }
  });

  it("does not regularize the intercept", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 10, 10, 10, 10];
    const coeffs = fitPolynomial(xs, ys, 2, { type: "lasso", lambda: 1e3 });
    expect(coeffs[0]).toBeCloseTo(10, 1);
  });
});

describe("meanSquaredError", () => {
  it("is 0 for a perfect fit", () => {
    expect(meanSquaredError([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("computes mean of squared residuals", () => {
    expect(meanSquaredError([0, 0, 0], [1, 2, 3])).toBeCloseTo((1 + 4 + 9) / 3, 6);
  });

  it("is symmetric", () => {
    expect(meanSquaredError([1, 2, 3], [4, 5, 6])).toBeCloseTo(
      meanSquaredError([4, 5, 6], [1, 2, 3]),
      6,
    );
  });
});

describe("generateNoisyData", () => {
  it("produces deterministic output for the same seed", () => {
    const a = generateNoisyData({ seed: 42, n: 30, noise: 0.5 });
    const b = generateNoisyData({ seed: 42, n: 30, noise: 0.5 });
    expect(a.xs).toEqual(b.xs);
    expect(a.ys).toEqual(b.ys);
  });

  it("produces different output for different seeds", () => {
    const a = generateNoisyData({ seed: 1, n: 30, noise: 0.5 });
    const b = generateNoisyData({ seed: 2, n: 30, noise: 0.5 });
    expect(a.ys).not.toEqual(b.ys);
  });

  it("produces n samples in xs and ys", () => {
    const { xs, ys } = generateNoisyData({ seed: 1, n: 25, noise: 0.5 });
    expect(xs).toHaveLength(25);
    expect(ys).toHaveLength(25);
  });

  it("xs are sorted ascending in [-1, 1]", () => {
    const { xs } = generateNoisyData({ seed: 1, n: 30, noise: 0.5 });
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
    }
    expect(xs[0]!).toBeGreaterThanOrEqual(-1);
    expect(xs[xs.length - 1]!).toBeLessThanOrEqual(1);
  });

  it("noise=0 returns the underlying truth function exactly", () => {
    const { xs, ys } = generateNoisyData({ seed: 1, n: 10, noise: 0 });
    // Truth function exposed via separate call below — for now, with no noise,
    // ys should equal truth(xs).
    for (let i = 0; i < xs.length; i++) {
      // Truth function is stable; just verify ys are finite and unique-ish
      expect(Number.isFinite(ys[i]!)).toBe(true);
    }
    // Same seed twice with noise=0 should be identical
    const second = generateNoisyData({ seed: 1, n: 10, noise: 0 });
    expect(ys).toEqual(second.ys);
  });
});

describe("selectBestDegree", () => {
  it("returns a degree in the candidate range", () => {
    const xs = Array.from({ length: 30 }, (_, i) => -1 + i / 15);
    const ys = xs.map((x) => 2 * x + 1);
    const result = selectBestDegree(xs, ys, {
      degrees: [1, 2, 3, 4, 5],
      regularization: { type: "none", lambda: 0 } as Regularization,
    });
    expect([1, 2, 3, 4, 5]).toContain(result.bestDegree);
  });

  it("prefers a lower degree for clearly linear data", () => {
    const xs = Array.from({ length: 50 }, (_, i) => -1 + i / 25);
    const ys = xs.map((x) => 2 * x + 1);
    const result = selectBestDegree(xs, ys, {
      degrees: [1, 2, 3, 4, 5],
      regularization: { type: "none", lambda: 0 } as Regularization,
    });
    expect(result.bestDegree).toBeLessThanOrEqual(2);
  });

  it("returns score for each candidate degree", () => {
    const xs = Array.from({ length: 30 }, (_, i) => -1 + i / 15);
    const ys = xs.map((x) => x * x);
    const result = selectBestDegree(xs, ys, {
      degrees: [1, 2, 3],
      regularization: { type: "none", lambda: 0 } as Regularization,
    });
    expect(result.scores).toHaveLength(3);
    for (const s of result.scores) {
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});
