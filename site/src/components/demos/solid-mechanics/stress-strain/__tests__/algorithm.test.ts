import { describe, expect, it } from "vitest";
import { type StressStrainParams, curve, stressAt, yieldStrain } from "../algorithm";

// Mild steel / A36-style synthetic curve
const STEEL: StressStrainParams = {
  E: 200e9, // 200 GPa
  yieldStress: 250e6, // 250 MPa
  ultimateStress: 400e6, // 400 MPa
  plateauEndStrain: 0.02,
  ultimateStrain: 0.18,
  failureStrain: 0.25,
};

describe("yieldStrain", () => {
  it("ε_y = σ_y / E", () => {
    expect(yieldStrain(STEEL)).toBeCloseTo(250e6 / 200e9, 12);
    expect(yieldStrain(STEEL)).toBeCloseTo(0.00125, 8);
  });
});

describe("stressAt — elastic region (Hooke's law)", () => {
  it("σ(0) = 0", () => {
    expect(stressAt(STEEL, 0)).toBeCloseTo(0, 6);
  });

  it("σ(ε) = E·ε for ε < ε_y", () => {
    for (const eps of [0.0001, 0.0005, 0.001, 0.00124]) {
      expect(stressAt(STEEL, eps)).toBeCloseTo(STEEL.E * eps, 0);
    }
  });

  it("σ(ε_y) ≈ σ_y", () => {
    expect(stressAt(STEEL, yieldStrain(STEEL))).toBeCloseTo(STEEL.yieldStress, 0);
  });
});

describe("stressAt — plastic plateau", () => {
  it("σ = σ_y for any ε ∈ (ε_y, ε_h]", () => {
    expect(stressAt(STEEL, 0.005)).toBeCloseTo(STEEL.yieldStress, 0);
    expect(stressAt(STEEL, 0.015)).toBeCloseTo(STEEL.yieldStress, 0);
    expect(stressAt(STEEL, STEEL.plateauEndStrain)).toBeCloseTo(STEEL.yieldStress, 0);
  });
});

describe("stressAt — strain hardening", () => {
  it("σ rises monotonically from σ_y to ≈ σ_u between ε_h and ε_u", () => {
    const samples = 50;
    let prev = stressAt(STEEL, STEEL.plateauEndStrain);
    for (let i = 1; i <= samples; i += 1) {
      const eps =
        STEEL.plateauEndStrain +
        (i / samples) * (STEEL.ultimateStrain - STEEL.plateauEndStrain);
      const sigma = stressAt(STEEL, eps);
      expect(sigma).toBeGreaterThanOrEqual(prev - 1e-3); // monotone (allow tiny FP wobble)
      prev = sigma;
    }
  });

  it("σ(ε_u) is exactly σ_u (curve is normalised so the peak lands on σ_u)", () => {
    expect(stressAt(STEEL, STEEL.ultimateStrain)).toBeCloseTo(STEEL.ultimateStress, 0);
  });

  it("hardeningSharpness controls how quickly σ approaches σ_u", () => {
    const eps = (STEEL.plateauEndStrain + STEEL.ultimateStrain) / 2;
    const flat = stressAt({ ...STEEL, hardeningSharpness: 0.5 }, eps);
    const steep = stressAt({ ...STEEL, hardeningSharpness: 8 }, eps);
    expect(steep).toBeGreaterThan(flat);
  });
});

describe("stressAt — necking region", () => {
  it("σ drops linearly from σ_u at ε_u to 0 at ε_f", () => {
    expect(stressAt(STEEL, STEEL.ultimateStrain)).toBeCloseTo(STEEL.ultimateStress, 0);
    const mid = (STEEL.ultimateStrain + STEEL.failureStrain) / 2;
    expect(stressAt(STEEL, mid)).toBeCloseTo(STEEL.ultimateStress / 2, 0);
    expect(stressAt(STEEL, STEEL.failureStrain)).toBeCloseTo(0, 0);
  });

  it("σ = 0 for ε > ε_f (post-fracture)", () => {
    expect(stressAt(STEEL, STEEL.failureStrain + 0.01)).toBe(0);
  });
});

describe("curve", () => {
  it("returns the requested number of samples spanning [0, ε_f]", () => {
    const c = curve(STEEL, 21);
    expect(c).toHaveLength(21);
    expect(c[0]!.strain).toBe(0);
    expect(c[20]!.strain).toBeCloseTo(STEEL.failureStrain, 12);
    expect(c[20]!.stress).toBeCloseTo(0, 0);
  });

  it("includes a sample at the proportional region (small strain)", () => {
    const c = curve(STEEL, 1000);
    // Find the first sample with strain >= 0.0005
    const elastic = c.find((p) => p.strain >= 0.0005);
    expect(elastic).toBeDefined();
    expect(elastic!.stress).toBeGreaterThan(0);
  });

  it("throws on samples < 2", () => {
    expect(() => curve(STEEL, 1)).toThrow(RangeError);
  });
});

describe("validation", () => {
  it("throws if ultimateStress <= yieldStress", () => {
    expect(() => stressAt({ ...STEEL, ultimateStress: STEEL.yieldStress }, 0)).toThrow(
      RangeError,
    );
  });

  it("throws if ultimateStrain <= plateauEndStrain", () => {
    expect(() =>
      stressAt({ ...STEEL, ultimateStrain: STEEL.plateauEndStrain }, 0),
    ).toThrow(RangeError);
  });

  it("throws if failureStrain <= ultimateStrain", () => {
    expect(() => stressAt({ ...STEEL, failureStrain: STEEL.ultimateStrain }, 0)).toThrow(
      RangeError,
    );
  });

  it("throws if plateauEndStrain < yield strain", () => {
    expect(() => stressAt({ ...STEEL, plateauEndStrain: 0.0001 }, 0)).toThrow(RangeError);
  });

  it("throws on negative strain", () => {
    expect(() => stressAt(STEEL, -0.01)).toThrow(RangeError);
  });
});
