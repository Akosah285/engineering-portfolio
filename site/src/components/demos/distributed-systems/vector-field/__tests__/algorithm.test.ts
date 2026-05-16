import { describe, it, expect } from "vitest";
import { sampleGrid, divergence, curlZ } from "../algorithm";

describe("sampleGrid", () => {
  it("constant field: all magnitudes equal", () => {
    const g = sampleGrid({
      f: () => ({ fx: 3, fy: 4 }),
      xmin: 0,
      xmax: 1,
      ymin: 0,
      ymax: 1,
      nx: 3,
      ny: 3,
    });
    expect(g.samples.length).toBe(9);
    for (const s of g.samples) {
      expect(s.magnitude).toBe(5);
    }
    expect(g.maxMagnitude).toBe(5);
  });

  it("samples span the bounding box exactly at corners", () => {
    const g = sampleGrid({
      f: (x, y) => ({ fx: x, fy: y }),
      xmin: -1,
      xmax: 1,
      ymin: -2,
      ymax: 2,
      nx: 3,
      ny: 3,
    });
    expect(g.samples[0]!.x).toBe(-1);
    expect(g.samples[0]!.y).toBe(-2);
    expect(g.samples[g.samples.length - 1]!.x).toBe(1);
    expect(g.samples[g.samples.length - 1]!.y).toBe(2);
  });

  it("RangeError on nx < 2", () => {
    expect(() =>
      sampleGrid({
        f: () => ({ fx: 0, fy: 0 }),
        xmin: 0,
        xmax: 1,
        ymin: 0,
        ymax: 1,
        nx: 1,
        ny: 5,
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on inverted bounds", () => {
    expect(() =>
      sampleGrid({
        f: () => ({ fx: 0, fy: 0 }),
        xmin: 1,
        xmax: 1,
        ymin: 0,
        ymax: 1,
        nx: 3,
        ny: 3,
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on non-finite field output", () => {
    expect(() =>
      sampleGrid({
        f: () => ({ fx: NaN, fy: 0 }),
        xmin: 0,
        xmax: 1,
        ymin: 0,
        ymax: 1,
        nx: 3,
        ny: 3,
      }),
    ).toThrow(RangeError);
  });
});

describe("divergence", () => {
  it("radial field F = (x, y) has divergence = 2", () => {
    const g = sampleGrid({
      f: (x, y) => ({ fx: x, fy: y }),
      xmin: -1,
      xmax: 1,
      ymin: -1,
      ymax: 1,
      nx: 5,
      ny: 5,
    });
    const div = divergence(g, -1, 1, -1, 1);
    // Interior: ∂x/∂x + ∂y/∂y = 1 + 1 = 2
    expect(div[12]!).toBeCloseTo(2, 6); // center of 5x5
  });

  it("solenoidal field F = (-y, x) has divergence = 0", () => {
    const g = sampleGrid({
      f: (x, y) => ({ fx: -y, fy: x }),
      xmin: -1,
      xmax: 1,
      ymin: -1,
      ymax: 1,
      nx: 5,
      ny: 5,
    });
    const div = divergence(g, -1, 1, -1, 1);
    for (const d of div) {
      expect(Math.abs(d)).toBeLessThan(1e-9);
    }
  });
});

describe("curlZ", () => {
  it("F = (-y, x) (rigid rotation) has curl-z = 2", () => {
    const g = sampleGrid({
      f: (x, y) => ({ fx: -y, fy: x }),
      xmin: -1,
      xmax: 1,
      ymin: -1,
      ymax: 1,
      nx: 5,
      ny: 5,
    });
    const cz = curlZ(g, -1, 1, -1, 1);
    expect(cz[12]!).toBeCloseTo(2, 6);
  });

  it("F = (x, y) (radial) has curl-z = 0", () => {
    const g = sampleGrid({
      f: (x, y) => ({ fx: x, fy: y }),
      xmin: -1,
      xmax: 1,
      ymin: -1,
      ymax: 1,
      nx: 5,
      ny: 5,
    });
    const cz = curlZ(g, -1, 1, -1, 1);
    for (const v of cz) {
      expect(Math.abs(v)).toBeLessThan(1e-9);
    }
  });
});
