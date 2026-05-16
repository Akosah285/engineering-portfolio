import { describe, expect, it } from "vitest";
import { bayesTheorem } from "../algorithm";

describe("bayesTheorem", () => {
  it("reproduces the classic 1%-prior textbook example", () => {
    // Disease prevalence 1%, test 99% sensitive, 99% specific.
    // Famous answer: P(disease | +) ≈ 50%, NOT 99%.
    const r = bayesTheorem({
      prior: 0.01,
      sensitivity: 0.99,
      specificity: 0.99,
    });
    expect(r.posteriorPositive).toBeCloseTo(0.5, 2);
  });

  it("returns prior when the test is uninformative (sens = 1 - spec = 0.5)", () => {
    const r = bayesTheorem({
      prior: 0.3,
      sensitivity: 0.5,
      specificity: 0.5,
    });
    expect(r.posteriorPositive).toBeCloseTo(0.3, 10);
  });

  it("returns 1 when sensitivity = 1 and false-positive rate = 0", () => {
    const r = bayesTheorem({
      prior: 0.4,
      sensitivity: 1,
      specificity: 1,
    });
    expect(r.posteriorPositive).toBeCloseTo(1, 10);
  });

  it("computes posteriorNegative independently", () => {
    const r = bayesTheorem({
      prior: 0.01,
      sensitivity: 0.99,
      specificity: 0.99,
    });
    // P(disease | -) should be tiny: 0.0001 ish
    expect(r.posteriorNegative).toBeLessThan(0.001);
  });

  it("computes marginalPositive correctly", () => {
    // prior=0.5, sens=0.8, spec=0.8 → P(+) = 0.5*0.8 + 0.5*0.2 = 0.5
    const r = bayesTheorem({
      prior: 0.5,
      sensitivity: 0.8,
      specificity: 0.8,
    });
    expect(r.marginalPositive).toBeCloseTo(0.5, 10);
  });

  it("returns 0 (not NaN) when prior = 0 and posterior is undefined", () => {
    const r = bayesTheorem({
      prior: 0,
      sensitivity: 0.99,
      specificity: 1, // → marginalPositive = 0
    });
    expect(r.posteriorPositive).toBe(0);
  });

  it("rejects out-of-range prior", () => {
    expect(() =>
      bayesTheorem({ prior: -0.1, sensitivity: 0.5, specificity: 0.5 }),
    ).toThrow(RangeError);
    expect(() =>
      bayesTheorem({ prior: 1.1, sensitivity: 0.5, specificity: 0.5 }),
    ).toThrow(RangeError);
  });

  it("rejects out-of-range sensitivity / specificity", () => {
    expect(() => bayesTheorem({ prior: 0.5, sensitivity: 2, specificity: 0.5 })).toThrow(
      RangeError,
    );
    expect(() =>
      bayesTheorem({ prior: 0.5, sensitivity: 0.5, specificity: -0.5 }),
    ).toThrow(RangeError);
  });

  it("rejects NaN inputs", () => {
    expect(() =>
      bayesTheorem({ prior: Number.NaN, sensitivity: 0.5, specificity: 0.5 }),
    ).toThrow(RangeError);
  });
});
