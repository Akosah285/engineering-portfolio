/**
 * Named programs for the datapath visualiser.
 *
 * Each preset is a snapshot of `{ pc, program }` so consumers can jump to
 * any preset via <PresetCarousel> while <useDemoState> keeps the URL
 * fragment in sync.
 */

import type { Op, RegName } from "./algorithm";

export const PROGRAM_SLUGS = [
  "add-two-numbers",
  "countdown-by-one",
  "bitmask-and",
  "shift-double",
] as const;

export type ProgramSlug = (typeof PROGRAM_SLUGS)[number];

export interface DatapathDemoState {
  pc: number;
  program: ProgramSlug;
}

export interface DatapathPreset {
  name: string;
  state: DatapathDemoState;
}

const R0: RegName = "R0";
const R1: RegName = "R1";
const R2: RegName = "R2";

export const PROGRAMS: Record<ProgramSlug, { label: string; ops: readonly Op[] }> = {
  "add-two-numbers": {
    label: "Add two",
    ops: [
      { kind: "LOAD", rd: R0, imm: 5 },
      { kind: "LOAD", rd: R1, imm: 3 },
      { kind: "ADD", rd: R2, ra: R0, rb: R1 },
    ],
  },
  "countdown-by-one": {
    label: "Countdown",
    ops: [
      { kind: "LOAD", rd: R0, imm: 4 },
      { kind: "LOAD", rd: R1, imm: 1 },
      { kind: "SUB", rd: R0, ra: R0, rb: R1 },
      { kind: "SUB", rd: R0, ra: R0, rb: R1 },
    ],
  },
  "bitmask-and": {
    label: "Bitmask AND",
    ops: [
      { kind: "LOAD", rd: R0, imm: 0xab },
      { kind: "LOAD", rd: R1, imm: 0x0f },
      { kind: "AND", rd: R2, ra: R0, rb: R1 },
    ],
  },
  "shift-double": {
    label: "Shift double",
    ops: [
      { kind: "LOAD", rd: R0, imm: 5 },
      { kind: "SHL", rd: R1, ra: R0 },
      { kind: "SHL", rd: R2, ra: R1 },
    ],
  },
};

export const DEFAULT_STATE: DatapathDemoState = {
  pc: 0,
  program: "add-two-numbers",
};

export const PRESETS: readonly DatapathPreset[] = [
  { name: "Add two", state: { pc: 0, program: "add-two-numbers" } },
  { name: "Countdown", state: { pc: 0, program: "countdown-by-one" } },
  { name: "Bitmask AND", state: { pc: 0, program: "bitmask-and" } },
  { name: "Shift double", state: { pc: 0, program: "shift-double" } },
] as const;

/** Format an `Op` as a human-readable assembly line. */
export function formatOp(op: Op): string {
  switch (op.kind) {
    case "LOAD":
      return `LOAD ${op.rd}, ${op.imm}`;
    case "MOV":
      return `MOV ${op.rd}, ${op.rs}`;
    case "ADD":
    case "SUB":
    case "AND":
    case "OR":
    case "XOR":
      return `${op.kind} ${op.rd}, ${op.ra}, ${op.rb}`;
    case "NOT":
    case "SHL":
    case "SHR":
      return `${op.kind} ${op.rd}, ${op.ra}`;
  }
}
