import { describe, expect, it } from "vitest";
import { combinations, permutations } from "../algorithm";

describe("combinations", () => {
  it("C(5, 2) = 10", () => {
    expect(combinations(5, 2)).toBe(10n);
  });

  it("C(n, 0) = C(n, n) = 1 for any n", () => {
    for (const n of [0, 1, 5, 100, 1000]) {
      expect(combinations(n, 0)).toBe(1n);
      expect(combinations(n, n)).toBe(1n);
    }
  });

  it("C(n, k) = C(n, n-k) for symmetry", () => {
    for (const [n, k] of [
      [10, 3],
      [20, 7],
      [50, 25],
    ]) {
      expect(combinations(n!, k!)).toBe(combinations(n!, n! - k!));
    }
  });

  it("returns 0 when k > n", () => {
    expect(combinations(3, 5)).toBe(0n);
  });

  it("handles large n exactly via BigInt (C(100, 50))", () => {
    // 100891344545564193334812497256 — a famously large central binomial.
    expect(combinations(100, 50)).toBe(100891344545564193334812497256n);
  });

  it("Pascal's identity: C(n, k) = C(n-1, k-1) + C(n-1, k)", () => {
    for (let n = 1; n < 12; n += 1) {
      for (let k = 1; k < n; k += 1) {
        const lhs = combinations(n, k);
        const rhs = combinations(n - 1, k - 1) + combinations(n - 1, k);
        expect(lhs).toBe(rhs);
      }
    }
  });

  it("rejects non-integer or negative inputs", () => {
    expect(() => combinations(-1, 2)).toThrow(RangeError);
    expect(() => combinations(2.5, 1)).toThrow(RangeError);
    expect(() => combinations(5, -1)).toThrow(RangeError);
  });
});

describe("permutations", () => {
  it("P(5, 2) = 20", () => {
    expect(permutations(5, 2)).toBe(20n);
  });

  it("P(n, n) = n!", () => {
    expect(permutations(5, 5)).toBe(120n);
    expect(permutations(7, 7)).toBe(5040n);
  });

  it("P(n, 0) = 1 for any n", () => {
    expect(permutations(0, 0)).toBe(1n);
    expect(permutations(10, 0)).toBe(1n);
  });

  it("P(n, k) = k! * C(n, k) (consistency with combinations)", () => {
    for (const [n, k] of [
      [5, 2],
      [10, 3],
      [12, 4],
    ]) {
      const factK = (() => {
        let acc = 1n;
        for (let i = 1; i <= k!; i += 1) acc *= BigInt(i);
        return acc;
      })();
      expect(permutations(n!, k!)).toBe(factK * combinations(n!, k!));
    }
  });

  it("returns 0 when k > n", () => {
    expect(permutations(3, 5)).toBe(0n);
  });

  it("rejects non-integer or negative inputs", () => {
    expect(() => permutations(-1, 2)).toThrow(RangeError);
    expect(() => permutations(2.5, 1)).toThrow(RangeError);
  });
});
