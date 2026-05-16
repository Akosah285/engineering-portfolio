import { describe, expect, it } from "vitest";

import { convolve, expDecay, rect, sum } from "../algorithm";

describe("convolve — basic algebra", () => {
  it("[1] * [1] = [1]", () => {
    expect(convolve({ f: [1], g: [1] })).toEqual([1]);
  });

  it("output length is f.length + g.length - 1", () => {
    const h = convolve({ f: [1, 2, 3], g: [4, 5] });
    expect(h.length).toBe(4);
    // textbook expected sequence
    expect(h).toEqual([4, 13, 22, 15]);
  });

  it("convolution is commutative", () => {
    const a = [1, 2, 3, 4];
    const b = [5, 6, 7];
    expect(convolve({ f: a, g: b })).toEqual(convolve({ f: b, g: a }));
  });

  it("convolution with delta = identity", () => {
    const f = [1, 2, 3, 4, 5];
    const delta = [1];
    expect(convolve({ f, g: delta })).toEqual(f);
  });

  it("delta-shift: convolving with [0,0,1] shifts f right by 2 and zero-pads", () => {
    const f = [1, 2, 3];
    const shifted = convolve({ f, g: [0, 0, 1] });
    expect(shifted).toEqual([0, 0, 1, 2, 3]);
  });

  it("returns [] when either input is empty", () => {
    expect(convolve({ f: [], g: [1, 2] })).toEqual([]);
    expect(convolve({ f: [1, 2], g: [] })).toEqual([]);
  });

  it("dt scales the result (continuous-time approximation)", () => {
    const a = [1, 1, 1];
    const b = [1, 1];
    const h0 = convolve({ f: a, g: b });
    const h1 = convolve({ f: a, g: b, dt: 0.5 });
    for (let i = 0; i < h0.length; i += 1) {
      expect(h1[i]!).toBeCloseTo(h0[i]! * 0.5, 12);
    }
  });

  it("RangeError on non-positive dt or non-finite dt", () => {
    expect(() => convolve({ f: [1], g: [1], dt: 0 })).toThrow(RangeError);
    expect(() => convolve({ f: [1], g: [1], dt: -1 })).toThrow(RangeError);
    expect(() => convolve({ f: [1], g: [1], dt: Number.NaN })).toThrow(RangeError);
  });
});

describe("convolve — physical sanity (rect * rect = triangle)", () => {
  it("box * box of width 1 is a triangle of width 2 with peak 1 at center, area 1", () => {
    // 100-sample box of duration 1 centered at 0, dt=1/100
    const N = 200;
    const dt = 1 / 100;
    const r = rect({ width: 1, height: 1, nSamples: 100, tMin: -0.5, tMax: 0.5 });
    const values = r.map((s) => s.value);
    const tri = convolve({ f: values, g: values, dt });
    // peak occurs at the middle sample
    const peakIdx = Math.floor(tri.length / 2);
    // values at center two samples should both be very close to 1
    expect(tri[peakIdx]!).toBeGreaterThan(0.98);
    expect(tri[peakIdx]!).toBeLessThanOrEqual(1.02);
    // total integral of triangle of base 2 and height 1 is 1 (area-preserving)
    const area = sum(tri) * dt;
    expect(area).toBeCloseTo(1, 1);
    expect(tri.length).toBe(N - 1);
  });
});

describe("rect", () => {
  it("returns 1 inside the support and 0 outside", () => {
    const r = rect({ width: 1, height: 1, nSamples: 11, tMin: -1, tMax: 1, center: 0 });
    // sample at t=0 (index 5) must be inside
    expect(r[5]!.value).toBe(1);
    // sample at t=-1 (index 0) must be outside
    expect(r[0]!.value).toBe(0);
    // sample at t=+1 (last index) must be outside
    expect(r[r.length - 1]!.value).toBe(0);
  });

  it("RangeError on non-positive width or bad bounds", () => {
    expect(() => rect({ width: 0, height: 1, nSamples: 10, tMin: -1, tMax: 1 })).toThrow(
      RangeError,
    );
    expect(() => rect({ width: 1, height: 1, nSamples: 1, tMin: -1, tMax: 1 })).toThrow(
      RangeError,
    );
    expect(() => rect({ width: 1, height: 1, nSamples: 10, tMin: 1, tMax: -1 })).toThrow(
      RangeError,
    );
  });
});

describe("expDecay", () => {
  it("is 0 for t<0 and 1 at t=0", () => {
    const e = expDecay({ tau: 1, nSamples: 21, tMin: -1, tMax: 1 });
    // t=-1 → 0
    expect(e[0]!.value).toBe(0);
    // t=0 → 1
    expect(e[10]!.value).toBeCloseTo(1, 12);
  });

  it("decays as e^{-t/tau} for t>0", () => {
    const e = expDecay({ tau: 2, nSamples: 5, tMin: 0, tMax: 4 });
    // points: t=0,1,2,3,4
    expect(e[0]!.value).toBeCloseTo(1, 12);
    expect(e[1]!.value).toBeCloseTo(Math.exp(-0.5), 12);
    expect(e[2]!.value).toBeCloseTo(Math.exp(-1), 12);
    expect(e[3]!.value).toBeCloseTo(Math.exp(-1.5), 12);
    expect(e[4]!.value).toBeCloseTo(Math.exp(-2), 12);
  });

  it("RangeError on tau<=0 or bad sample count or bad bounds", () => {
    expect(() => expDecay({ tau: 0, nSamples: 10, tMin: 0, tMax: 1 })).toThrow(
      RangeError,
    );
    expect(() => expDecay({ tau: 1, nSamples: 1, tMin: 0, tMax: 1 })).toThrow(RangeError);
    expect(() => expDecay({ tau: 1, nSamples: 10, tMin: 1, tMax: 0 })).toThrow(
      RangeError,
    );
  });
});
