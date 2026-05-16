import { describe, expect, it } from "vitest";
import {
  type ComplexF,
  colorAt,
  colorGrid,
  hsvToRgb,
  hueFromArg,
  valueFromMagnitude,
} from "../algorithm";

describe("hueFromArg", () => {
  it("z=1 (arg=0) maps to hue ≈ 0.5", () => {
    expect(hueFromArg({ re: 1, im: 0 })).toBeCloseTo(0.5, 12);
  });

  it("z=i (arg=π/2) maps to hue ≈ 0.75", () => {
    expect(hueFromArg({ re: 0, im: 1 })).toBeCloseTo(0.75, 12);
  });

  it("z=-1 (arg=π) wraps to hue close to 0", () => {
    const h = hueFromArg({ re: -1, im: 0 });
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it("z=-i (arg=-π/2) maps to hue ≈ 0.25", () => {
    expect(hueFromArg({ re: 0, im: -1 })).toBeCloseTo(0.25, 12);
  });

  it("hue is always in [0, 1)", () => {
    for (const z of [
      { re: 1, im: 1 },
      { re: -1, im: -1 },
      { re: -0.001, im: 0 },
      { re: 0.001, im: 0 },
    ]) {
      const h = hueFromArg(z);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe("valueFromMagnitude", () => {
  it("|z|=0 returns 0", () => {
    expect(valueFromMagnitude({ re: 0, im: 0 })).toBe(0);
  });

  it("|z|=1 returns 0.5", () => {
    expect(valueFromMagnitude({ re: 1, im: 0 })).toBeCloseTo(0.5, 12);
    expect(valueFromMagnitude({ re: 0, im: 1 })).toBeCloseTo(0.5, 12);
  });

  it("is monotone in |z|", () => {
    const a = valueFromMagnitude({ re: 0.5, im: 0 });
    const b = valueFromMagnitude({ re: 1, im: 0 });
    const c = valueFromMagnitude({ re: 5, im: 0 });
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("is bounded in (0, 1)", () => {
    const huge = valueFromMagnitude({ re: 1e10, im: 0 });
    const tiny = valueFromMagnitude({ re: 1e-10, im: 0 });
    expect(huge).toBeLessThan(1);
    expect(tiny).toBeGreaterThan(0);
  });
});

describe("hsvToRgb", () => {
  it("red: hue 0, full sat/val", () => {
    const c = hsvToRgb({ h: 0, s: 1, v: 1 });
    expect(c.r).toBeCloseTo(1, 12);
    expect(c.g).toBeCloseTo(0, 12);
    expect(c.b).toBeCloseTo(0, 12);
  });

  it("green: hue ~ 1/3", () => {
    const c = hsvToRgb({ h: 1 / 3, s: 1, v: 1 });
    expect(c.r).toBeCloseTo(0, 6);
    expect(c.g).toBeCloseTo(1, 6);
    expect(c.b).toBeCloseTo(0, 6);
  });

  it("blue: hue ~ 2/3", () => {
    const c = hsvToRgb({ h: 2 / 3, s: 1, v: 1 });
    expect(c.r).toBeCloseTo(0, 6);
    expect(c.g).toBeCloseTo(0, 6);
    expect(c.b).toBeCloseTo(1, 6);
  });

  it("rejects out-of-range components", () => {
    expect(() => hsvToRgb({ h: 1, s: 1, v: 1 })).toThrow(RangeError);
    expect(() => hsvToRgb({ h: -0.01, s: 1, v: 1 })).toThrow(RangeError);
    expect(() => hsvToRgb({ h: 0, s: 2, v: 1 })).toThrow(RangeError);
  });
});

describe("colorAt", () => {
  it("z=1 gives hue 0.5, sat 1, v 0.5", () => {
    const c = colorAt({ re: 1, im: 0 });
    expect(c.h).toBeCloseTo(0.5, 12);
    expect(c.s).toBe(1);
    expect(c.v).toBeCloseTo(0.5, 12);
  });
});

describe("colorGrid", () => {
  it("rejects non-integer dimensions", () => {
    expect(() =>
      colorGrid((z) => z, {
        xMin: -1,
        xMax: 1,
        yMin: -1,
        yMax: 1,
        width: 4.5,
        height: 4,
      }),
    ).toThrow(RangeError);
  });

  it("rejects non-positive dimensions", () => {
    expect(() =>
      colorGrid((z) => z, {
        xMin: -1,
        xMax: 1,
        yMin: -1,
        yMax: 1,
        width: 0,
        height: 4,
      }),
    ).toThrow(RangeError);
  });

  it("rejects inverted bounds", () => {
    expect(() =>
      colorGrid((z) => z, {
        xMin: 1,
        xMax: -1,
        yMin: -1,
        yMax: 1,
        width: 4,
        height: 4,
      }),
    ).toThrow(RangeError);
  });

  it("produces width*height pixels", () => {
    const out = colorGrid((z) => z, {
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      width: 8,
      height: 6,
    });
    expect(out.length).toBe(48);
  });

  it("identity f(z)=z: corner colors reflect quadrants", () => {
    const w = 3;
    const h = 3;
    const out = colorGrid((z: ComplexF) => z, {
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      width: w,
      height: h,
    });
    // Top-row, x=0 column is the imaginary axis at +1; hue should be ~0.75
    const top = out[0 * w + 1]!;
    expect(top.h).toBeCloseTo(0.75, 6);
  });
});
