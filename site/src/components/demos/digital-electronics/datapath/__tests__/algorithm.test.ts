import { describe, expect, it } from "vitest";
import { initState, run, step, type Op } from "../algorithm";

describe("initial state", () => {
  it("all registers zero, zero flag set", () => {
    const s = initState();
    expect(s.regs).toEqual({ R0: 0, R1: 0, R2: 0, R3: 0 });
    expect(s.flags.zero).toBe(true);
    expect(s.flags.negative).toBe(false);
    expect(s.flags.carry).toBe(false);
  });
});

describe("LOAD", () => {
  it("loads immediate into register", () => {
    const s = step(initState(), { kind: "LOAD", rd: "R1", imm: 42 });
    expect(s.regs.R1).toBe(42);
  });

  it("zero flag set when loading 0", () => {
    const s = step(initState(), { kind: "LOAD", rd: "R0", imm: 0 });
    expect(s.flags.zero).toBe(true);
  });

  it("negative flag set when MSB is 1", () => {
    const s = step(initState(), { kind: "LOAD", rd: "R0", imm: 0x80 });
    expect(s.flags.negative).toBe(true);
  });

  it("rejects imm out of range", () => {
    expect(() =>
      step(initState(), { kind: "LOAD", rd: "R0", imm: 256 }),
    ).toThrow(RangeError);
    expect(() =>
      step(initState(), { kind: "LOAD", rd: "R0", imm: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      step(initState(), { kind: "LOAD", rd: "R0", imm: 1.5 }),
    ).toThrow(RangeError);
  });
});

describe("ADD", () => {
  it("3 + 5 = 8, no carry", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 3 },
      { kind: "LOAD", rd: "R1", imm: 5 },
      { kind: "ADD", rd: "R2", ra: "R0", rb: "R1" },
    ];
    const s = run(p);
    expect(s.regs.R2).toBe(8);
    expect(s.flags.carry).toBe(false);
  });

  it("overflow sets carry and wraps", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 255 },
      { kind: "LOAD", rd: "R1", imm: 2 },
      { kind: "ADD", rd: "R2", ra: "R0", rb: "R1" },
    ];
    const s = run(p);
    expect(s.regs.R2).toBe(1);
    expect(s.flags.carry).toBe(true);
  });
});

describe("SUB", () => {
  it("5 - 3 = 2, no borrow", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 5 },
      { kind: "LOAD", rd: "R1", imm: 3 },
      { kind: "SUB", rd: "R2", ra: "R0", rb: "R1" },
    ];
    const s = run(p);
    expect(s.regs.R2).toBe(2);
    expect(s.flags.carry).toBe(false);
  });

  it("3 - 5 wraps and sets borrow (carry)", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 3 },
      { kind: "LOAD", rd: "R1", imm: 5 },
      { kind: "SUB", rd: "R2", ra: "R0", rb: "R1" },
    ];
    const s = run(p);
    expect(s.regs.R2).toBe(254);
    expect(s.flags.carry).toBe(true);
  });
});

describe("bitwise ops", () => {
  it("AND 0xF0 & 0x0F = 0", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0xf0 },
      { kind: "LOAD", rd: "R1", imm: 0x0f },
      { kind: "AND", rd: "R2", ra: "R0", rb: "R1" },
    ];
    const s = run(p);
    expect(s.regs.R2).toBe(0);
    expect(s.flags.zero).toBe(true);
  });

  it("OR 0xF0 | 0x0F = 0xFF", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0xf0 },
      { kind: "LOAD", rd: "R1", imm: 0x0f },
      { kind: "OR", rd: "R2", ra: "R0", rb: "R1" },
    ];
    expect(run(p).regs.R2).toBe(0xff);
  });

  it("XOR self gives zero", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0xa5 },
      { kind: "XOR", rd: "R1", ra: "R0", rb: "R0" },
    ];
    const s = run(p);
    expect(s.regs.R1).toBe(0);
    expect(s.flags.zero).toBe(true);
  });

  it("NOT inverts all 8 bits", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0xa5 },
      { kind: "NOT", rd: "R1", ra: "R0" },
    ];
    expect(run(p).regs.R1).toBe(0x5a);
  });
});

describe("shifts", () => {
  it("SHL 0x01 -> 0x02, no carry", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0x01 },
      { kind: "SHL", rd: "R1", ra: "R0" },
    ];
    const s = run(p);
    expect(s.regs.R1).toBe(0x02);
    expect(s.flags.carry).toBe(false);
  });

  it("SHL 0x80 wraps to 0x00 with carry set", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0x80 },
      { kind: "SHL", rd: "R1", ra: "R0" },
    ];
    const s = run(p);
    expect(s.regs.R1).toBe(0);
    expect(s.flags.carry).toBe(true);
  });

  it("SHR 0x02 -> 0x01, no carry", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0x02 },
      { kind: "SHR", rd: "R1", ra: "R0" },
    ];
    const s = run(p);
    expect(s.regs.R1).toBe(0x01);
    expect(s.flags.carry).toBe(false);
  });

  it("SHR 0x01 -> 0x00 with carry set (bit-0 out)", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 0x01 },
      { kind: "SHR", rd: "R1", ra: "R0" },
    ];
    const s = run(p);
    expect(s.regs.R1).toBe(0);
    expect(s.flags.carry).toBe(true);
  });
});

describe("MOV + run sequencing", () => {
  it("MOV copies between registers", () => {
    const p: Op[] = [
      { kind: "LOAD", rd: "R0", imm: 7 },
      { kind: "MOV", rd: "R1", rs: "R0" },
    ];
    expect(run(p).regs.R1).toBe(7);
  });

  it("run with empty program returns initial state", () => {
    const s = run([]);
    expect(s).toEqual(initState());
  });
});
