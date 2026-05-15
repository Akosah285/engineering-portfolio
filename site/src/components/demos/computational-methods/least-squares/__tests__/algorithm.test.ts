import { describe, it, expect } from "vitest";
import { linearFit, predict } from "../algorithm";

describe("linearFit", () => {
  it("recovers slope=2 intercept=1 for noiseless y = 2x + 1", () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2 * x + 1);
    const fit = linearFit({ xs, ys });
    expect(fit.slope).toBeCloseTo(2, 12);
    expect(fit.intercept).toBeCloseTo(1, 12);
    expect(fit.r2).toBeCloseTo(1, 12);
    expect(fit.residualSumOfSquares).toBeCloseTo(0, 12);
  });

  it("recovers a negative slope (y = -3x + 7)", () => {
    const xs = [-2, -1, 0, 1, 2, 3];
    const ys = xs.map((x) => -3 * x + 7);
    const fit = linearFit({ xs, ys });
    expect(fit.slope).toBeCloseTo(-3, 12);
    expect(fit.intercept).toBeCloseTo(7, 12);
    expect(fit.r2).toBeCloseTo(1, 12);
  });

  it("matches the textbook Anscombe-quartet I result (slope ≈ 0.5, intercept ≈ 3)", () => {
    // Anscombe quartet, dataset I — every dataset fits y ≈ 0.5x + 3 with R² ≈ 0.667
    const xs = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    const ys = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
    const fit = linearFit({ xs, ys });
    expect(fit.slope).toBeCloseTo(0.5001, 3);
    expect(fit.intercept).toBeCloseTo(3.0001, 3);
    expect(fit.r2).toBeCloseTo(0.6665, 3);
  });

  it("predict(fit, x) = slope·x + intercept", () => {
    const xs = [0, 1, 2, 3];
    const ys = [1, 3, 5, 7]; // y = 2x + 1
    const fit = linearFit({ xs, ys });
    expect(predict(fit, 10)).toBeCloseTo(21, 12);
    expect(predict(fit, -5)).toBeCloseTo(-9, 12);
  });

  it("R^2 falls below 1 with noise (jittered version of the same line)", () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = [1.1, 2.9, 5.2, 6.8, 9.1, 10.9]; // slope ≈ 2, slightly noisy
    const fit = linearFit({ xs, ys });
    expect(fit.r2).toBeGreaterThan(0.9);
    expect(fit.r2).toBeLessThan(1);
    expect(fit.residualSumOfSquares).toBeGreaterThan(0);
  });

  it("throws when xs and ys have different lengths", () => {
    expect(() => linearFit({ xs: [1, 2, 3], ys: [1, 2] })).toThrow(RangeError);
  });

  it("throws when fewer than 2 points are given", () => {
    expect(() => linearFit({ xs: [1], ys: [2] })).toThrow(RangeError);
  });

  it("throws when xs have zero variance (vertical line — slope undefined)", () => {
    expect(() => linearFit({ xs: [3, 3, 3], ys: [1, 2, 3] })).toThrow(RangeError);
  });

  it("throws on non-finite values in xs or ys", () => {
    expect(() => linearFit({ xs: [1, Number.NaN, 3], ys: [1, 2, 3] })).toThrow(RangeError);
    expect(() => linearFit({ xs: [1, 2, 3], ys: [1, Infinity, 3] })).toThrow(RangeError);
  });

  it("produces NaN R^2 when ys are perfectly constant (degenerate variance)", () => {
    const fit = linearFit({ xs: [0, 1, 2, 3], ys: [5, 5, 5, 5] });
    expect(fit.slope).toBeCloseTo(0, 12);
    expect(fit.intercept).toBeCloseTo(5, 12);
    expect(Number.isNaN(fit.r2)).toBe(true);
  });
});
