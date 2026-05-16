import { describe, it, expect } from "vitest";
import {
  c,
  add,
  sub,
  mul,
  div,
  abs,
  eq,
  residueSimplePole,
  residueRationalSimple,
  contourIntegral,
} from "../algorithm";

describe("complex arithmetic primitives", () => {
  it("add/sub/mul/div basics", () => {
    expect(add(c(1, 2), c(3, 4))).toEqual({ re: 4, im: 6 });
    expect(sub(c(1, 2), c(3, 4))).toEqual({ re: -2, im: -2 });
    expect(mul(c(1, 2), c(3, 4))).toEqual({ re: -5, im: 10 });
    expect(div(c(1, 2), c(3, 4))).toEqual({ re: 11 / 25, im: 2 / 25 });
  });

  it("|i| = 1", () => {
    expect(abs(c(0, 1))).toBe(1);
  });

  it("eq tolerance", () => {
    expect(eq(c(1, 1), c(1.0000001, 1), 1e-5)).toBe(true);
    expect(eq(c(1, 1), c(1.1, 1), 1e-5)).toBe(false);
  });

  it("division by zero throws", () => {
    expect(() => div(c(1, 0), c(0, 0))).toThrow(RangeError);
  });
});

describe("residueSimplePole", () => {
  it("Res(1/(z²+1), i) = 1/(2i) = -i/2", () => {
    const f = (z: { re: number; im: number }) => {
      // 1 / (z² + 1)
      const z2 = mul(z, z);
      return div(c(1, 0), add(z2, c(1, 0)));
    };
    const r = residueSimplePole(f, c(0, 1), 1e-3);
    expect(r.re).toBeCloseTo(0, 3);
    expect(r.im).toBeCloseTo(-0.5, 2);
  });

  it("Res(1/(z²+1), -i) = i/2", () => {
    const f = (z: { re: number; im: number }) => {
      const z2 = mul(z, z);
      return div(c(1, 0), add(z2, c(1, 0)));
    };
    const r = residueSimplePole(f, c(0, -1), 1e-3);
    expect(r.re).toBeCloseTo(0, 3);
    expect(r.im).toBeCloseTo(0.5, 2);
  });

  it("Res(1/(z-a), a) = 1 (canonical simple pole)", () => {
    const a = c(2, 3);
    const f = (z: { re: number; im: number }) => div(c(1, 0), sub(z, a));
    const r = residueSimplePole(f, a, 1e-4);
    expect(r.re).toBeCloseTo(1, 4);
    expect(r.im).toBeCloseTo(0, 4);
  });

  it("RangeError on eps <= 0", () => {
    expect(() =>
      residueSimplePole(() => c(0, 0), c(0, 0), 0),
    ).toThrow(RangeError);
  });
});

describe("residueRationalSimple (closed form for rationals p/q)", () => {
  it("Res(1/(z²+1), i) via p(i)/q'(i) = 1/(2i) = -i/2", () => {
    const num = (_z: { re: number; im: number }) => c(1, 0);
    const denDeriv = (z: { re: number; im: number }) => mul(c(2, 0), z); // d/dz (z²+1) = 2z
    const r = residueRationalSimple(num, denDeriv, c(0, 1));
    expect(r.re).toBeCloseTo(0, 10);
    expect(r.im).toBeCloseTo(-0.5, 10);
  });

  it("Res(z/(z²+1), i) = i / (2i) = 1/2", () => {
    const num = (z: { re: number; im: number }) => z;
    const denDeriv = (z: { re: number; im: number }) => mul(c(2, 0), z);
    const r = residueRationalSimple(num, denDeriv, c(0, 1));
    expect(r.re).toBeCloseTo(0.5, 10);
    expect(r.im).toBeCloseTo(0, 10);
  });
});

describe("contourIntegral", () => {
  it("∮ 1/(z²+1) dz over circle enclosing only z=i: 2πi · (-i/2) = π", () => {
    const I = contourIntegral([c(0, -0.5)]);
    expect(I.re).toBeCloseTo(Math.PI, 10);
    expect(I.im).toBeCloseTo(0, 10);
  });

  it("∮ over both poles: residues cancel → integral = 0", () => {
    const I = contourIntegral([c(0, -0.5), c(0, 0.5)]);
    expect(I.re).toBeCloseTo(0, 10);
    expect(I.im).toBeCloseTo(0, 10);
  });

  it("sum of residues at integer poles → 2πi · n", () => {
    // Three residues each = 1
    const I = contourIntegral([c(1, 0), c(1, 0), c(1, 0)]);
    expect(I.re).toBeCloseTo(0, 10);
    expect(I.im).toBeCloseTo(6 * Math.PI, 10);
  });
});
