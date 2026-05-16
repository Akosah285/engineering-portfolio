import { describe, it, expect } from "vitest";
import {
  erf,
  normalCdf,
  oneSampleZ,
  twoSampleZ,
  decide,
} from "../algorithm";

describe("erf + normalCdf primitives", () => {
  it("erf(0) = 0", () => {
    expect(erf(0)).toBeCloseTo(0, 6);
  });

  it("erf(±∞-ish) ≈ ±1", () => {
    expect(erf(5)).toBeCloseTo(1, 6);
    expect(erf(-5)).toBeCloseTo(-1, 6);
  });

  it("normalCdf(0) = 0.5", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it("normalCdf(1.96) ≈ 0.975 (textbook 95% one-tail)", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });

  it("normalCdf(-1.96) ≈ 0.025", () => {
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("respects mu and sigma", () => {
    expect(normalCdf(10, 10, 5)).toBeCloseTo(0.5, 6);
    expect(normalCdf(15, 10, 5)).toBeCloseTo(normalCdf(1), 4);
  });
});

describe("oneSampleZ", () => {
  it("z = (xbar - mu0) / (sigma/√n)", () => {
    const r = oneSampleZ({ xbar: 105, mu0: 100, sigma: 10, n: 25 });
    // z = 5 / (10/5) = 2.5
    expect(r.z).toBeCloseTo(2.5, 10);
  });

  it("two-sided p-value at z = 1.96 ≈ 0.05", () => {
    const r = oneSampleZ({ xbar: 1.96, mu0: 0, sigma: 1, n: 1 });
    expect(r.pValue).toBeCloseTo(0.05, 2);
  });

  it("greater alternative: p = 1 - Φ(z)", () => {
    const r = oneSampleZ({
      xbar: 1.645,
      mu0: 0,
      sigma: 1,
      n: 1,
      alternative: "greater",
    });
    expect(r.pValue).toBeCloseTo(0.05, 2);
  });

  it("less alternative: p = Φ(z)", () => {
    const r = oneSampleZ({
      xbar: -1.645,
      mu0: 0,
      sigma: 1,
      n: 1,
      alternative: "less",
    });
    expect(r.pValue).toBeCloseTo(0.05, 2);
  });

  it("xbar = mu0 → z = 0, two-sided p = 1", () => {
    const r = oneSampleZ({ xbar: 5, mu0: 5, sigma: 1, n: 10 });
    expect(r.z).toBe(0);
    expect(r.pValue).toBeCloseTo(1, 6);
  });

  it("RangeError on sigma <= 0", () => {
    expect(() => oneSampleZ({ xbar: 0, mu0: 0, sigma: 0, n: 10 })).toThrow(RangeError);
  });

  it("RangeError on n < 1", () => {
    expect(() => oneSampleZ({ xbar: 0, mu0: 0, sigma: 1, n: 0 })).toThrow(RangeError);
  });
});

describe("twoSampleZ", () => {
  it("identical samples → z = 0", () => {
    const r = twoSampleZ({
      xbar1: 10,
      xbar2: 10,
      sigma1: 2,
      sigma2: 2,
      n1: 30,
      n2: 30,
    });
    expect(r.z).toBe(0);
  });

  it("z-statistic with pooled SE", () => {
    // (50 - 45) / √(25/100 + 16/100) = 5 / √0.41 ≈ 7.808
    const r = twoSampleZ({
      xbar1: 50,
      xbar2: 45,
      sigma1: 5,
      sigma2: 4,
      n1: 100,
      n2: 100,
    });
    expect(r.z).toBeCloseTo(5 / Math.sqrt(0.41), 6);
  });

  it("mu0Diff offset", () => {
    const r = twoSampleZ({
      xbar1: 10,
      xbar2: 5,
      sigma1: 1,
      sigma2: 1,
      n1: 100,
      n2: 100,
      mu0Diff: 5,
    });
    expect(r.z).toBe(0);
  });

  it("RangeError on bad inputs", () => {
    expect(() =>
      twoSampleZ({ xbar1: 0, xbar2: 0, sigma1: 0, sigma2: 1, n1: 1, n2: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      twoSampleZ({ xbar1: 0, xbar2: 0, sigma1: 1, sigma2: 1, n1: 0, n2: 1 }),
    ).toThrow(RangeError);
  });
});

describe("decide", () => {
  it("reject when p < alpha", () => {
    expect(decide(0.01, 0.05)).toBe("reject H0");
  });
  it("fail to reject when p >= alpha", () => {
    expect(decide(0.06, 0.05)).toBe("fail to reject H0");
    expect(decide(0.05, 0.05)).toBe("fail to reject H0"); // p < α, not <=
  });
  it("RangeError on bad p or alpha", () => {
    expect(() => decide(-0.1, 0.05)).toThrow(RangeError);
    expect(() => decide(1.1, 0.05)).toThrow(RangeError);
    expect(() => decide(0.05, 0)).toThrow(RangeError);
    expect(() => decide(0.05, 1)).toThrow(RangeError);
  });
});
