/**
 * truthTable — generic truth-table builder for combinational logic (#115).
 *
 * Given an ordered list of input names and a pure boolean evaluator function,
 * produces every (2^N) row of the truth table.  Rows are returned in
 * canonical "binary count" order: row 0 = all false, then incrementing
 * the rightmost-input bit fastest (MSB = first input name).
 *
 * The React shell will use this for a generic truth-table viewer; specific
 * gates (AND, OR, XOR, NAND, NOR, XNOR) are also exposed as primitives.
 */

export interface TruthTableInput {
  readonly inputs: ReadonlyArray<string>;
  readonly evaluate: (assignment: Record<string, boolean>) => boolean;
}

export interface TruthTableRow {
  /** Maps input name to its value for this row. */
  readonly assignment: Readonly<Record<string, boolean>>;
  /** Output of the evaluator. */
  readonly output: boolean;
}

const MAX_INPUTS = 16;

export function truthTable(input: TruthTableInput): TruthTableRow[] {
  const n = input.inputs.length;
  if (n === 0) {
    throw new RangeError("truthTable: at least one input is required.");
  }
  if (n > MAX_INPUTS) {
    throw new RangeError(`truthTable: at most ${MAX_INPUTS} inputs are supported.`);
  }
  // Detect duplicate input names — they would silently overwrite assignments
  if (new Set(input.inputs).size !== n) {
    throw new RangeError("truthTable: input names must be unique.");
  }

  const rows: TruthTableRow[] = new Array(2 ** n);
  for (let mask = 0; mask < 2 ** n; mask += 1) {
    const assignment: Record<string, boolean> = {};
    for (let i = 0; i < n; i += 1) {
      // MSB = first input. Bit (n-1-i) of mask gives input i's value.
      const bit = (mask >> (n - 1 - i)) & 1;
      assignment[input.inputs[i]!] = bit === 1;
    }
    rows[mask] = { assignment, output: input.evaluate(assignment) };
  }
  return rows;
}

// --- Gate primitives ---

export const AND = (a: boolean, b: boolean): boolean => a && b;
export const OR = (a: boolean, b: boolean): boolean => a || b;
export const NOT = (a: boolean): boolean => !a;
export const NAND = (a: boolean, b: boolean): boolean => !(a && b);
export const NOR = (a: boolean, b: boolean): boolean => !(a || b);
export const XOR = (a: boolean, b: boolean): boolean => a !== b;
export const XNOR = (a: boolean, b: boolean): boolean => a === b;

/**
 * Convert a row's assignment to a binary string in input-order
 * (e.g. {A:true, B:false} with inputs=["A","B"] → "10").
 */
export function rowKey(row: TruthTableRow, inputs: ReadonlyArray<string>): string {
  return inputs.map((name) => (row.assignment[name] ? "1" : "0")).join("");
}

/**
 * Return the minterms of a truth table — the row indices whose output is true.
 * Indices are integers in [0, 2^N) using MSB = first input convention.
 */
export function minterms(rows: ReadonlyArray<TruthTableRow>): number[] {
  return rows
    .map((row, index): [number, boolean] => [index, row.output])
    .filter(([, out]) => out)
    .map(([i]) => i);
}
