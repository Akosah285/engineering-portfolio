import { describe, expect, it } from "vitest";

import {
  approximateCollisionProbability,
  curve,
  exactCollisionProbability,
  smallestNForProbability,
} from "../algorithm";

describe("exactCollisionProbability", () => {
  it("returns 0 for n=0 and n=1 (no possible collision)", () => {
    expect(exactCollisionProbability({ n: 0 })).toBe(0);
    expect(exactCollisionProbability({ n: 1 })).toBe(0);
  });

  it("returns 1 once n exceeds the number of days (pigeonhole)", () => {
    expect(exactCollisionProbability({ n: 366 })).toBe(1);
    expect(exactCollisionProbability({ n: 1000 })).toBe(1);
    expect(exactCollisionProbability({ n: 8, daysInYear: 7 })).toBe(1);
  });

  it("matches the textbook value at n=23 (≈0.5073)", () => {
    expect(exactCollisionProbability({ n: 23 })).toBeCloseTo(0.5073, 3);
  });

  it("is strictly increasing in n on [2, daysInYear]", () => {
    let prev = -1;
    for (let n = 2; n <= 60; n += 1) {
      const p = exactCollisionProbability({ n });
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it("RangeError on negative or non-integer n", () => {
    expect(() => exactCollisionProbability({ n: -1 })).toThrow(RangeError);
    expect(() => exactCollisionProbability({ n: 1.5 })).toThrow(RangeError);
  });

  it("RangeError on non-positive or non-integer daysInYear", () => {
    expect(() => exactCollisionProbability({ n: 5, daysInYear: 0 })).toThrow(RangeError);
    expect(() => exactCollisionProbability({ n: 5, daysInYear: -7 })).toThrow(RangeError);
    expect(() => exactCollisionProbability({ n: 5, daysInYear: 365.25 })).toThrow(
      RangeError,
    );
  });
});

describe("approximateCollisionProbability", () => {
  it("agrees with the exact value to within 1.5% for n>=10", () => {
    for (let n = 10; n <= 60; n += 1) {
      const a = approximateCollisionProbability({ n });
      const e = exactCollisionProbability({ n });
      expect(Math.abs(a - e)).toBeLessThan(0.015);
    }
  });

  it("returns 0 for n<=1", () => {
    expect(approximateCollisionProbability({ n: 0 })).toBe(0);
    expect(approximateCollisionProbability({ n: 1 })).toBe(0);
  });

  it("RangeError on bad input", () => {
    expect(() => approximateCollisionProbability({ n: -2 })).toThrow(RangeError);
    expect(() => approximateCollisionProbability({ n: 5, daysInYear: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("smallestNForProbability", () => {
  it("returns 23 for target=0.5 in a 365-day year (the textbook headline)", () => {
    expect(smallestNForProbability({ target: 0.5 })).toBe(23);
  });

  it("returns 41 for target=0.9 in a 365-day year", () => {
    expect(smallestNForProbability({ target: 0.9 })).toBe(41);
  });

  it("returns 0 when target is exactly 0", () => {
    expect(smallestNForProbability({ target: 0 })).toBe(0);
  });

  it("RangeError when target is outside [0,1]", () => {
    expect(() => smallestNForProbability({ target: -0.1 })).toThrow(RangeError);
    expect(() => smallestNForProbability({ target: 1.1 })).toThrow(RangeError);
  });

  it("works on a tiny day count and produces a reasonable answer", () => {
    expect(smallestNForProbability({ target: 0.5, daysInYear: 7 })).toBe(4);
  });
});

describe("curve", () => {
  it("produces nMax points indexed 1..nMax", () => {
    const c = curve(50);
    expect(c.length).toBe(50);
    expect(c[0]!.n).toBe(1);
    expect(c[49]!.n).toBe(50);
  });

  it("the exact curve crosses 0.5 at n=23", () => {
    const c = curve(50);
    const idx23 = c.findIndex((p) => p.n === 23)!;
    expect(c[idx23 - 1]!.exact).toBeLessThan(0.5);
    expect(c[idx23]!.exact).toBeGreaterThanOrEqual(0.5);
  });

  it("RangeError on nMax < 1 or non-integer", () => {
    expect(() => curve(0)).toThrow(RangeError);
    expect(() => curve(1.5)).toThrow(RangeError);
  });
});
