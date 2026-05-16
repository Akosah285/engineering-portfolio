import { describe, expect, it } from "vitest";

import { matVec, solve } from "../algorithm";

describe("solve — basic systems", () => {
  it("solves a 2x2 system", () => {
    // [[2,1],[5,7]] x = [11,13] → x=[7.111, -3.222] (textbook example)
    const r = solve(
      [
        [2, 1],
        [5, 7],
      ],
      [11, 13],
    );
    expect(r.singular).toBe(false);
    expect(r.x[0]!).toBeCloseTo(7.111111, 5);
    expect(r.x[1]!).toBeCloseTo(-3.222222, 5);
  });

  it("solves identity Ax=b ⇒ x=b in one step (no eliminations needed)", () => {
    const r = solve(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      [3, 5, 7],
    );
    expect(r.x).toEqual([3, 5, 7]);
    // No swap needed; no row eliminations either (all subdiagonal entries are 0)
    expect(r.steps.length).toBe(0);
  });

  it("solves a 3x3 system and the residual ||Ax-b|| is tiny", () => {
    const A = [
      [3, 2, -1],
      [2, -2, 4],
      [-1, 0.5, -1],
    ];
    const b = [1, -2, 0];
    const r = solve(A, b);
    const Ax = matVec(A, r.x);
    for (let i = 0; i < b.length; i += 1) {
      expect(Ax[i]!).toBeCloseTo(b[i]!, 12);
    }
    // textbook answer: x = (1, -2, -2)
    expect(r.x[0]!).toBeCloseTo(1, 12);
    expect(r.x[1]!).toBeCloseTo(-2, 12);
    expect(r.x[2]!).toBeCloseTo(-2, 12);
  });
});

describe("solve — partial pivoting", () => {
  it("performs a swap when the (0,0) entry is zero", () => {
    // First row pivot is 0; algorithm must swap rows 0 and 1.
    const r = solve(
      [
        [0, 1],
        [1, 0],
      ],
      [5, 3],
    );
    expect(r.singular).toBe(false);
    expect(r.x[0]!).toBeCloseTo(3, 12);
    expect(r.x[1]!).toBeCloseTo(5, 12);
    expect(r.steps[0]!.op.kind).toBe("swap");
  });

  it("partial pivoting controls round-off on a small-pivot system", () => {
    // Classic ill-pivoted example
    const r = solve(
      [
        [1e-18, 1],
        [1, 1],
      ],
      [1, 2],
    );
    expect(r.singular).toBe(false);
    // Without partial pivoting this returns x ≈ (0, 1).  With pivoting the
    // textbook answer is x ≈ (1, 1).
    expect(r.x[0]!).toBeCloseTo(1, 6);
    expect(r.x[1]!).toBeCloseTo(1, 6);
  });
});

describe("solve — singular & error handling", () => {
  it("flags singular and returns NaN solutions when a column is zero", () => {
    const r = solve(
      [
        [1, 2],
        [2, 4],
      ],
      [3, 6],
    );
    expect(r.singular).toBe(true);
    expect(Number.isNaN(r.x[0]!)).toBe(true);
    expect(Number.isNaN(r.x[1]!)).toBe(true);
  });

  it("RangeError on empty matrix", () => {
    expect(() => solve([], [])).toThrow(RangeError);
  });

  it("RangeError on non-square matrix", () => {
    expect(() =>
      solve(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [1, 2],
      ),
    ).toThrow(RangeError);
  });

  it("RangeError when b length doesn't match A size", () => {
    expect(() =>
      solve(
        [
          [1, 0],
          [0, 1],
        ],
        [1, 2, 3],
      ),
    ).toThrow(RangeError);
  });
});

describe("solve — step trace", () => {
  it("records every elimination as a step with a snapshot of U and y", () => {
    const r = solve(
      [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
      ],
      [8, -11, -3],
    );
    expect(r.singular).toBe(false);
    // textbook solution
    expect(r.x[0]!).toBeCloseTo(2, 12);
    expect(r.x[1]!).toBeCloseTo(3, 12);
    expect(r.x[2]!).toBeCloseTo(-1, 12);
    expect(r.steps.length).toBeGreaterThan(0);
    // Last step's matrixAfter must be upper-triangular.
    const final = r.steps[r.steps.length - 1]!.matrixAfter;
    for (let i = 1; i < final.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        expect(Math.abs(final[i]![j]!)).toBeLessThan(1e-10);
      }
    }
  });
});
