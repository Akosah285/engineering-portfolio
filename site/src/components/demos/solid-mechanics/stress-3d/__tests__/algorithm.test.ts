import { describe, expect, it } from "vitest";
import {
  hydrostatic,
  invariants,
  maxShear,
  principalStresses,
  vonMises,
} from "../algorithm";

const hydro: Parameters<typeof invariants>[0] = {
  sx: 100,
  sy: 100,
  sz: 100,
  txy: 0,
  txz: 0,
  tyz: 0,
};

const diagDistinct = {
  sx: 100,
  sy: 50,
  sz: 25,
  txy: 0,
  txz: 0,
  tyz: 0,
};

const uniaxial = {
  sx: 200,
  sy: 0,
  sz: 0,
  txy: 0,
  txz: 0,
  tyz: 0,
};

const pureShearXY = {
  sx: 0,
  sy: 0,
  sz: 0,
  txy: 50,
  txz: 0,
  tyz: 0,
};

describe("invariants", () => {
  it("I1 = trace", () => {
    expect(invariants(diagDistinct).I1).toBe(175);
  });

  it("hydrostatic: I1=3σ, I2=3σ², I3=σ³", () => {
    const I = invariants(hydro);
    expect(I.I1).toBe(300);
    expect(I.I2).toBe(30000);
    expect(I.I3).toBe(1_000_000);
  });

  it("RangeError on non-finite component", () => {
    expect(() =>
      invariants({ sx: Number.NaN, sy: 0, sz: 0, txy: 0, txz: 0, tyz: 0 }),
    ).toThrow(RangeError);
  });
});

describe("principalStresses", () => {
  it("diagonal tensor → principals are the diagonal sorted descending", () => {
    const p = principalStresses(diagDistinct);
    expect(p[0]).toBeCloseTo(100, 8);
    expect(p[1]).toBeCloseTo(50, 8);
    expect(p[2]).toBeCloseTo(25, 8);
  });

  it("hydrostatic: all three principals = σ", () => {
    const p = principalStresses(hydro);
    expect(p[0]).toBeCloseTo(100, 6);
    expect(p[1]).toBeCloseTo(100, 6);
    expect(p[2]).toBeCloseTo(100, 6);
  });

  it("uniaxial tension along x: (σ, 0, 0)", () => {
    const p = principalStresses(uniaxial);
    expect(p[0]).toBeCloseTo(200, 5);
    expect(p[1]).toBeCloseTo(0, 5);
    expect(p[2]).toBeCloseTo(0, 5);
  });

  it("pure shear in xy: (+τ, 0, -τ)", () => {
    const p = principalStresses(pureShearXY);
    expect(p[0]).toBeCloseTo(50, 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(-50, 6);
  });

  it("non-trivial tensor reproduces I1 = sum of principals (invariant under rotation)", () => {
    const s = { sx: 80, sy: 20, sz: -10, txy: 30, txz: 15, tyz: -5 };
    const p = principalStresses(s);
    const I1 = invariants(s).I1;
    expect(p[0] + p[1] + p[2]).toBeCloseTo(I1, 6);
  });

  it("descending order", () => {
    const p = principalStresses({ sx: 1, sy: 5, sz: 3, txy: 0, txz: 0, tyz: 0 });
    expect(p[0]).toBeGreaterThanOrEqual(p[1]);
    expect(p[1]).toBeGreaterThanOrEqual(p[2]);
  });
});

describe("maxShear", () => {
  it("uniaxial: τ_max = σ/2", () => {
    expect(maxShear(uniaxial)).toBeCloseTo(100, 6);
  });

  it("pure shear: τ_max = τ", () => {
    expect(maxShear(pureShearXY)).toBeCloseTo(50, 6);
  });

  it("hydrostatic: τ_max = 0", () => {
    expect(maxShear(hydro)).toBeCloseTo(0, 6);
  });
});

describe("hydrostatic stress", () => {
  it("= I1/3", () => {
    expect(hydrostatic(diagDistinct)).toBeCloseTo(175 / 3, 10);
    expect(hydrostatic(hydro)).toBe(100);
  });
});

describe("vonMises", () => {
  it("uniaxial: σ_vm = σ_x", () => {
    expect(vonMises(uniaxial)).toBeCloseTo(200, 6);
  });

  it("hydrostatic: σ_vm = 0 (distortion-free)", () => {
    expect(vonMises(hydro)).toBeCloseTo(0, 6);
  });

  it("pure shear τ: σ_vm = τ√3", () => {
    expect(vonMises(pureShearXY)).toBeCloseTo(50 * Math.sqrt(3), 4);
  });
});
