import { describe, it, expect } from "vitest";
import {
  trescaStress,
  trescaSafetyFactor,
  tresca,
  vonMisesStress,
  vonMisesSafetyFactor,
  vonMises,
  rankineStress,
  rankineSafetyFactor,
  rankine,
} from "../algorithm";

describe("Tresca (max shear)", () => {
  it("uniaxial tension: τ_max = σ1, just yields at σ1 = σ_y", () => {
    expect(trescaStress({ s1: 100, s2: 0 })).toBe(100);
    expect(tresca({ s1: 100, s2: 0 }, 100)).toBe(true);
    expect(tresca({ s1: 99, s2: 0 }, 100)).toBe(false);
  });

  it("pure shear (σ1 = +τ, σ2 = -τ): yields at τ = σ_y/2", () => {
    expect(trescaStress({ s1: 50, s2: -50 })).toBe(100);
    expect(tresca({ s1: 50, s2: -50 }, 100)).toBe(true);
  });

  it("safety factor = σ_y / equivalent", () => {
    expect(trescaSafetyFactor({ s1: 50, s2: 0 }, 100)).toBeCloseTo(2, 10);
  });

  it("zero-stress safety factor is Infinity", () => {
    expect(trescaSafetyFactor({ s1: 0, s2: 0 }, 100)).toBe(Infinity);
  });
});

describe("von Mises (distortion energy)", () => {
  it("uniaxial tension: σ_eq = σ1", () => {
    expect(vonMisesStress({ s1: 200, s2: 0 })).toBeCloseTo(200, 10);
  });

  it("pure shear (σ1 = +τ, σ2 = -τ): yields at τ = σ_y/√3 ≈ 0.577·σ_y", () => {
    const t = 100 / Math.sqrt(3);
    expect(vonMisesStress({ s1: t, s2: -t })).toBeCloseTo(100, 8);
    expect(vonMises({ s1: t, s2: -t }, 100)).toBe(true);
  });

  it("equibiaxial tension (σ1 = σ2 = σ): σ_eq = σ (no distortion benefit drops out)", () => {
    expect(vonMisesStress({ s1: 100, s2: 100 })).toBeCloseTo(100, 10);
  });

  it("safety factor", () => {
    expect(vonMisesSafetyFactor({ s1: 100, s2: 0 }, 300)).toBeCloseTo(3, 10);
  });

  it("RangeError on σ_y <= 0", () => {
    expect(() => vonMises({ s1: 1, s2: 0 }, 0)).toThrow(RangeError);
    expect(() => vonMises({ s1: 1, s2: 0 }, -1)).toThrow(RangeError);
  });

  it("RangeError on non-finite", () => {
    expect(() => vonMises({ s1: NaN, s2: 0 }, 100)).toThrow(RangeError);
    expect(() => vonMises({ s1: 1, s2: Infinity }, 100)).toThrow(RangeError);
  });
});

describe("Rankine (max normal stress, brittle)", () => {
  it("equals max(|σ1|, |σ2|)", () => {
    expect(rankineStress({ s1: 80, s2: -120 })).toBe(120);
  });

  it("yields at σ1 = σ_ult", () => {
    expect(rankine({ s1: 100, s2: 0 }, 100)).toBe(true);
  });

  it("safety factor", () => {
    expect(rankineSafetyFactor({ s1: 50, s2: -10 }, 200)).toBeCloseTo(4, 10);
  });
});

describe("comparison: Tresca is more conservative than von Mises", () => {
  it("pure shear: Tresca says yield, von Mises says safe", () => {
    // For pure shear σ1 = +τ, σ2 = -τ:
    //   Tresca needs τ ≤ σ_y/2, von Mises needs τ ≤ σ_y/√3 ≈ 0.577·σ_y.
    const sy = 100;
    const tau = 55; // between σ_y/2 = 50 and σ_y/√3 ≈ 57.7
    expect(tresca({ s1: tau, s2: -tau }, sy)).toBe(true);
    expect(vonMises({ s1: tau, s2: -tau }, sy)).toBe(false);
  });
});
