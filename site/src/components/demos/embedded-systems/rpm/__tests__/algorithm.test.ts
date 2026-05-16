import { describe, expect, it } from "vitest";
import { instantRpmFromPulses, movingAverageRpm, windowedRpm } from "../algorithm";

describe("instantRpmFromPulses", () => {
  it("rejects non-positive pulsesPerRev", () => {
    expect(() => instantRpmFromPulses([0, 1], 0)).toThrow(RangeError);
    expect(() => instantRpmFromPulses([0, 1], -1)).toThrow(RangeError);
  });

  it("rejects non-strictly-increasing times", () => {
    expect(() => instantRpmFromPulses([0, 1, 1], 1)).toThrow(RangeError);
    expect(() => instantRpmFromPulses([0, 2, 1], 1)).toThrow(RangeError);
  });

  it("returns empty for fewer than 2 pulses", () => {
    expect(instantRpmFromPulses([], 1)).toEqual([]);
    expect(instantRpmFromPulses([5], 1)).toEqual([]);
  });

  it("1 pulse per second with PPR=1 → 60 RPM", () => {
    const r = instantRpmFromPulses([0, 1, 2, 3], 1);
    expect(r.length).toBe(3);
    for (const m of r) {
      expect(m.rpm).toBeCloseTo(60, 10);
    }
  });

  it("with PPR=2 → halved RPM compared to PPR=1", () => {
    const r1 = instantRpmFromPulses([0, 1, 2], 1);
    const r2 = instantRpmFromPulses([0, 1, 2], 2);
    expect(r2[0]!.rpm).toBeCloseTo(r1[0]!.rpm / 2, 10);
  });

  it("rpm doubles when pulse period halves", () => {
    const slow = instantRpmFromPulses([0, 1], 1);
    const fast = instantRpmFromPulses([0, 0.5], 1);
    expect(fast[0]!.rpm).toBeCloseTo(slow[0]!.rpm * 2, 10);
  });

  it("timestamps match later pulse of each pair", () => {
    const r = instantRpmFromPulses([0, 1, 2.5], 1);
    expect(r[0]!.t).toBe(1);
    expect(r[1]!.t).toBe(2.5);
  });
});

describe("windowedRpm", () => {
  it("rejects non-positive PPR or window", () => {
    expect(() => windowedRpm([], 0, 1, [0])).toThrow(RangeError);
    expect(() => windowedRpm([], 1, 0, [0])).toThrow(RangeError);
  });

  it("rejects out-of-order sample times", () => {
    expect(() => windowedRpm([], 1, 1, [1, 0])).toThrow(RangeError);
  });

  it("60 pulses in a 1-second window with PPR=1 → 3600 RPM", () => {
    const pulses = Array.from({ length: 60 }, (_, i) => i / 60);
    const r = windowedRpm(pulses, 1, 1, [0]);
    expect(r[0]!.rpm).toBeCloseTo(3600, 6);
  });

  it("zero pulses in window → 0 RPM", () => {
    const r = windowedRpm([], 1, 1, [0, 5, 10]);
    for (const m of r) expect(m.rpm).toBe(0);
  });

  it("sample-time half-open window [t, t+win)", () => {
    const r = windowedRpm([0, 1], 1, 1, [0]);
    // window [0, 1): contains pulse at 0 but not at 1
    expect(r[0]!.rpm).toBeCloseTo(60, 6);
  });
});

describe("movingAverageRpm", () => {
  it("rejects non-positive integer N", () => {
    expect(() => movingAverageRpm([], 0)).toThrow(RangeError);
    expect(() => movingAverageRpm([], 1.5)).toThrow(RangeError);
    expect(() => movingAverageRpm([], -1)).toThrow(RangeError);
  });

  it("empty input returns empty", () => {
    expect(movingAverageRpm([], 5)).toEqual([]);
  });

  it("N=1 is identity (each value averaged over itself)", () => {
    const input = [
      { t: 0, rpm: 10 },
      { t: 1, rpm: 20 },
      { t: 2, rpm: 30 },
    ];
    expect(movingAverageRpm(input, 1)).toEqual(input);
  });

  it("converges to true mean for constant input", () => {
    const input = Array.from({ length: 20 }, (_, i) => ({ t: i, rpm: 100 }));
    const out = movingAverageRpm(input, 5);
    for (const m of out) {
      expect(m.rpm).toBeCloseTo(100, 10);
    }
  });

  it("smooths a step input", () => {
    const input = [
      { t: 0, rpm: 0 },
      { t: 1, rpm: 0 },
      { t: 2, rpm: 100 },
      { t: 3, rpm: 100 },
      { t: 4, rpm: 100 },
    ];
    const out = movingAverageRpm(input, 3);
    // window for index 2 = (0+0+100)/3 ≈ 33.3
    expect(out[2]!.rpm).toBeCloseTo(100 / 3, 10);
    // window for index 4 = (100+100+100)/3 = 100
    expect(out[4]!.rpm).toBeCloseTo(100, 10);
  });

  it("preserves timestamps", () => {
    const input = [
      { t: 5, rpm: 10 },
      { t: 6, rpm: 20 },
    ];
    const out = movingAverageRpm(input, 2);
    expect(out[0]!.t).toBe(5);
    expect(out[1]!.t).toBe(6);
  });
});
