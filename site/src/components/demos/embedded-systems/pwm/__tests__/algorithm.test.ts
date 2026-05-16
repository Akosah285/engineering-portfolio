import { describe, expect, it } from "vitest";
import { aggregates, trace, valueAt } from "../algorithm";

const DEFAULT = { frequency: 1000, duty: 0.5, vHigh: 5, vLow: 0 } as const; // 1 kHz, 50%

describe("valueAt", () => {
  it("is high during the first duty·T fraction of each period", () => {
    const T = 1 / DEFAULT.frequency;
    expect(valueAt(DEFAULT, 0)).toBe(5); // start of period
    expect(valueAt(DEFAULT, 0.49 * T)).toBe(5); // just inside the high stretch
    expect(valueAt(DEFAULT, 0.51 * T)).toBe(0); // just past the duty cut
    expect(valueAt(DEFAULT, 0.99 * T)).toBe(0);
  });

  it("is periodic: v(t + T) = v(t) for all t", () => {
    const T = 1 / DEFAULT.frequency;
    for (const t of [0.0001, 0.0003, 0.0007]) {
      expect(valueAt(DEFAULT, t)).toBe(valueAt(DEFAULT, t + T));
    }
  });

  it("at duty=1, the signal is always vHigh", () => {
    const p = { ...DEFAULT, duty: 1 };
    for (const t of [0, 0.001, 0.01]) expect(valueAt(p, t)).toBe(5);
  });

  it("at duty=0, the signal is always vLow", () => {
    const p = { ...DEFAULT, duty: 0 };
    for (const t of [0, 0.001, 0.01]) expect(valueAt(p, t)).toBe(0);
  });

  it("supports negative t (treated as periodic extension)", () => {
    const T = 1 / DEFAULT.frequency;
    expect(valueAt(DEFAULT, -0.4 * T)).toBe(0); // negative phase → wraps into low half
    expect(valueAt(DEFAULT, -0.6 * T)).toBe(5); // wraps into high half
  });

  it("throws on non-positive frequency or duty out of [0,1]", () => {
    expect(() => valueAt({ ...DEFAULT, frequency: 0 }, 0)).toThrow(RangeError);
    expect(() => valueAt({ ...DEFAULT, duty: -0.1 }, 0)).toThrow(RangeError);
    expect(() => valueAt({ ...DEFAULT, duty: 1.1 }, 0)).toThrow(RangeError);
  });
});

describe("aggregates", () => {
  it("50% duty, vLow=0, vHigh=5: average=2.5 V, RMS=√(0.5·25)=3.536 V", () => {
    const a = aggregates(DEFAULT);
    expect(a.period).toBeCloseTo(0.001, 12);
    expect(a.average).toBeCloseTo(2.5, 12);
    expect(a.rms).toBeCloseTo(Math.sqrt(12.5), 12);
    expect(a.peakToPeak).toBeCloseTo(5, 12);
    expect(a.highTime).toBeCloseTo(0.0005, 12);
    expect(a.lowTime).toBeCloseTo(0.0005, 12);
  });

  it("25% duty, vLow=0, vHigh=12: average=3 V, RMS=√(0.25·144)=6 V", () => {
    const a = aggregates({ frequency: 100, duty: 0.25, vHigh: 12, vLow: 0 });
    expect(a.average).toBeCloseTo(3, 12);
    expect(a.rms).toBeCloseTo(6, 12);
  });

  it("at duty=1, RMS = vHigh and average = vHigh", () => {
    const a = aggregates({ ...DEFAULT, duty: 1 });
    expect(a.average).toBeCloseTo(5, 12);
    expect(a.rms).toBeCloseTo(5, 12);
  });

  it("at duty=0, RMS = |vLow| and average = vLow", () => {
    const a = aggregates({ ...DEFAULT, duty: 0 });
    expect(a.average).toBeCloseTo(0, 12);
    expect(a.rms).toBeCloseTo(0, 12);
  });

  it("with bipolar levels (-3 to +3, 50%), average = 0 but RMS = 3", () => {
    const a = aggregates({ frequency: 100, duty: 0.5, vHigh: 3, vLow: -3 });
    expect(a.average).toBeCloseTo(0, 12);
    expect(a.rms).toBeCloseTo(3, 12);
    expect(a.peakToPeak).toBeCloseTo(6, 12);
  });

  it("highTime + lowTime = period, always", () => {
    for (const duty of [0, 0.1, 0.33, 0.5, 0.8, 1]) {
      const a = aggregates({ ...DEFAULT, duty });
      expect(a.highTime + a.lowTime).toBeCloseTo(a.period, 12);
    }
  });
});

describe("trace", () => {
  it("returns the requested number of samples spanning [0, tEnd]", () => {
    const t = trace(DEFAULT, 0.005, 11); // 5 ms / 1 ms period = 5 cycles
    expect(t).toHaveLength(11);
    expect(t[0]!.t).toBe(0);
    expect(t[10]!.t).toBeCloseTo(0.005, 12);
  });

  it("contains both high and low samples for a duty=50% trace covering many periods", () => {
    const t = trace(DEFAULT, 0.005, 1001);
    const highs = t.filter((p) => p.v === 5).length;
    const lows = t.filter((p) => p.v === 0).length;
    expect(highs).toBeGreaterThan(0);
    expect(lows).toBeGreaterThan(0);
    // For 50% duty, roughly half the samples are high (some boundary noise OK)
    const ratio = highs / t.length;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("throws on bad tEnd or samples", () => {
    expect(() => trace(DEFAULT, 0, 10)).toThrow(RangeError);
    expect(() => trace(DEFAULT, -1, 10)).toThrow(RangeError);
    expect(() => trace(DEFAULT, 1, 1)).toThrow(RangeError);
    expect(() => trace(DEFAULT, 1, 1.5)).toThrow(RangeError);
  });
});
