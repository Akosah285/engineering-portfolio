import { describe, it, expect } from "vitest";
import {
  momentOfInertia,
  yMax,
  bendingStress,
  maxBendingStress,
  sectionModulus,
  type Section,
} from "../algorithm";

describe("momentOfInertia", () => {
  it("rectangle: bh³/12", () => {
    expect(momentOfInertia({ kind: "rect", b: 100, h: 200 })).toBeCloseTo(
      (100 * Math.pow(200, 3)) / 12,
      6,
    );
  });

  it("circle: πR⁴/4", () => {
    expect(momentOfInertia({ kind: "circle", R: 50 })).toBeCloseTo(
      (Math.PI * Math.pow(50, 4)) / 4,
      6,
    );
  });

  it("ibeam: (BH³ - bh³)/12", () => {
    const I = momentOfInertia({ kind: "ibeam", B: 100, H: 200, b: 80, h: 180 });
    expect(I).toBeCloseTo(
      (100 * Math.pow(200, 3) - 80 * Math.pow(180, 3)) / 12,
      6,
    );
  });

  it("RangeError on non-positive dims", () => {
    expect(() =>
      momentOfInertia({ kind: "rect", b: 0, h: 10 }),
    ).toThrow(RangeError);
    expect(() => momentOfInertia({ kind: "circle", R: -1 })).toThrow(RangeError);
    expect(() =>
      momentOfInertia({ kind: "ibeam", B: 100, H: 100, b: 100, h: 50 }),
    ).toThrow(RangeError);
  });
});

describe("yMax", () => {
  it("rectangle = h/2", () => {
    expect(yMax({ kind: "rect", b: 100, h: 200 })).toBe(100);
  });
  it("circle = R", () => {
    expect(yMax({ kind: "circle", R: 50 })).toBe(50);
  });
  it("ibeam = H/2", () => {
    expect(yMax({ kind: "ibeam", B: 100, H: 200, b: 80, h: 180 })).toBe(100);
  });
});

describe("bendingStress (flexure formula)", () => {
  it("σ = -M·y / I", () => {
    expect(bendingStress(1000, 5, 100)).toBeCloseTo(-50, 10);
  });

  it("M positive (sagging): top fiber compressed (σ < 0), bottom fiber tension (σ > 0)", () => {
    const I = 100;
    expect(bendingStress(1000, 5, I)).toBeLessThan(0); // top (y > 0): compression
    expect(bendingStress(1000, -5, I)).toBeGreaterThan(0); // bottom: tension
  });

  it("neutral axis (y = 0) has zero stress", () => {
    expect(bendingStress(1000, 0, 100)).toBeCloseTo(0, 10);
  });

  it("RangeError on I <= 0", () => {
    expect(() => bendingStress(1000, 5, 0)).toThrow(RangeError);
    expect(() => bendingStress(1000, 5, -10)).toThrow(RangeError);
  });

  it("RangeError on non-finite", () => {
    expect(() => bendingStress(NaN, 5, 100)).toThrow(RangeError);
  });
});

describe("maxBendingStress", () => {
  it("rectangle 100×200 under M=1000: σ_max = M*c/I", () => {
    const s: Section = { kind: "rect", b: 100, h: 200 };
    const I = (100 * Math.pow(200, 3)) / 12;
    const c = 100;
    expect(maxBendingStress(1000, s)).toBeCloseTo((1000 * c) / I, 10);
  });

  it("uses |M| (sign-independent)", () => {
    const s: Section = { kind: "rect", b: 100, h: 200 };
    expect(maxBendingStress(-500, s)).toBeCloseTo(maxBendingStress(500, s), 10);
  });

  it("section with larger I has smaller σ_max for same M", () => {
    const small: Section = { kind: "rect", b: 100, h: 100 };
    const big: Section = { kind: "rect", b: 100, h: 200 };
    expect(maxBendingStress(1000, big)).toBeLessThan(maxBendingStress(1000, small));
  });
});

describe("sectionModulus", () => {
  it("rectangle: S = bh²/6", () => {
    expect(sectionModulus({ kind: "rect", b: 60, h: 120 })).toBeCloseTo(
      (60 * 120 * 120) / 6,
      6,
    );
  });
});
