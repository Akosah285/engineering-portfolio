import { describe, expect, it } from "vitest";
import { alu, fromSigned4, toBinary4 } from "../algorithm";

describe("alu — arithmetic ops", () => {
  it("ADD 3+5 = 8", () => {
    const r = alu("ADD", 3, 5);
    expect(r.result).toBe(8);
    expect(r.carry).toBe(false);
    expect(r.zero).toBe(false);
    expect(r.negative).toBe(true); // bit 3 set (8 = 1000)
  });

  it("ADD 15+1 = 0 with carry", () => {
    const r = alu("ADD", 15, 1);
    expect(r.result).toBe(0);
    expect(r.carry).toBe(true);
    expect(r.zero).toBe(true);
  });

  it("ADD signed overflow: 7+1 = 8 (-8 in signed) → overflow", () => {
    const r = alu("ADD", 7, 1);
    expect(r.result).toBe(8);
    expect(r.overflow).toBe(true);
  });

  it("ADD no overflow: 4+3 = 7", () => {
    const r = alu("ADD", 4, 3);
    expect(r.overflow).toBe(false);
  });

  it("SUB 5-3 = 2 (no borrow)", () => {
    const r = alu("SUB", 5, 3);
    expect(r.result).toBe(2);
    expect(r.borrow).toBe(false);
  });

  it("SUB 3-5 → 14 (mod 16) with borrow", () => {
    const r = alu("SUB", 3, 5);
    expect(r.result).toBe(14); // 3 - 5 = -2, mod 16 = 14
    expect(r.borrow).toBe(true);
  });
});

describe("alu — logical ops", () => {
  it("AND 0110 & 1010 = 0010", () => {
    const r = alu("AND", 0b0110, 0b1010);
    expect(r.result).toBe(0b0010);
  });

  it("OR 0110 | 1010 = 1110", () => {
    const r = alu("OR", 0b0110, 0b1010);
    expect(r.result).toBe(0b1110);
  });

  it("XOR 1111 ^ 1010 = 0101", () => {
    const r = alu("XOR", 0b1111, 0b1010);
    expect(r.result).toBe(0b0101);
  });

  it("NOT 0101 = 1010", () => {
    const r = alu("NOT", 0b0101, 0);
    expect(r.result).toBe(0b1010);
  });

  it("AND with zero → zero flag", () => {
    expect(alu("AND", 0, 0xf).zero).toBe(true);
  });
});

describe("alu — shifts", () => {
  it("SHL 0011 → 0110", () => {
    const r = alu("SHL", 0b0011, 0);
    expect(r.result).toBe(0b0110);
    expect(r.carry).toBe(false);
  });

  it("SHL with carry: 1100 → 1000 (loses bit 3)", () => {
    const r = alu("SHL", 0b1100, 0);
    expect(r.result).toBe(0b1000);
    expect(r.carry).toBe(true);
  });

  it("SHR 1100 → 0110", () => {
    const r = alu("SHR", 0b1100, 0);
    expect(r.result).toBe(0b0110);
    expect(r.carry).toBe(false);
  });

  it("SHR with carry (LSB out): 0011 → 0001, carry=1", () => {
    const r = alu("SHR", 0b0011, 0);
    expect(r.result).toBe(0b0001);
    expect(r.carry).toBe(true);
  });
});

describe("alu — validation", () => {
  it("RangeError on a > 15", () => {
    expect(() => alu("ADD", 16, 0)).toThrow(RangeError);
  });
  it("RangeError on negative", () => {
    expect(() => alu("ADD", -1, 0)).toThrow(RangeError);
  });
  it("RangeError on non-integer", () => {
    expect(() => alu("ADD", 1.5, 0)).toThrow(RangeError);
  });
});

describe("toBinary4", () => {
  it("0 → '0000', 5 → '0101', 15 → '1111'", () => {
    expect(toBinary4(0)).toBe("0000");
    expect(toBinary4(5)).toBe("0101");
    expect(toBinary4(15)).toBe("1111");
  });
});

describe("fromSigned4", () => {
  it("0..7 unchanged; 8..15 map to -8..-1", () => {
    expect(fromSigned4(0)).toBe(0);
    expect(fromSigned4(7)).toBe(7);
    expect(fromSigned4(8)).toBe(-8);
    expect(fromSigned4(15)).toBe(-1);
  });
});
