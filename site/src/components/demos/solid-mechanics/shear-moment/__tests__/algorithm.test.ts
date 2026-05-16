import { describe, expect, it } from "vitest";

import { analyze } from "../algorithm";

describe("analyze — single point load at midspan", () => {
  it("RA = RB = P/2", () => {
    const r = analyze({
      L: 10,
      pointLoads: [{ x: 5, P: 1000 }],
    });
    expect(r.RA).toBeCloseTo(500, 9);
    expect(r.RB).toBeCloseTo(500, 9);
  });

  it("max moment = PL/4 at midspan", () => {
    const r = analyze({
      L: 10,
      pointLoads: [{ x: 5, P: 1000 }],
      nSamples: 1001,
    });
    const Mmax = Math.max(...r.samples.map((s) => Math.abs(s.M)));
    expect(Mmax).toBeCloseTo((1000 * 10) / 4, 6); // = 2500
  });

  it("M(0) ≈ 0 and M(L) ≈ 0 at the supports", () => {
    const r = analyze({
      L: 10,
      pointLoads: [{ x: 5, P: 1000 }],
    });
    expect(r.samples[0]!.M).toBeCloseTo(0, 9);
    expect(r.samples[r.samples.length - 1]!.M).toBeCloseTo(0, 6);
  });

  it("V jumps by -P at the load location", () => {
    const r = analyze({
      L: 10,
      pointLoads: [{ x: 5, P: 1000 }],
      nSamples: 1001,
    });
    // Sample 500 is exactly at x=5; V at 499 is left of load; V at 500 is right of load.
    expect(r.samples[499]!.V).toBeCloseTo(500, 9);
    expect(r.samples[500]!.V).toBeCloseTo(-500, 9);
  });
});

describe("analyze — UDL across full span", () => {
  it("reactions are wL/2 each", () => {
    const r = analyze({
      L: 10,
      udls: [{ xStart: 0, xEnd: 10, w: 100 }],
    });
    expect(r.RA).toBeCloseTo(500, 9);
    expect(r.RB).toBeCloseTo(500, 9);
  });

  it("max moment = wL²/8 at midspan", () => {
    const r = analyze({
      L: 10,
      udls: [{ xStart: 0, xEnd: 10, w: 100 }],
      nSamples: 2001,
    });
    const Mmax = Math.max(...r.samples.map((s) => s.M));
    expect(Mmax).toBeCloseTo((100 * 100) / 8, 6); // 1250
  });

  it("M(0) = 0 and M(L) = 0 at supports", () => {
    const r = analyze({
      L: 10,
      udls: [{ xStart: 0, xEnd: 10, w: 100 }],
    });
    expect(r.samples[0]!.M).toBeCloseTo(0, 9);
    expect(r.samples[r.samples.length - 1]!.M).toBeCloseTo(0, 6);
  });
});

describe("analyze — point moment", () => {
  it("RA = +M/L, RB = -M/L (couple equilibrium for CCW positive M)", () => {
    const r = analyze({
      L: 10,
      pointMoments: [{ x: 5, M: 200 }],
    });
    expect(r.RA).toBeCloseTo(20, 9);
    expect(r.RB).toBeCloseTo(-20, 9);
  });

  it("internal moment jumps by ~M at the moment location", () => {
    const r = analyze({
      L: 10,
      pointMoments: [{ x: 5, M: 200 }],
      nSamples: 1001,
    });
    const Mleft = r.samples[499]!.M;
    const Mright = r.samples[500]!.M;
    // Discretization places samples at x=4.99 and x=5.00; the jump
    // straddles the moment so the difference equals M to ~0.2 absolute.
    expect(Mleft - Mright).toBeCloseTo(200, 0);
  });
});

describe("analyze — error handling", () => {
  it("RangeError on L<=0", () => {
    expect(() => analyze({ L: 0 })).toThrow(RangeError);
  });

  it("RangeError on out-of-range loads / moments / UDLs", () => {
    expect(() => analyze({ L: 5, pointLoads: [{ x: 6, P: 1 }] })).toThrow(RangeError);
    expect(() => analyze({ L: 5, pointMoments: [{ x: -1, M: 1 }] })).toThrow(RangeError);
    expect(() => analyze({ L: 5, udls: [{ xStart: 1, xEnd: 6, w: 1 }] })).toThrow(
      RangeError,
    );
    expect(() => analyze({ L: 5, udls: [{ xStart: 1, xEnd: 1, w: 1 }] })).toThrow(
      RangeError,
    );
  });

  it("RangeError on too-coarse nSamples", () => {
    expect(() => analyze({ L: 5, nSamples: 2 })).toThrow(RangeError);
  });
});

describe("analyze — superposition", () => {
  it("two equal point loads at quarters: RA = RB = P", () => {
    const r = analyze({
      L: 10,
      pointLoads: [
        { x: 2.5, P: 1000 },
        { x: 7.5, P: 1000 },
      ],
    });
    expect(r.RA).toBeCloseTo(1000, 6);
    expect(r.RB).toBeCloseTo(1000, 6);
  });
});
