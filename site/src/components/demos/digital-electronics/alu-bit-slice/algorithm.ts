// ALU bit-slice explorer (4-bit ALU operations).
//
// Mirrors the v9 Digital Electronics ALU lab. Implements a 4-bit ALU with
// operations: ADD, SUB, AND, OR, XOR, NOT, SHL, SHR.
//
// Inputs are 0..15 (4-bit unsigned); ADD/SUB carry/overflow surfaced.
// Result wraps mod 16. Borrow flag for SUB. Overflow flag for signed
// interpretation (two's complement -8..7).

export type AluOp = "ADD" | "SUB" | "AND" | "OR" | "XOR" | "NOT" | "SHL" | "SHR";

const MASK = 0b1111;

export interface AluResult {
  readonly result: number; // 0..15
  readonly carry: boolean; // ADD overflow into 5th bit
  readonly borrow: boolean; // SUB underflow
  readonly overflow: boolean; // signed overflow for ADD/SUB
  readonly zero: boolean;
  readonly negative: boolean; // sign bit (bit 3)
}

function validate4Bit(label: string, n: number): void {
  if (!Number.isInteger(n)) throw new RangeError(`${label} must be integer`);
  if (n < 0 || n > MASK) throw new RangeError(`${label} must be in 0..15`);
}

export function alu(op: AluOp, a: number, b: number): AluResult {
  validate4Bit("a", a);
  if (op !== "NOT") validate4Bit("b", b);
  let raw: number;
  let carry = false;
  let borrow = false;
  let overflow = false;
  switch (op) {
    case "ADD": {
      const sum = a + b;
      carry = sum > MASK;
      raw = sum & MASK;
      // Signed overflow: sign of a and b match, but sign of result differs.
      const aSign = (a & 0b1000) !== 0;
      const bSign = (b & 0b1000) !== 0;
      const rSign = (raw & 0b1000) !== 0;
      overflow = aSign === bSign && aSign !== rSign;
      break;
    }
    case "SUB": {
      const diff = a - b;
      borrow = diff < 0;
      raw = diff & MASK;
      const aSign = (a & 0b1000) !== 0;
      const bSign = (b & 0b1000) !== 0;
      const rSign = (raw & 0b1000) !== 0;
      // Overflow if signs differ AND result sign != a's sign.
      overflow = aSign !== bSign && rSign !== aSign;
      break;
    }
    case "AND":
      raw = a & b;
      break;
    case "OR":
      raw = a | b;
      break;
    case "XOR":
      raw = a ^ b;
      break;
    case "NOT":
      raw = ~a & MASK;
      break;
    case "SHL":
      raw = (a << 1) & MASK;
      carry = (a & 0b1000) !== 0;
      break;
    case "SHR":
      raw = a >>> 1;
      carry = (a & 0b0001) !== 0;
      break;
    default: {
      const _exhaustive: never = op;
      throw new RangeError(`unknown op: ${String(_exhaustive)}`);
    }
  }
  const zero = raw === 0;
  const negative = (raw & 0b1000) !== 0;
  return { result: raw, carry, borrow, overflow, zero, negative };
}

export function toBinary4(n: number): string {
  validate4Bit("n", n);
  return n.toString(2).padStart(4, "0");
}

export function fromSigned4(n: number): number {
  validate4Bit("n", n);
  return (n & 0b1000) !== 0 ? n - 16 : n;
}
