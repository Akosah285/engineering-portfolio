import { describe, expect, it } from "vitest";
import { deflectionAt, deflectionCurve, maxDeflection } from "../algorithm";

const STEEL_W12: { L: number; E: number; I: number } = {
  L: 4,
  E: 200e9,
  I: 8.0e-5,
};

describe("maxDeflection", () => {
  it("cantilever point load: v_max = -P L^3/(3 E I) at x=L", () => {
    const { L, E, I } = STEEL_W12;
    const P = 5000;
    const r = maxDeflection({ ...STEEL_W12, load: { kind: "cantilever-point", P } });
    expect(r.x).toBe(L);
    expect(r.v).toBeCloseTo(-(P * L ** 3) / (3 * E * I), 12);
  });

  it("cantilever UDL: v_max = -w L^4/(8 E I) at x=L", () => {
    const { L, E, I } = STEEL_W12;
    const w = 1000;
    const r = maxDeflection({ ...STEEL_W12, load: { kind: "cantilever-udl", w } });
    expect(r.x).toBe(L);
    expect(r.v).toBeCloseTo(-(w * L ** 4) / (8 * E * I), 12);
  });

  it("simply-supported center point load: v_max = -P L^3/(48 E I) at x=L/2", () => {
    const { L, E, I } = STEEL_W12;
    const P = 5000;
    const r = maxDeflection({
      ...STEEL_W12,
      load: { kind: "simply-supported-point", P },
    });
    expect(r.x).toBe(L / 2);
    expect(r.v).toBeCloseTo(-(P * L ** 3) / (48 * E * I), 12);
  });

  it("simply-supported UDL: v_max = -5 w L^4/(384 E I) at x=L/2", () => {
    const { L, E, I } = STEEL_W12;
    const w = 1000;
    const r = maxDeflection({ ...STEEL_W12, load: { kind: "simply-supported-udl", w } });
    expect(r.x).toBe(L / 2);
    expect(r.v).toBeCloseTo(-(5 * w * L ** 4) / (384 * E * I), 12);
  });

  it("a cantilever point load deflects ~16× more than a simply-supported center load (same P, L, EI)", () => {
    // Ratio = (PL^3/3EI) / (PL^3/48EI) = 48/3 = 16
    const P = 1000;
    const c = maxDeflection({ ...STEEL_W12, load: { kind: "cantilever-point", P } });
    const s = maxDeflection({
      ...STEEL_W12,
      load: { kind: "simply-supported-point", P },
    });
    expect(Math.abs(c.v) / Math.abs(s.v)).toBeCloseTo(16, 10);
  });
});

describe("deflectionAt", () => {
  it("returns 0 at the fixed end x=0 for a cantilever", () => {
    const v = deflectionAt(
      { ...STEEL_W12, load: { kind: "cantilever-point", P: 5000 } },
      0,
    );
    expect(v).toBeCloseTo(0, 12);
  });

  it("returns 0 at both supports of a simply-supported beam", () => {
    const beam = {
      ...STEEL_W12,
      load: { kind: "simply-supported-udl" as const, w: 1000 },
    };
    expect(deflectionAt(beam, 0)).toBeCloseTo(0, 12);
    expect(deflectionAt(beam, beam.L)).toBeCloseTo(0, 12);
  });

  it("agrees with maxDeflection at the maximum location for all four cases", () => {
    const cases = [
      { kind: "cantilever-point" as const, P: 1234 },
      { kind: "cantilever-udl" as const, w: 567 },
      { kind: "simply-supported-point" as const, P: 1234 },
      { kind: "simply-supported-udl" as const, w: 567 },
    ];
    for (const load of cases) {
      const beam = { ...STEEL_W12, load };
      const r = maxDeflection(beam);
      expect(deflectionAt(beam, r.x)).toBeCloseTo(r.v, 10);
    }
  });

  it("simply-supported beam deflection is symmetric about midspan", () => {
    const beam = {
      ...STEEL_W12,
      load: { kind: "simply-supported-udl" as const, w: 500 },
    };
    for (const x of [0.5, 1.0, 1.5]) {
      expect(deflectionAt(beam, x)).toBeCloseTo(deflectionAt(beam, beam.L - x), 12);
    }
  });

  it("throws when x is outside [0, L]", () => {
    const beam = { ...STEEL_W12, load: { kind: "cantilever-point" as const, P: 100 } };
    expect(() => deflectionAt(beam, -0.1)).toThrow(RangeError);
    expect(() => deflectionAt(beam, beam.L + 0.1)).toThrow(RangeError);
  });
});

describe("deflectionCurve", () => {
  it("returns the requested number of evenly-spaced samples", () => {
    const beam = {
      ...STEEL_W12,
      load: { kind: "simply-supported-udl" as const, w: 1000 },
    };
    const curve = deflectionCurve(beam, 11);
    expect(curve).toHaveLength(11);
    expect(curve[0]!.x).toBe(0);
    expect(curve[10]!.x).toBeCloseTo(beam.L, 12);
    // Endpoints zero
    expect(curve[0]!.v).toBeCloseTo(0, 12);
    expect(curve[10]!.v).toBeCloseTo(0, 12);
    // Midspan is the deepest deflection
    expect(curve[5]!.x).toBeCloseTo(beam.L / 2, 12);
    expect(curve[5]!.v).toBeLessThan(curve[3]!.v);
    expect(curve[5]!.v).toBeLessThan(curve[7]!.v);
  });

  it("throws when samples < 2", () => {
    const beam = { ...STEEL_W12, load: { kind: "cantilever-point" as const, P: 100 } };
    expect(() => deflectionCurve(beam, 1)).toThrow(RangeError);
    expect(() => deflectionCurve(beam, 1.5)).toThrow(RangeError);
  });
});

describe("validation", () => {
  it("throws on non-positive L, E, or I", () => {
    const load = { kind: "cantilever-point" as const, P: 100 };
    expect(() => maxDeflection({ L: 0, E: 200e9, I: 1e-5, load })).toThrow(RangeError);
    expect(() => maxDeflection({ L: 1, E: 0, I: 1e-5, load })).toThrow(RangeError);
    expect(() => maxDeflection({ L: 1, E: 200e9, I: -1e-5, load })).toThrow(RangeError);
  });

  it("throws on non-finite P or w", () => {
    expect(() =>
      maxDeflection({
        L: 1,
        E: 200e9,
        I: 1e-5,
        load: { kind: "cantilever-point", P: Number.NaN },
      }),
    ).toThrow(RangeError);
    expect(() =>
      maxDeflection({
        L: 1,
        E: 200e9,
        I: 1e-5,
        load: { kind: "simply-supported-udl", w: Number.POSITIVE_INFINITY },
      }),
    ).toThrow(RangeError);
  });
});
