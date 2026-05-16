/**
 * Named presets for the truth-table visualiser (#115).
 *
 * Each preset is a snapshot of all share-relevant state, so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via useDemoState.
 */

export const GATE_TYPES = [
  "AND",
  "OR",
  "NAND",
  "NOR",
  "XOR",
  "XNOR",
  "NOT",
] as const;

export type GateType = (typeof GATE_TYPES)[number];

export interface TruthTableDemoState {
  gate: GateType;
  nInputs: number;
}

export interface TruthTablePreset {
  name: string;
  state: TruthTableDemoState;
}

export const PRESET_SLUGS = [
  "and-2input",
  "or-3input",
  "xor-2input",
  "nand-2input",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const DEFAULT_STATE: TruthTableDemoState = {
  gate: "AND",
  nInputs: 2,
};

export const PRESET_META: Record<PresetSlug, { name: string; state: TruthTableDemoState }> = {
  "and-2input": { name: "and-2input", state: { gate: "AND", nInputs: 2 } },
  "or-3input": { name: "or-3input", state: { gate: "OR", nInputs: 3 } },
  "xor-2input": { name: "xor-2input", state: { gate: "XOR", nInputs: 2 } },
  "nand-2input": { name: "NAND gate", state: { gate: "NAND", nInputs: 2 } },
};

export const PRESETS: readonly TruthTablePreset[] = PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].name,
  state: PRESET_META[slug].state,
}));

/**
 * Clamp the requested input count for a given gate. NOT is unary; all
 * other gates honour the requested arity (1–4) with a floor of 2 so the
 * truth table is never degenerate.
 */
export function clampNInputs(gate: GateType, nInputs: number): number {
  if (gate === "NOT") return 1;
  const clamped = Math.round(nInputs);
  if (!Number.isFinite(clamped)) return 2;
  if (clamped < 2) return 2;
  if (clamped > 4) return 4;
  return clamped;
}
