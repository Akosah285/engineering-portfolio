import { describe, expect, it } from "vitest";

import { decompose, determinantFromLU, solveWithLU } from "../algorithm";

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0]!.length;
  const p = B.length;
  const out: number[][] = new Array(m);
  for (let i = 0; i < m; i += 1) {
    const row = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < p; k += 1) s += A[i]![k]! * B[k]![j]!;
      row[j] = s;
    }
    out[i] = row;
  }
  return out;
}

function permute(A: number[][], perm: number[]): number[][] {
  return perm.map((src) => A[src]!.slice());
}

describe("decompose — L is unit lower, U is upper, PA = LU", () => {
  it("on a 3x3 well-conditioned matrix", () => {
    const A: number[][] = [
      [4, 3, 2],
      [3, 5, 1],
      [2, 1, 6],
    ];
    const lu = decompose(A);
    expect(lu.singular).toBe(false);
    // L unit lower
    for (let i = 0; i < 3; i += 1) {
      expect(lu.L[i]![i]!).toBe(1);
      for (let j = i + 1; j < 3; j += 1) expect(lu.L[i]![j]!).toBe(0);
    }
    // U upper
    for (let i = 1; i < 3; i += 1) {
      for (let j = 0; j < i; j += 1) expect(Math.abs(lu.U[i]![j]!)).toBeLessThan(1e-12);
    }
    const PA = permute(A, lu.perm);
    const LU = matMul(lu.L, lu.U);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        expect(LU[i]![j]!).toBeCloseTo(PA[i]![j]!, 12);
      }
    }
  });

  it("on the identity, PA = LU is trivial: L = U = I, perm = identity, sign = +1", () => {
    const lu = decompose([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(lu.singular).toBe(false);
    expect(lu.perm).toEqual([0, 1, 2]);
    expect(lu.sign).toBe(1);
    expect(lu.L).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(lu.U).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});

describe("solveWithLU", () => {
  it("solves PAx = Pb correctly on a textbook 3x3", () => {
    const A: number[][] = [
      [3, 2, -1],
      [2, -2, 4],
      [-1, 0.5, -1],
    ];
    const lu = decompose(A);
    const x = solveWithLU({ lu, b: [1, -2, 0] });
    expect(x[0]!).toBeCloseTo(1, 10);
    expect(x[1]!).toBeCloseTo(-2, 10);
    expect(x[2]!).toBeCloseTo(-2, 10);
  });

  it("returns NaN solutions for singular systems", () => {
    const lu = decompose([
      [1, 2],
      [2, 4],
    ]);
    expect(lu.singular).toBe(true);
    const x = solveWithLU({ lu, b: [3, 6] });
    expect(Number.isNaN(x[0]!)).toBe(true);
    expect(Number.isNaN(x[1]!)).toBe(true);
  });

  it("RangeError when b length doesn't match factor size", () => {
    const lu = decompose([
      [1, 0],
      [0, 1],
    ]);
    expect(() => solveWithLU({ lu, b: [1, 2, 3] })).toThrow(RangeError);
  });
});

describe("determinantFromLU", () => {
  it("returns 1 for the identity (sign=+1, diag=1)", () => {
    const lu = decompose([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(determinantFromLU(lu)).toBe(1);
  });

  it("returns 0 for a singular matrix", () => {
    const lu = decompose([
      [1, 2],
      [2, 4],
    ]);
    expect(determinantFromLU(lu)).toBe(0);
  });

  it("returns the textbook determinant of [[2,3],[1,4]] = 5", () => {
    const lu = decompose([
      [2, 3],
      [1, 4],
    ]);
    expect(determinantFromLU(lu)).toBeCloseTo(5, 12);
  });

  it("respects sign for swapped systems: det([[0,1],[1,0]]) = -1", () => {
    const lu = decompose([
      [0, 1],
      [1, 0],
    ]);
    expect(determinantFromLU(lu)).toBeCloseTo(-1, 12);
  });
});

describe("decompose — error handling", () => {
  it("RangeError on empty matrix", () => {
    expect(() => decompose([])).toThrow(RangeError);
  });

  it("RangeError on non-square matrix", () => {
    expect(() => decompose([[1, 2, 3], [4, 5, 6]])).toThrow(RangeError);
  });
});
