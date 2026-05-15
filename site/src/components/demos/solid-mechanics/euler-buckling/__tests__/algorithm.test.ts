import { describe, it, expect } from "vitest";
import { eulerCriticalLoad } from "../algorithm";

describe("eulerCriticalLoad", () => {
  // Reference case from Hibbeler "Mechanics of Materials": A36 steel column,
  // W200x46 section, L=3m, pinned-pinned. E = 200 GPa, I_y = 15.4e6 mm^4 (weak axis).
  // P_cr = π² · 200e9 · 15.4e-6 / (1.0 · 3)² ≈ 3.378 MN
  it("matches the Hibbeler W200x46 pinned-pinned reference (≈3.38 MN)", () => {
    const r = eulerCriticalLoad({
      E: 200e9,
      I: 15.4e-6,
      L: 3,
      endCondition: "pinned-pinned",
    });
    expect(r.K).toBe(1.0);
    expect(r.effectiveLength).toBe(3);
    expect(r.criticalLoad / 1e6).toBeCloseTo(3.378, 2);
  });

  it("fixed-fixed quadruples the critical load vs pinned-pinned", () => {
    const base = { E: 200e9, I: 1e-6, L: 2 } as const;
    const pp = eulerCriticalLoad({ ...base, endCondition: "pinned-pinned" });
    const ff = eulerCriticalLoad({ ...base, endCondition: "fixed-fixed" });
    // K goes 1.0 → 0.5, so effectiveLength halves and load grows by 4×
    expect(ff.criticalLoad / pp.criticalLoad).toBeCloseTo(4, 10);
  });

  it("fixed-free (cantilever) quarters the critical load vs pinned-pinned", () => {
    const base = { E: 200e9, I: 1e-6, L: 2 } as const;
    const pp = eulerCriticalLoad({ ...base, endCondition: "pinned-pinned" });
    const ff = eulerCriticalLoad({ ...base, endCondition: "fixed-free" });
    // K goes 1.0 → 2.0, so effectiveLength doubles and load shrinks by 4×
    expect(ff.criticalLoad / pp.criticalLoad).toBeCloseTo(0.25, 10);
  });

  it("doubling the length quarters the critical load", () => {
    const a = eulerCriticalLoad({ E: 200e9, I: 1e-6, L: 1, endCondition: "pinned-pinned" });
    const b = eulerCriticalLoad({ E: 200e9, I: 1e-6, L: 2, endCondition: "pinned-pinned" });
    expect(b.criticalLoad / a.criticalLoad).toBeCloseTo(0.25, 10);
  });

  it("doubling I doubles the critical load", () => {
    const a = eulerCriticalLoad({ E: 200e9, I: 1e-6, L: 2, endCondition: "pinned-pinned" });
    const b = eulerCriticalLoad({ E: 200e9, I: 2e-6, L: 2, endCondition: "pinned-pinned" });
    expect(b.criticalLoad / a.criticalLoad).toBeCloseTo(2, 12);
  });

  it("returns null for slenderness fields when area is not supplied", () => {
    const r = eulerCriticalLoad({
      E: 200e9,
      I: 1e-6,
      L: 2,
      endCondition: "pinned-pinned",
    });
    expect(r.criticalStress).toBeNull();
    expect(r.slendernessRatio).toBeNull();
    expect(r.validIfSlenderEnough).toBeNull();
  });

  it("computes slenderness ratio L_eff / sqrt(I/A) when area is supplied", () => {
    // Solid square cross-section a=0.05m: A = 2.5e-3 m², I = a^4/12 = 5.208e-7 m⁴
    // r = sqrt(I/A) = a/sqrt(12) ≈ 0.01443 m, L_eff = 2 m, λ ≈ 138.6
    const a = 0.05;
    const A = a ** 2;
    const I = a ** 4 / 12;
    const r = eulerCriticalLoad({
      E: 200e9,
      I,
      L: 2,
      endCondition: "pinned-pinned",
      area: A,
    });
    expect(r.slendernessRatio).not.toBeNull();
    expect(r.slendernessRatio!).toBeCloseTo(2 / (a / Math.sqrt(12)), 6);
    expect(r.criticalStress).not.toBeNull();
    expect(r.criticalStress!).toBeCloseTo(r.criticalLoad / A, 6);
  });

  it("flags a stocky column as outside the Euler regime via validIfSlenderEnough", () => {
    // Very short, stocky column: low slenderness, will be governed by yield.
    const a = 0.1; // 100 mm × 100 mm
    const r = eulerCriticalLoad({
      E: 200e9,
      I: a ** 4 / 12,
      L: 0.3, // 300 mm long
      endCondition: "pinned-pinned",
      area: a ** 2,
      yieldStress: 250e6, // A36 steel
    });
    expect(r.validIfSlenderEnough).toBe(false);
  });

  it("flags a long, slender column as inside the Euler regime", () => {
    // Long, slender column: λ should be well above λ_c for steel (~125)
    const r = eulerCriticalLoad({
      E: 200e9,
      I: 1e-8,
      L: 3,
      endCondition: "pinned-pinned",
      area: 1e-4,
      yieldStress: 250e6,
    });
    expect(r.validIfSlenderEnough).toBe(true);
  });

  it("throws RangeError on non-positive E, I, or L", () => {
    const base = { E: 200e9, I: 1e-6, L: 2, endCondition: "pinned-pinned" } as const;
    expect(() => eulerCriticalLoad({ ...base, E: 0 })).toThrow(RangeError);
    expect(() => eulerCriticalLoad({ ...base, I: -1 })).toThrow(RangeError);
    expect(() => eulerCriticalLoad({ ...base, L: 0 })).toThrow(RangeError);
  });

  it("throws RangeError on unknown end condition", () => {
    expect(() =>
      eulerCriticalLoad({
        E: 200e9,
        I: 1e-6,
        L: 2,
        // @ts-expect-error testing invalid runtime input
        endCondition: "fixed-rotational",
      }),
    ).toThrow(RangeError);
  });
});
