// Datapath — simulate a tiny register file + ALU executing micro-operations.
// Reference: Patterson & Hennessy, "Computer Organization and Design", §4.4
// (Building a Datapath). Modeled after the Lab 4 datapath.
//
// 4 registers (R0..R3). ALU ops on 8-bit unsigned values (0..255 wrap).
// Operations: LOAD <r> <imm>, MOV <rd> <rs>, ADD <rd> <ra> <rb>,
//             SUB <rd> <ra> <rb>, AND <rd> <ra> <rb>, OR  <rd> <ra> <rb>,
//             XOR <rd> <ra> <rb>, NOT <rd> <ra>, SHL <rd> <ra>, SHR <rd> <ra>

export type RegName = "R0" | "R1" | "R2" | "R3";

export interface RegFile {
  R0: number;
  R1: number;
  R2: number;
  R3: number;
}

export interface Flags {
  zero: boolean;
  negative: boolean;
  carry: boolean;
}

export type Op =
  | { kind: "LOAD"; rd: RegName; imm: number }
  | { kind: "MOV"; rd: RegName; rs: RegName }
  | { kind: "ADD"; rd: RegName; ra: RegName; rb: RegName }
  | { kind: "SUB"; rd: RegName; ra: RegName; rb: RegName }
  | { kind: "AND"; rd: RegName; ra: RegName; rb: RegName }
  | { kind: "OR"; rd: RegName; ra: RegName; rb: RegName }
  | { kind: "XOR"; rd: RegName; ra: RegName; rb: RegName }
  | { kind: "NOT"; rd: RegName; ra: RegName }
  | { kind: "SHL"; rd: RegName; ra: RegName }
  | { kind: "SHR"; rd: RegName; ra: RegName };

export interface CpuState {
  regs: RegFile;
  flags: Flags;
}

const MASK = 0xff;

export function initState(): CpuState {
  return {
    regs: { R0: 0, R1: 0, R2: 0, R3: 0 },
    flags: { zero: true, negative: false, carry: false },
  };
}

function clamp8(x: number): number {
  return x & MASK;
}

function updateFlags(value: number, carry: boolean): Flags {
  const masked = clamp8(value);
  return {
    zero: masked === 0,
    negative: (masked & 0x80) !== 0,
    carry,
  };
}

export function step(state: CpuState, op: Op): CpuState {
  const r = { ...state.regs };
  let result = 0;
  let carry = false;
  let target: RegName | null = null;

  switch (op.kind) {
    case "LOAD": {
      if (!Number.isInteger(op.imm) || op.imm < 0 || op.imm > 255) {
        throw new RangeError("LOAD: imm must be integer in 0..255");
      }
      result = op.imm;
      target = op.rd;
      break;
    }
    case "MOV": {
      result = r[op.rs];
      target = op.rd;
      break;
    }
    case "ADD": {
      const sum = r[op.ra] + r[op.rb];
      result = clamp8(sum);
      carry = sum > 0xff;
      target = op.rd;
      break;
    }
    case "SUB": {
      const diff = r[op.ra] - r[op.rb];
      result = clamp8(diff);
      carry = diff < 0; // borrow
      target = op.rd;
      break;
    }
    case "AND": {
      result = r[op.ra] & r[op.rb];
      target = op.rd;
      break;
    }
    case "OR": {
      result = r[op.ra] | r[op.rb];
      target = op.rd;
      break;
    }
    case "XOR": {
      result = r[op.ra] ^ r[op.rb];
      target = op.rd;
      break;
    }
    case "NOT": {
      result = ~r[op.ra] & MASK;
      target = op.rd;
      break;
    }
    case "SHL": {
      const sh = r[op.ra] << 1;
      result = clamp8(sh);
      carry = (sh & 0x100) !== 0;
      target = op.rd;
      break;
    }
    case "SHR": {
      carry = (r[op.ra] & 1) === 1;
      result = r[op.ra] >>> 1;
      target = op.rd;
      break;
    }
  }

  r[target] = result;
  return { regs: r, flags: updateFlags(result, carry) };
}

export function run(program: readonly Op[], start?: CpuState): CpuState {
  let s = start ?? initState();
  for (const op of program) {
    s = step(s, op);
  }
  return s;
}
