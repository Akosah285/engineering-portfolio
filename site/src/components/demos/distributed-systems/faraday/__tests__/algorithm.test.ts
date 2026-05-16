import { describe, it, expect } from "vitest";
import { flux, peakEmf, emfRotating, emfFromBSeries } from "../algorithm";

describe("flux", () => {
  it("Φ = N·B·A·cos(θ); θ=0 → full alignment", () => {
    expect(flux(2, 0.5, 0, 3)).toBeCloseTo(3 * 2 * 0.5, 10);
  });

  it("θ=π/2 → zero flux (normal perpendicular to B)", () => {
    expect(flux(1, 1, Math.PI / 2)).toBeCloseTo(0, 10);
  });

  it("θ=π → flux reverses sign", () => {
    expect(flux(1, 2, Math.PI)).toBeCloseTo(-2, 10);
  });

  it("default N = 1", () => {
    expect(flux(2, 3, 0)).toBeCloseTo(6, 10);
  });

  it("RangeError on negative A", () => {
    expect(() => flux(1, -1, 0)).toThrow(RangeError);
  });

  it("RangeError on N < 1", () => {
    expect(() => flux(1, 1, 0, 0)).toThrow(RangeError);
  });
});

describe("peakEmf", () => {
  it("|ε_peak| = N B A ω", () => {
    expect(peakEmf(100, 0.5, 0.01, 60 * 2 * Math.PI)).toBeCloseTo(
      100 * 0.5 * 0.01 * 60 * 2 * Math.PI,
      6,
    );
  });

  it("absolute value (sign of ω irrelevant)", () => {
    expect(peakEmf(1, 1, 1, -10)).toBe(10);
  });
});

describe("emfRotating", () => {
  it("ε(0) = 0 (starts at peak flux)", () => {
    expect(emfRotating(1, 1, 1, 1, 0)).toBeCloseTo(0, 10);
  });

  it("ε at ωt = π/2 = peak", () => {
    const omega = 2;
    const peak = peakEmf(10, 0.1, 0.05, omega);
    expect(emfRotating(10, 0.1, 0.05, omega, Math.PI / (2 * omega))).toBeCloseTo(peak, 6);
  });

  it("ε at ωt = π = 0", () => {
    expect(emfRotating(5, 1, 0.5, 1, Math.PI)).toBeCloseTo(0, 10);
  });
});

describe("emfFromBSeries", () => {
  it("constant B → ε ≈ 0", () => {
    const e = emfFromBSeries({ A: 1, dt: 0.1, Bsamples: [2, 2, 2, 2, 2] });
    for (const v of e) {
      expect(v).toBeCloseTo(0, 10);
    }
  });

  it("linear B(t) = α·t → ε = -A·α (constant)", () => {
    const alpha = 3;
    const dt = 0.1;
    const Bsamples = Array.from({ length: 10 }, (_, i) => alpha * i * dt);
    const e = emfFromBSeries({ A: 2, dt, Bsamples });
    // Interior central differences should give exactly -A·α.
    for (let i = 1; i < e.length - 1; i += 1) {
      expect(e[i]!).toBeCloseTo(-2 * alpha, 6);
    }
  });

  it("N turns multiplies result", () => {
    const e1 = emfFromBSeries({ N: 1, A: 1, dt: 0.1, Bsamples: [0, 1, 2, 3] });
    const e2 = emfFromBSeries({ N: 5, A: 1, dt: 0.1, Bsamples: [0, 1, 2, 3] });
    for (let i = 0; i < e1.length; i += 1) {
      expect(e2[i]!).toBeCloseTo(5 * e1[i]!, 10);
    }
  });

  it("RangeError on < 2 samples", () => {
    expect(() => emfFromBSeries({ A: 1, dt: 0.1, Bsamples: [1] })).toThrow(RangeError);
  });

  it("RangeError on dt <= 0", () => {
    expect(() => emfFromBSeries({ A: 1, dt: 0, Bsamples: [1, 2, 3] })).toThrow(RangeError);
  });
});
