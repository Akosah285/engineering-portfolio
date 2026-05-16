import { describe, expect, it } from "vitest";
import { type Matrix, isStochastic, nStep, stationary, step } from "../algorithm";

const TWO_STATE: Matrix = [
  [0.7, 0.3],
  [0.4, 0.6],
];

// 3-state weather chain from Russell & Norvig: sunny / cloudy / rainy
const WEATHER: Matrix = [
  [0.6, 0.3, 0.1],
  [0.4, 0.4, 0.2],
  [0.2, 0.6, 0.2],
];

describe("isStochastic", () => {
  it("accepts a valid row-stochastic matrix", () => {
    expect(isStochastic(TWO_STATE)).toBe(true);
    expect(isStochastic(WEATHER)).toBe(true);
  });

  it("rejects a non-square matrix", () => {
    expect(
      isStochastic([
        [1, 0],
        [0.5, 0.3, 0.2],
      ]),
    ).toBe(false);
  });

  it("rejects negative probabilities", () => {
    expect(
      isStochastic([
        [1.2, -0.2],
        [0.5, 0.5],
      ]),
    ).toBe(false);
  });

  it("rejects rows that don't sum to 1", () => {
    expect(
      isStochastic([
        [0.5, 0.4],
        [0.5, 0.5],
      ]),
    ).toBe(false);
  });

  it("rejects an empty matrix", () => {
    expect(isStochastic([])).toBe(false);
  });
});

describe("step", () => {
  it("applies one transition correctly to a 2-state chain", () => {
    // pi=[1,0], P=[[0.7,0.3],[0.4,0.6]] ⇒ next = [0.7, 0.3]
    const next = step([1, 0], TWO_STATE);
    expect(next[0]).toBeCloseTo(0.7, 12);
    expect(next[1]).toBeCloseTo(0.3, 12);
  });

  it("preserves probability mass after one step", () => {
    const next = step([0.6, 0.4], TWO_STATE);
    const sum = next.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("throws RangeError when distribution length doesn't match P", () => {
    expect(() => step([1, 0, 0], TWO_STATE)).toThrow(RangeError);
  });

  it("throws RangeError on non-stochastic P", () => {
    expect(() =>
      step(
        [1, 0],
        [
          [0.5, 0.4],
          [0.5, 0.5],
        ],
      ),
    ).toThrow(RangeError);
  });

  it("throws RangeError on a distribution that doesn't sum to 1", () => {
    expect(() => step([0.5, 0.4], TWO_STATE)).toThrow(RangeError);
  });
});

describe("nStep", () => {
  it("returns the initial distribution unchanged when n=0", () => {
    const out = nStep([0.6, 0.4], TWO_STATE, 0);
    expect(out[0]).toBeCloseTo(0.6, 12);
    expect(out[1]).toBeCloseTo(0.4, 12);
  });

  it("composes single steps: nStep(n=2) === step(step(...))", () => {
    const a = nStep([1, 0], TWO_STATE, 2);
    const b = step(step([1, 0], TWO_STATE), TWO_STATE);
    expect(a[0]).toBeCloseTo(b[0]!, 12);
    expect(a[1]).toBeCloseTo(b[1]!, 12);
  });

  it("converges towards the 2-state chain's stationary [4/7, 3/7]", () => {
    const out = nStep([1, 0], TWO_STATE, 100);
    expect(out[0]).toBeCloseTo(4 / 7, 8);
    expect(out[1]).toBeCloseTo(3 / 7, 8);
  });

  it("throws RangeError on negative or non-integer n", () => {
    expect(() => nStep([1, 0], TWO_STATE, -1)).toThrow(RangeError);
    expect(() => nStep([1, 0], TWO_STATE, 1.5)).toThrow(RangeError);
  });
});

describe("stationary", () => {
  it("recovers the analytic 2-state stationary [4/7, 3/7] (independent of initial guess)", () => {
    const r = stationary({ P: TWO_STATE });
    expect(r.converged).toBe(true);
    expect(r.distribution[0]).toBeCloseTo(4 / 7, 10);
    expect(r.distribution[1]).toBeCloseTo(3 / 7, 10);
  });

  it("returns a stationary distribution that sums to 1", () => {
    const r = stationary({ P: WEATHER });
    const sum = r.distribution.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("returns a stationary that is invariant under P (pi @ P === pi)", () => {
    const r = stationary({ P: WEATHER });
    const after = step(r.distribution, WEATHER);
    for (let i = 0; i < r.distribution.length; i += 1) {
      expect(after[i]).toBeCloseTo(r.distribution[i]!, 9);
    }
  });

  it("identity transition has every distribution stationary; uniform seed stays uniform", () => {
    const I: Matrix = [
      [1, 0],
      [0, 1],
    ];
    const r = stationary({ P: I });
    expect(r.converged).toBe(true);
    expect(r.distribution[0]).toBeCloseTo(0.5, 12);
    expect(r.distribution[1]).toBeCloseTo(0.5, 12);
  });

  it("reports converged=false when maxIterations is too small to reach tol", () => {
    const r = stationary({ P: TWO_STATE, tol: 1e-15, maxIterations: 2 });
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(2);
  });

  it("throws RangeError on non-stochastic P", () => {
    expect(() =>
      stationary({
        P: [
          [0.5, 0.4],
          [0.5, 0.5],
        ],
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError on non-positive tol or maxIterations", () => {
    expect(() => stationary({ P: TWO_STATE, tol: 0 })).toThrow(RangeError);
    expect(() => stationary({ P: TWO_STATE, maxIterations: 0 })).toThrow(RangeError);
  });
});
