import { describe, expect, it } from "vitest";

import { cubeToTerm, minimize } from "../algorithm";

describe("minimize — trivial cases", () => {
  it("empty minterm list yields no cubes", () => {
    const r = minimize({ nVars: 3, minterms: [] });
    expect(r.cubes).toEqual([]);
    expect(r.literalCount).toBe(0);
  });

  it("a single minterm returns a single full-literal cube", () => {
    // n=2, minterm=2 (binary 10) ⇒ A·!B
    const r = minimize({ nVars: 2, minterms: [2] });
    expect(r.cubes.length).toBe(1);
    expect(cubeToTerm(r.cubes[0]!, ["A", "B"])).toBe("A!B");
    expect(r.literalCount).toBe(2);
  });

  it("all minterms covered by the trivial cube (output = 1)", () => {
    // n=2, minterms={0,1,2,3} ⇒ no literals
    const r = minimize({ nVars: 2, minterms: [0, 1, 2, 3] });
    expect(r.cubes.length).toBe(1);
    expect(r.cubes[0]!.every((b) => b === "-")).toBe(true);
    expect(r.literalCount).toBe(0);
  });
});

describe("minimize — textbook examples", () => {
  it("XOR(A,B) = m(1,2): minterms cannot be merged, two products", () => {
    const r = minimize({ nVars: 2, minterms: [1, 2] });
    expect(r.cubes.length).toBe(2);
    expect(r.literalCount).toBe(4);
  });

  it("OR(A,B) = m(1,2,3) reduces to 2 literals: A + B", () => {
    const r = minimize({ nVars: 2, minterms: [1, 2, 3] });
    expect(r.literalCount).toBe(2);
    const terms = r.cubes.map((c) => cubeToTerm(c, ["A", "B"])).sort();
    expect(terms).toEqual(["A", "B"]);
  });

  it("3-variable example m(0,2,5,7) reduces to BC + B'D' style 4-literal SOP", () => {
    const r = minimize({ nVars: 3, minterms: [0, 2, 5, 7] });
    // Each pair {0,2} and {5,7} merges to 2-literal cubes ⇒ total 4 literals
    expect(r.cubes.length).toBe(2);
    expect(r.literalCount).toBe(4);
  });

  it("don't-cares can collapse the result further", () => {
    // n=3, minterms=[1,3,5,7] (all odd) ⇒ C alone (1 literal) without don't-cares
    const r1 = minimize({ nVars: 3, minterms: [1, 3, 5, 7] });
    expect(r1.cubes.length).toBe(1);
    expect(r1.literalCount).toBe(1);
    // With a don't-care on minterm 0, result remains just C (already minimal)
    const r2 = minimize({ nVars: 3, minterms: [1, 3, 5, 7], dontCares: [0] });
    expect(r2.literalCount).toBeLessThanOrEqual(1);
  });
});

describe("minimize — coverage correctness", () => {
  it("every input minterm is covered by some chosen cube", () => {
    const minterms = [1, 3, 4, 5, 7, 9, 11, 15];
    const nVars = 4;
    const r = minimize({ nVars, minterms });
    for (const m of minterms) {
      const bits: ("0" | "1")[] = [];
      for (let i = 0; i < nVars; i += 1) {
        bits[nVars - 1 - i] = (m >> i) & 1 ? "1" : "0";
      }
      const covered = r.cubes.some((cube) =>
        cube.every((b, i) => b === "-" || b === bits[i]),
      );
      expect(covered).toBe(true);
    }
  });
});

describe("minimize — error gates", () => {
  it("RangeError on bad nVars", () => {
    expect(() => minimize({ nVars: 0, minterms: [] })).toThrow(RangeError);
    expect(() => minimize({ nVars: 11, minterms: [] })).toThrow(RangeError);
  });

  it("RangeError on out-of-range minterms or don't-cares", () => {
    expect(() => minimize({ nVars: 2, minterms: [4] })).toThrow(RangeError);
    expect(() => minimize({ nVars: 2, minterms: [-1] })).toThrow(RangeError);
    expect(() => minimize({ nVars: 2, minterms: [0], dontCares: [10] })).toThrow(RangeError);
  });
});

describe("cubeToTerm", () => {
  it("renders 1 for the don't-care-only cube", () => {
    expect(cubeToTerm(["-", "-", "-"], ["A", "B", "C"])).toBe("1");
  });

  it("renders A!BC for cube 1,0,1", () => {
    expect(cubeToTerm(["1", "0", "1"], ["A", "B", "C"])).toBe("A!BC");
  });

  it("RangeError on variable-count mismatch", () => {
    expect(() => cubeToTerm(["1", "0"], ["A", "B", "C"])).toThrow(RangeError);
  });
});
