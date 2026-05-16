/**
 * Named presets for the Karnaugh-map minimizer visualiser.
 *
 * Only `nVars` is share-relevant via useDemoState; per-preset minterm
 * arrays live in PRESET_META so they don't need to round-trip through
 * the URL fragment.
 */

export interface KarnaughDemoState {
  nVars: number;
}

export const DEFAULT_STATE: KarnaughDemoState = {
  nVars: 2,
};

export const PRESET_SLUGS = [
  "and-gate",
  "xor-pattern",
  "majority-3",
  "4var-with-dontcares",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface PresetMeta {
  label: string;
  narration: string;
  state: KarnaughDemoState;
  minterms: number[];
  dontCares?: number[];
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  "and-gate": {
    label: "AND gate",
    narration: "F = A·B — the canonical 2-variable AND, a single minterm at A=1, B=1.",
    state: { nVars: 2 },
    minterms: [3],
  },
  "xor-pattern": {
    label: "XOR pattern",
    narration: "F = A⊕B — two diagonal minterms that cannot merge into one cube.",
    state: { nVars: 2 },
    minterms: [1, 2],
  },
  "majority-3": {
    label: "Majority-of-3",
    narration: "F = AB + AC + BC — true when at least two of three inputs are high.",
    state: { nVars: 3 },
    minterms: [3, 5, 6, 7],
  },
  "4var-with-dontcares": {
    label: "4-var with don't-cares",
    narration: "Don't-cares (X) let the minimizer absorb extra cells into larger cubes.",
    state: { nVars: 4 },
    minterms: [1, 3, 7, 11, 15],
    dontCares: [0, 2, 5],
  },
};

export interface KarnaughPreset {
  name: string;
  state: KarnaughDemoState & { slug: PresetSlug };
}

export const PRESETS: readonly KarnaughPreset[] = PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].label,
  state: { ...PRESET_META[slug].state, slug },
}));
