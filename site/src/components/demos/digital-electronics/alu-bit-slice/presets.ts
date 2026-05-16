import type { AluOp } from "./algorithm";

export interface AluDemoState {
  op: AluOp;
  a: number;
  b: number;
}

export interface AluPreset {
  name: string;
  state: AluDemoState;
}

export const DEFAULT_STATE: AluDemoState = {
  op: "ADD",
  a: 5,
  b: 3,
};

export const PRESETS: readonly AluPreset[] = [
  { name: "ADD with carry", state: { op: "ADD", a: 12, b: 10 } },
  { name: "SUB with borrow", state: { op: "SUB", a: 3, b: 8 } },
  { name: "Signed overflow", state: { op: "ADD", a: 7, b: 1 } },
  { name: "SHL bit-3 out", state: { op: "SHL", a: 8, b: 0 } },
] as const;
