import { describe, it, expect } from "vitest";
import { polarMomentOfArea, torsionAnalysis } from "../algorithm";

describe("polarMomentOfArea", () => {
  it("J = pi*r^4/2 for a solid shaft (r=0.025 → ~6.136e-7 m^4)", () => {
    const J = polarMomentOfArea({ kind: "solid", radius: 0.025 });
    expect(J).toBeCloseTo((Math.PI * 0.025 ** 4) / 2, 14);
    expect(J).toBeCloseTo(6.135923e-7, 9);
  });

  it("J = pi*(r_o^4 - r_i^4)/2 for a hollow shaft", () => {
    const J = polarMomentOfArea({
      kind: "hollow",
      outerRadius: 0.05,
      innerRadius: 0.04,
    });
    const expected = (Math.PI * (0.05 ** 4 - 0.04 ** 4)) / 2;
    expect(J).toBeCloseTo(expected, 14);
  });

  it("hollow with inner=0 reduces to the solid case", () => {
    const Jh = polarMomentOfArea({ kind: "hollow", outerRadius: 0.05, innerRadius: 0 });
    const Js = polarMomentOfArea({ kind: "solid", radius: 0.05 });
    expect(Jh).toBeCloseTo(Js, 14);
  });

  it("throws when innerRadius >= outerRadius", () => {
    expect(() =>
      polarMomentOfArea({ kind: "hollow", outerRadius: 0.05, innerRadius: 0.05 }),
    ).toThrow(RangeError);
    expect(() =>
      polarMomentOfArea({ kind: "hollow", outerRadius: 0.04, innerRadius: 0.05 }),
    ).toThrow(RangeError);
  });

  it("throws on non-positive radii", () => {
    expect(() => polarMomentOfArea({ kind: "solid", radius: 0 })).toThrow(RangeError);
    expect(() => polarMomentOfArea({ kind: "solid", radius: -1 })).toThrow(RangeError);
    expect(() =>
      polarMomentOfArea({ kind: "hollow", outerRadius: 0, innerRadius: 0 }),
    ).toThrow(RangeError);
  });
});

describe("torsionAnalysis", () => {
  // Hibbeler Example 5.3-style: solid steel shaft, r=12.5mm, L=1.5m, T=80 N·m, G=75 GPa
  it("matches the textbook solid-shaft case (T=80 N·m, r=12.5mm)", () => {
    const r = torsionAnalysis({
      torque: 80,
      length: 1.5,
      shearModulus: 75e9,
      geometry: { kind: "solid", radius: 0.0125 },
    });
    const J = (Math.PI * 0.0125 ** 4) / 2; // 3.835e-8
    expect(r.J).toBeCloseTo(J, 14);
    expect(r.outerRadius).toBe(0.0125);
    // τ = 80 * 0.0125 / 3.835e-8 ≈ 26.07 MPa
    expect(r.maxShearStress / 1e6).toBeCloseTo(26.07, 1);
    // φ = 80 * 1.5 / (75e9 * 3.835e-8) ≈ 0.04173 rad
    expect(r.twistAngle).toBeCloseTo(0.04173, 4);
    expect(r.twistRate).toBeCloseTo(r.twistAngle / 1.5, 12);
  });

  it("τ_max scales linearly with torque", () => {
    const base = {
      length: 1,
      shearModulus: 80e9,
      geometry: { kind: "solid", radius: 0.02 } as const,
    };
    const a = torsionAnalysis({ ...base, torque: 100 });
    const b = torsionAnalysis({ ...base, torque: 250 });
    expect(b.maxShearStress / a.maxShearStress).toBeCloseTo(2.5, 12);
  });

  it("twistAngle is negative when torque is negative (sign preserved)", () => {
    const r = torsionAnalysis({
      torque: -50,
      length: 1,
      shearModulus: 80e9,
      geometry: { kind: "solid", radius: 0.02 },
    });
    expect(r.twistAngle).toBeLessThan(0);
    // But τ_max is the magnitude of stress
    expect(r.maxShearStress).toBeGreaterThan(0);
  });

  it("doubling outer radius reduces max shear stress by 8× (J grows r^4, c grows r)", () => {
    const a = torsionAnalysis({
      torque: 100,
      length: 1,
      shearModulus: 80e9,
      geometry: { kind: "solid", radius: 0.01 },
    });
    const b = torsionAnalysis({
      torque: 100,
      length: 1,
      shearModulus: 80e9,
      geometry: { kind: "solid", radius: 0.02 },
    });
    expect(a.maxShearStress / b.maxShearStress).toBeCloseTo(8, 10);
  });

  it("hollow shaft with inner=0 matches the solid case for τ_max and φ", () => {
    const params = { torque: 200, length: 1.2, shearModulus: 80e9 };
    const solid = torsionAnalysis({ ...params, geometry: { kind: "solid", radius: 0.03 } });
    const hollow = torsionAnalysis({
      ...params,
      geometry: { kind: "hollow", outerRadius: 0.03, innerRadius: 0 },
    });
    expect(hollow.maxShearStress).toBeCloseTo(solid.maxShearStress, 8);
    expect(hollow.twistAngle).toBeCloseTo(solid.twistAngle, 12);
  });

  it("throws on non-positive length or shear modulus", () => {
    const base = {
      torque: 10,
      geometry: { kind: "solid", radius: 0.01 } as const,
    };
    expect(() => torsionAnalysis({ ...base, length: 0, shearModulus: 80e9 })).toThrow(RangeError);
    expect(() => torsionAnalysis({ ...base, length: 1, shearModulus: 0 })).toThrow(RangeError);
  });

  it("throws on non-finite torque", () => {
    expect(() =>
      torsionAnalysis({
        torque: Number.NaN,
        length: 1,
        shearModulus: 80e9,
        geometry: { kind: "solid", radius: 0.01 },
      }),
    ).toThrow(RangeError);
  });
});
