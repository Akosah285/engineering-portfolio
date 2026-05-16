import { describe, expect, it } from "vitest";
import {
  complementaryFilter,
  detectShakes,
  tiltFromAccel,
  toDegrees,
} from "../algorithm";

const G = 9.81;

describe("tiltFromAccel", () => {
  it("rejects zero gravity vector", () => {
    expect(() => tiltFromAccel({ ax: 0, ay: 0, az: 0 })).toThrow(RangeError);
  });

  it("flat-on-back (gravity = +z) gives roll≈0, pitch≈0", () => {
    const t = tiltFromAccel({ ax: 0, ay: 0, az: G });
    expect(t.roll).toBeCloseTo(0, 12);
    expect(t.pitch).toBeCloseTo(0, 12);
  });

  it("tilted right (gravity on +y) gives roll = +π/2", () => {
    const t = tiltFromAccel({ ax: 0, ay: G, az: 0 });
    expect(t.roll).toBeCloseTo(Math.PI / 2, 6);
  });

  it("tilted forward (gravity on -x) gives pitch = +π/2", () => {
    const t = tiltFromAccel({ ax: -G, ay: 0, az: 0 });
    expect(t.pitch).toBeCloseTo(Math.PI / 2, 6);
  });

  it("tilted back (gravity on +x) gives pitch = -π/2", () => {
    const t = tiltFromAccel({ ax: G, ay: 0, az: 0 });
    expect(t.pitch).toBeCloseTo(-Math.PI / 2, 6);
  });
});

describe("complementaryFilter", () => {
  it("rejects alpha out of [0,1]", () => {
    const sample = { ax: 0, ay: 0, az: G, gx: 0, gy: 0, dt: 0.01 };
    expect(() => complementaryFilter({ roll: 0, pitch: 0 }, sample, -0.1)).toThrow(
      RangeError,
    );
    expect(() => complementaryFilter({ roll: 0, pitch: 0 }, sample, 1.1)).toThrow(
      RangeError,
    );
  });

  it("rejects negative dt", () => {
    expect(() =>
      complementaryFilter(
        { roll: 0, pitch: 0 },
        { ax: 0, ay: 0, az: G, gx: 0, gy: 0, dt: -0.01 },
        0.5,
      ),
    ).toThrow(RangeError);
  });

  it("alpha=0 trusts accelerometer fully", () => {
    const result = complementaryFilter(
      { roll: 5, pitch: 5 }, // bogus previous
      { ax: 0, ay: G, az: 0, gx: 0, gy: 0, dt: 0.01 },
      0,
    );
    expect(result.roll).toBeCloseTo(Math.PI / 2, 6);
  });

  it("alpha=1 trusts gyro fully (ignores accel)", () => {
    const result = complementaryFilter(
      { roll: 0, pitch: 0 },
      { ax: 0, ay: 0, az: G, gx: 1, gy: 0, dt: 0.5 },
      1,
    );
    expect(result.roll).toBeCloseTo(0.5, 6);
  });

  it("intermediate alpha blends the two", () => {
    const r = complementaryFilter(
      { roll: 0, pitch: 0 },
      { ax: 0, ay: G, az: 0, gx: 0, gy: 0, dt: 0.01 },
      0.5,
    );
    expect(r.roll).toBeCloseTo(Math.PI / 4, 6);
  });
});

describe("detectShakes", () => {
  it("rejects non-positive threshold", () => {
    expect(() => detectShakes([], 0, 1)).toThrow(RangeError);
    expect(() => detectShakes([], -1, 1)).toThrow(RangeError);
  });

  it("rejects non-positive integer minSamples", () => {
    expect(() => detectShakes([], 0.5, 0)).toThrow(RangeError);
    expect(() => detectShakes([], 0.5, 1.5)).toThrow(RangeError);
    expect(() => detectShakes([], 0.5, -1)).toThrow(RangeError);
  });

  it("flat samples produce no shakes", () => {
    const s = Array.from({ length: 100 }, () => ({ ax: 0, ay: 0, az: G }));
    expect(detectShakes(s, 0.5, 3)).toEqual([]);
  });

  it("detects a single high-G burst", () => {
    const s = Array.from({ length: 100 }, () => ({ ax: 0, ay: 0, az: G }));
    s[50] = { ax: G * 2, ay: 0, az: G * 2 };
    s[51] = { ax: G * 2, ay: 0, az: G * 2 };
    s[52] = { ax: G * 2, ay: 0, az: G * 2 };
    const events = detectShakes(s, 1, 3);
    expect(events).toEqual([50]);
  });

  it("ignores spikes shorter than minSamples", () => {
    const s = Array.from({ length: 100 }, () => ({ ax: 0, ay: 0, az: G }));
    s[50] = { ax: G * 3, ay: 0, az: G * 3 };
    s[51] = { ax: G * 3, ay: 0, az: G * 3 };
    expect(detectShakes(s, 1, 3)).toEqual([]);
  });

  it("returns multiple shake starts in long stream", () => {
    const s = Array.from({ length: 100 }, () => ({ ax: 0, ay: 0, az: G }));
    for (let i = 10; i < 14; i++) s[i] = { ax: G * 3, ay: 0, az: G * 3 };
    for (let i = 50; i < 54; i++) s[i] = { ax: G * 3, ay: 0, az: G * 3 };
    expect(detectShakes(s, 1, 3)).toEqual([10, 50]);
  });
});

describe("toDegrees", () => {
  it("converts rad to deg", () => {
    const d = toDegrees({ roll: Math.PI, pitch: Math.PI / 2 });
    expect(d.roll).toBeCloseTo(180, 6);
    expect(d.pitch).toBeCloseTo(90, 6);
  });

  it("0 rad -> 0 deg", () => {
    const d = toDegrees({ roll: 0, pitch: 0 });
    expect(d.roll).toBe(0);
    expect(d.pitch).toBe(0);
  });
});
