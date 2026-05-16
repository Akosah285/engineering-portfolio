import { describe, expect, it } from "vitest";
import {
  AND,
  NAND,
  NOR,
  NOT,
  OR,
  XNOR,
  XOR,
  minterms,
  rowKey,
  truthTable,
} from "../algorithm";

describe("gate primitives", () => {
  it("AND/OR/NOT compute the standard boolean operators", () => {
    expect(AND(true, true)).toBe(true);
    expect(AND(true, false)).toBe(false);
    expect(OR(false, false)).toBe(false);
    expect(OR(true, false)).toBe(true);
    expect(NOT(true)).toBe(false);
    expect(NOT(false)).toBe(true);
  });

  it("NAND/NOR are negations of AND/OR", () => {
    for (const a of [false, true]) {
      for (const b of [false, true]) {
        expect(NAND(a, b)).toBe(!AND(a, b));
        expect(NOR(a, b)).toBe(!OR(a, b));
      }
    }
  });

  it("XOR is true iff exactly one input is true; XNOR is its negation", () => {
    expect(XOR(false, false)).toBe(false);
    expect(XOR(true, false)).toBe(true);
    expect(XOR(false, true)).toBe(true);
    expect(XOR(true, true)).toBe(false);
    for (const a of [false, true]) {
      for (const b of [false, true]) {
        expect(XNOR(a, b)).toBe(!XOR(a, b));
      }
    }
  });
});

describe("truthTable", () => {
  it("returns 2^N rows for N inputs", () => {
    const t = truthTable({ inputs: ["A", "B"], evaluate: (a) => AND(a.A!, a.B!) });
    expect(t).toHaveLength(4);
  });

  it("rows are emitted in MSB-first binary count order (00, 01, 10, 11 for AB)", () => {
    const t = truthTable({ inputs: ["A", "B"], evaluate: () => false });
    expect(t[0]!.assignment).toEqual({ A: false, B: false });
    expect(t[1]!.assignment).toEqual({ A: false, B: true });
    expect(t[2]!.assignment).toEqual({ A: true, B: false });
    expect(t[3]!.assignment).toEqual({ A: true, B: true });
  });

  it("AND truth table has output true only when both inputs are true", () => {
    const t = truthTable({ inputs: ["A", "B"], evaluate: (a) => AND(a.A!, a.B!) });
    expect(t.map((r) => r.output)).toEqual([false, false, false, true]);
  });

  it("OR truth table has output false only when both inputs are false", () => {
    const t = truthTable({ inputs: ["A", "B"], evaluate: (a) => OR(a.A!, a.B!) });
    expect(t.map((r) => r.output)).toEqual([false, true, true, true]);
  });

  it("3-input full adder sum bit (A XOR B XOR Cin) gives the expected 8-row table", () => {
    const t = truthTable({
      inputs: ["A", "B", "Cin"],
      evaluate: (a) => XOR(XOR(a.A!, a.B!), a.Cin!),
    });
    expect(t.map((r) => r.output)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      true,
    ]);
  });

  it("3-input full adder carry bit (AB OR ACin OR BCin) gives the expected table", () => {
    const t = truthTable({
      inputs: ["A", "B", "Cin"],
      evaluate: (a) => OR(OR(AND(a.A!, a.B!), AND(a.A!, a.Cin!)), AND(a.B!, a.Cin!)),
    });
    expect(t.map((r) => r.output)).toEqual([
      false,
      false,
      false,
      true,
      false,
      true,
      true,
      true,
    ]);
  });

  it("throws on zero inputs", () => {
    expect(() => truthTable({ inputs: [], evaluate: () => true })).toThrow(RangeError);
  });

  it("throws on duplicate input names", () => {
    expect(() => truthTable({ inputs: ["A", "A"], evaluate: () => true })).toThrow(
      RangeError,
    );
  });

  it("throws when input count exceeds the cap", () => {
    const inputs = Array.from({ length: 17 }, (_, i) => `x${i}`);
    expect(() => truthTable({ inputs, evaluate: () => false })).toThrow(RangeError);
  });
});

describe("rowKey + minterms", () => {
  it("rowKey renders the assignment as an input-ordered binary string", () => {
    const t = truthTable({ inputs: ["A", "B", "C"], evaluate: () => false });
    expect(rowKey(t[0]!, ["A", "B", "C"])).toBe("000");
    expect(rowKey(t[5]!, ["A", "B", "C"])).toBe("101");
    expect(rowKey(t[7]!, ["A", "B", "C"])).toBe("111");
  });

  it("minterms returns the indices where the output is true", () => {
    const t = truthTable({ inputs: ["A", "B"], evaluate: (a) => AND(a.A!, a.B!) });
    expect(minterms(t)).toEqual([3]); // only AB=11 → output true
    const tor = truthTable({ inputs: ["A", "B"], evaluate: (a) => OR(a.A!, a.B!) });
    expect(minterms(tor)).toEqual([1, 2, 3]);
  });
});
