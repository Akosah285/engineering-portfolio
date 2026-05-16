import { describe, it, expect } from "vitest";
import { ruinProb, expectedDuration, simulate } from "../algorithm";

describe("ruinProb — analytical", () => {
  it("k=0 → ruined", () => {
    expect(ruinProb({ N: 10, k: 0, p: 0.5 })).toBe(1);
  });

  it("k=N → already won", () => {
    expect(ruinProb({ N: 10, k: 10, p: 0.5 })).toBe(0);
  });

  it("fair game: P_ruin(k) = 1 - k/N", () => {
    expect(ruinProb({ N: 10, k: 1, p: 0.5 })).toBeCloseTo(0.9, 10);
    expect(ruinProb({ N: 10, k: 5, p: 0.5 })).toBeCloseTo(0.5, 10);
    expect(ruinProb({ N: 100, k: 25, p: 0.5 })).toBeCloseTo(0.75, 10);
  });

  it("biased favorable (p > 0.5) → low ruin prob from mid", () => {
    const pr = ruinProb({ N: 20, k: 10, p: 0.55 });
    expect(pr).toBeLessThan(0.5);
  });

  it("biased unfavorable (p < 0.5) → high ruin prob from mid", () => {
    const pr = ruinProb({ N: 20, k: 10, p: 0.45 });
    expect(pr).toBeGreaterThan(0.5);
  });

  it("symmetric (Ross §4.5 example): N=10, k=5, p=0.6", () => {
    // r = 0.4/0.6 = 2/3; expected P_ruin ≈ (2/3)^5 - (2/3)^10) / (1 - (2/3)^10)
    const r = 2 / 3;
    const expected =
      (Math.pow(r, 5) - Math.pow(r, 10)) / (1 - Math.pow(r, 10));
    expect(ruinProb({ N: 10, k: 5, p: 0.6 })).toBeCloseTo(expected, 10);
  });

  it("RangeError on bad inputs", () => {
    expect(() => ruinProb({ N: 0, k: 0, p: 0.5 })).toThrow(RangeError);
    expect(() => ruinProb({ N: 10, k: -1, p: 0.5 })).toThrow(RangeError);
    expect(() => ruinProb({ N: 10, k: 11, p: 0.5 })).toThrow(RangeError);
    expect(() => ruinProb({ N: 10, k: 5, p: -0.1 })).toThrow(RangeError);
    expect(() => ruinProb({ N: 10, k: 5, p: 1.5 })).toThrow(RangeError);
  });
});

describe("expectedDuration", () => {
  it("absorbing states have 0 duration", () => {
    expect(expectedDuration({ N: 10, k: 0, p: 0.5 })).toBe(0);
    expect(expectedDuration({ N: 10, k: 10, p: 0.5 })).toBe(0);
  });

  it("fair: E[T_k] = k(N-k) (Ross §4.5.A)", () => {
    expect(expectedDuration({ N: 10, k: 5, p: 0.5 })).toBe(25);
    expect(expectedDuration({ N: 100, k: 50, p: 0.5 })).toBe(2500);
  });

  it("biased: positive duration, finite", () => {
    const ed = expectedDuration({ N: 20, k: 10, p: 0.55 });
    expect(ed).toBeGreaterThan(0);
    expect(Number.isFinite(ed)).toBe(true);
  });
});

describe("simulate", () => {
  function seededRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  it("absorbs at 0 or N", () => {
    const r = seededRng(42);
    const out = simulate({ N: 10, k: 5, p: 0.5 }, r);
    expect(out.terminal === 0 || out.terminal === 10).toBe(true);
  });

  it("empirical ruin freq ≈ analytical (fair, k=5, N=10)", () => {
    const trueRuin = ruinProb({ N: 10, k: 5, p: 0.5 });
    const r = seededRng(1234);
    let ruined = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      const out = simulate({ N: 10, k: 5, p: 0.5 }, r);
      if (out.terminal === 0) ruined += 1;
    }
    expect(ruined / trials).toBeCloseTo(trueRuin, 1);
  });
});
