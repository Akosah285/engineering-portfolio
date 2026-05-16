import { describe, expect, it } from "vitest";
import {
  type Complex,
  type MobiusCoeffs,
  applyMap,
  cAdd,
  cDiv,
  cExp,
  cLog,
  cMul,
  cSquare,
  cSub,
  joukowski,
  mobius,
  sampleUnitCircle,
} from "../algorithm";

describe("complex arithmetic", () => {
  it("cAdd / cSub round-trip", () => {
    const a: Complex = { re: 3, im: 4 };
    const b: Complex = { re: 1, im: -2 };
    expect(cSub(cAdd(a, b), b)).toEqual(a);
  });

  it("cMul: (2+3i)(1-4i) = 14 - 5i", () => {
    const r = cMul({ re: 2, im: 3 }, { re: 1, im: -4 });
    expect(r.re).toBe(14);
    expect(r.im).toBe(-5);
  });

  it("cDiv: division by zero throws", () => {
    expect(() => cDiv({ re: 1, im: 1 }, { re: 0, im: 0 })).toThrow(RangeError);
  });

  it("cExp(0+0i) = 1+0i", () => {
    const z = cExp({ re: 0, im: 0 });
    expect(z.re).toBeCloseTo(1, 12);
    expect(z.im).toBeCloseTo(0, 12);
  });

  it("cExp(iπ) = -1 (Euler's identity)", () => {
    const z = cExp({ re: 0, im: Math.PI });
    expect(z.re).toBeCloseTo(-1, 12);
    expect(z.im).toBeCloseTo(0, 12);
  });

  it("cLog(1) = 0", () => {
    const z = cLog({ re: 1, im: 0 });
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(0, 12);
  });

  it("cLog(0) throws", () => {
    expect(() => cLog({ re: 0, im: 0 })).toThrow(RangeError);
  });

  it("cSquare: (1+i)^2 = 2i", () => {
    const z = cSquare({ re: 1, im: 1 });
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(2, 12);
  });
});

describe("mobius transformation", () => {
  const id: MobiusCoeffs = {
    a: { re: 1, im: 0 },
    b: { re: 0, im: 0 },
    c: { re: 0, im: 0 },
    d: { re: 1, im: 0 },
  };

  it("identity Möbius (a=d=1, b=c=0) returns z", () => {
    const w = mobius(id, { re: 2, im: 3 });
    expect(w.re).toBeCloseTo(2, 12);
    expect(w.im).toBeCloseTo(3, 12);
  });

  it("translation: w = z + b", () => {
    const m: MobiusCoeffs = {
      a: { re: 1, im: 0 },
      b: { re: 1, im: 2 },
      c: { re: 0, im: 0 },
      d: { re: 1, im: 0 },
    };
    const w = mobius(m, { re: 0, im: 0 });
    expect(w.re).toBe(1);
    expect(w.im).toBe(2);
  });

  it("rejects degenerate (ad - bc ≈ 0)", () => {
    const deg: MobiusCoeffs = {
      a: { re: 1, im: 0 },
      b: { re: 2, im: 0 },
      c: { re: 2, im: 0 },
      d: { re: 4, im: 0 },
    };
    expect(() => mobius(deg, { re: 1, im: 1 })).toThrow(RangeError);
  });

  it("Cayley transform maps i to 0", () => {
    // w = (z - i)/(z + i)
    const cayley: MobiusCoeffs = {
      a: { re: 1, im: 0 },
      b: { re: 0, im: -1 },
      c: { re: 1, im: 0 },
      d: { re: 0, im: 1 },
    };
    const w = mobius(cayley, { re: 0, im: 1 });
    expect(w.re).toBeCloseTo(0, 12);
    expect(w.im).toBeCloseTo(0, 12);
  });
});

describe("joukowski", () => {
  it("rejects b ≤ 0", () => {
    expect(() => joukowski({ re: 1, im: 0 }, 0)).toThrow(RangeError);
    expect(() => joukowski({ re: 1, im: 0 }, -1)).toThrow(RangeError);
  });

  it("z=1, b=1 gives w=2 (real axis pinch)", () => {
    const w = joukowski({ re: 1, im: 0 }, 1);
    expect(w.re).toBeCloseTo(2, 12);
    expect(w.im).toBeCloseTo(0, 12);
  });

  it("maps unit circle to segment [-2, 2] on real axis (b=1)", () => {
    const pts = sampleUnitCircle(32);
    const mapped = applyMap(pts, (z) => joukowski(z, 1));
    for (const w of mapped) {
      expect(Math.abs(w.im)).toBeCloseTo(0, 10);
      expect(w.re).toBeGreaterThanOrEqual(-2 - 1e-10);
      expect(w.re).toBeLessThanOrEqual(2 + 1e-10);
    }
  });
});

describe("sampleUnitCircle", () => {
  it("rejects non-positive N", () => {
    expect(() => sampleUnitCircle(0)).toThrow(RangeError);
    expect(() => sampleUnitCircle(1.5)).toThrow(RangeError);
  });

  it("rejects radius ≤ 0", () => {
    expect(() => sampleUnitCircle(8, undefined, 0)).toThrow(RangeError);
  });

  it("produces N points at unit distance from center", () => {
    const center: Complex = { re: 5, im: -3 };
    const pts = sampleUnitCircle(16, center, 2);
    expect(pts.length).toBe(16);
    for (const p of pts) {
      const dist = Math.hypot(p.re - center.re, p.im - center.im);
      expect(dist).toBeCloseTo(2, 12);
    }
  });
});

describe("applyMap", () => {
  it("applies f to every point preserving order", () => {
    const pts: Complex[] = [
      { re: 0, im: 0 },
      { re: 1, im: 0 },
      { re: 0, im: 1 },
    ];
    const out = applyMap(pts, cSquare);
    expect(out.length).toBe(3);
    expect(out[0]).toEqual({ re: 0, im: 0 });
    expect(out[1]).toEqual({ re: 1, im: 0 });
    expect(out[2]).toEqual({ re: -1, im: 0 });
  });
});
