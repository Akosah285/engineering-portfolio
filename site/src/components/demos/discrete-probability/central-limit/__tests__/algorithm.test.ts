import { describe, expect, it } from "vitest";

import {
  distributionMean,
  distributionVariance,
  mulberry32,
  sampleMeans,
} from "../algorithm";

describe("distributionMean / distributionVariance", () => {
  it("uniform[0,1] has mean 1/2 and variance 1/12", () => {
    const d = { kind: "uniform", a: 0, b: 1 } as const;
    expect(distributionMean(d)).toBeCloseTo(0.5, 12);
    expect(distributionVariance(d)).toBeCloseTo(1 / 12, 12);
  });

  it("exponential(λ) has mean 1/λ and variance 1/λ²", () => {
    const d = { kind: "exponential", lambda: 2 } as const;
    expect(distributionMean(d)).toBeCloseTo(0.5, 12);
    expect(distributionVariance(d)).toBeCloseTo(0.25, 12);
  });

  it("bernoulli(p) has mean p and variance p(1-p)", () => {
    const d = { kind: "bernoulli", p: 0.3 } as const;
    expect(distributionMean(d)).toBeCloseTo(0.3, 12);
    expect(distributionVariance(d)).toBeCloseTo(0.21, 12);
  });

  it("RangeError on invalid parameters", () => {
    expect(() => distributionMean({ kind: "uniform", a: 1, b: 0 })).toThrow(RangeError);
    expect(() => distributionMean({ kind: "exponential", lambda: 0 })).toThrow(RangeError);
    expect(() => distributionMean({ kind: "bernoulli", p: 1.5 })).toThrow(RangeError);
    expect(() => distributionVariance({ kind: "uniform", a: 1, b: 0 })).toThrow(RangeError);
    expect(() => distributionVariance({ kind: "exponential", lambda: 0 })).toThrow(RangeError);
    expect(() => distributionVariance({ kind: "bernoulli", p: -0.1 })).toThrow(RangeError);
  });
});

describe("sampleMeans — CLT predictions", () => {
  it("uniform[0,1]: empirical mean ≈ 0.5 and empirical sd ≈ sqrt(1/(12n))", () => {
    const result = sampleMeans({
      distribution: { kind: "uniform", a: 0, b: 1 },
      n: 30,
      nSamples: 5000,
      random: mulberry32(123),
    });
    expect(Math.abs(result.empiricalMean - 0.5)).toBeLessThan(0.01);
    const expectedStd = Math.sqrt(1 / (12 * 30));
    expect(Math.abs(result.empiricalStd - expectedStd) / expectedStd).toBeLessThan(0.05);
  });

  it("exponential(1): empirical mean ≈ 1 and empirical sd ≈ 1/√n", () => {
    const result = sampleMeans({
      distribution: { kind: "exponential", lambda: 1 },
      n: 50,
      nSamples: 3000,
      random: mulberry32(7),
    });
    expect(Math.abs(result.empiricalMean - 1)).toBeLessThan(0.05);
    const expectedStd = Math.sqrt(1 / 50);
    expect(Math.abs(result.empiricalStd - expectedStd) / expectedStd).toBeLessThan(0.1);
  });

  it("bernoulli(0.5): empirical mean ≈ 0.5 and empirical sd ≈ sqrt(0.25/n)", () => {
    const result = sampleMeans({
      distribution: { kind: "bernoulli", p: 0.5 },
      n: 100,
      nSamples: 3000,
      random: mulberry32(99),
    });
    expect(Math.abs(result.empiricalMean - 0.5)).toBeLessThan(0.01);
    const expectedStd = Math.sqrt(0.25 / 100);
    expect(Math.abs(result.empiricalStd - expectedStd) / expectedStd).toBeLessThan(0.1);
  });

  it("returns means.length == nSamples", () => {
    const r = sampleMeans({
      distribution: { kind: "uniform", a: 0, b: 1 },
      n: 5,
      nSamples: 50,
      random: mulberry32(1),
    });
    expect(r.means.length).toBe(50);
  });

  it("RangeError on bad n / nSamples", () => {
    const d = { kind: "uniform", a: 0, b: 1 } as const;
    expect(() => sampleMeans({ distribution: d, n: 0, nSamples: 10 })).toThrow(RangeError);
    expect(() => sampleMeans({ distribution: d, n: 1, nSamples: 0 })).toThrow(RangeError);
    expect(() => sampleMeans({ distribution: d, n: 1.5, nSamples: 10 })).toThrow(RangeError);
  });
});

describe("sampleMeans — determinism with seed", () => {
  it("seeded runs return identical means", () => {
    const a = sampleMeans({
      distribution: { kind: "uniform", a: 0, b: 1 },
      n: 10,
      nSamples: 100,
      random: mulberry32(5),
    });
    const b = sampleMeans({
      distribution: { kind: "uniform", a: 0, b: 1 },
      n: 10,
      nSamples: 100,
      random: mulberry32(5),
    });
    expect(a.means).toEqual(b.means);
  });
});
