import { describe, expect, it } from "vitest";
import { estimatePi, mulberry32, runningEstimate } from "../algorithm";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it("yields different streams for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let differences = 0;
    for (let i = 0; i < 10; i += 1) {
      if (a() !== b()) differences += 1;
    }
    expect(differences).toBeGreaterThan(5);
  });

  it("always returns values in [0, 1)", () => {
    const r = mulberry32(12345);
    for (let i = 0; i < 1000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("throws on non-finite seed", () => {
    expect(() => mulberry32(Number.NaN)).toThrow(RangeError);
    expect(() => mulberry32(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("estimatePi", () => {
  it("converges to π within ~0.05 for 100k samples (seed=1)", () => {
    const r = estimatePi({ samples: 100_000, seed: 1 });
    expect(Math.abs(r.estimate - Math.PI)).toBeLessThan(0.05);
    expect(r.inside).toBeGreaterThan(0);
    expect(r.inside).toBeLessThanOrEqual(r.total);
  });

  it("is deterministic for the same seed", () => {
    const a = estimatePi({ samples: 1000, seed: 7 });
    const b = estimatePi({ samples: 1000, seed: 7 });
    expect(a).toEqual(b);
  });

  it("estimate · total = 4 · inside (basic accounting identity)", () => {
    const r = estimatePi({ samples: 5000, seed: 3 });
    expect(r.estimate * r.total).toBeCloseTo(4 * r.inside, 9);
  });

  it("standard error shrinks like 1/sqrt(n)", () => {
    const small = estimatePi({ samples: 1000, seed: 9 });
    const large = estimatePi({ samples: 100_000, seed: 9 });
    // SE_large should be roughly SE_small / sqrt(100) = SE_small / 10
    expect(large.standardError).toBeLessThan(small.standardError / 5);
  });

  it("throws on non-positive or non-integer samples", () => {
    expect(() => estimatePi({ samples: 0, seed: 1 })).toThrow(RangeError);
    expect(() => estimatePi({ samples: -10, seed: 1 })).toThrow(RangeError);
    expect(() => estimatePi({ samples: 1.5, seed: 1 })).toThrow(RangeError);
  });
});

describe("runningEstimate", () => {
  it("returns one estimate per sample", () => {
    const traj = runningEstimate({ samples: 100, seed: 5 });
    expect(traj).toHaveLength(100);
  });

  it("each running estimate is in [0, 4]", () => {
    const traj = runningEstimate({ samples: 200, seed: 5 });
    for (const v of traj) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(4);
    }
  });

  it("the final value equals estimatePi for the same seed and sample count", () => {
    const N = 1000;
    const traj = runningEstimate({ samples: N, seed: 11 });
    const final = estimatePi({ samples: N, seed: 11 });
    expect(traj[N - 1]).toBeCloseTo(final.estimate, 12);
  });
});
