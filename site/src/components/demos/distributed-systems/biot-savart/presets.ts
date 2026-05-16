/**
 * Named presets + state schema for the Biot–Savart visualiser.
 */

export const CARRIERS = ["circular-loop", "two-parallel-wires", "square-loop"] as const;
export type Carrier = (typeof CARRIERS)[number];

export interface BiotSavartDemoState {
  carrier: Carrier;
  I: number;
  R: number;
  nSegments: number;
  gridRes: number;
}

export const DEFAULT_STATE: BiotSavartDemoState = {
  carrier: "circular-loop",
  I: 1.0,
  R: 1.0,
  nSegments: 24,
  gridRes: 18,
};

export const PRESET_SLUGS = [
  "single-loop",
  "two-loops-helmholtz",
  "square-loop",
  "anti-parallel-wires",
] as const;
export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface PresetMeta {
  slug: PresetSlug;
  name: string;
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  "single-loop": { slug: "single-loop", name: "Single loop" },
  "two-loops-helmholtz": { slug: "two-loops-helmholtz", name: "Two loops (Helmholtz)" },
  "square-loop": { slug: "square-loop", name: "Square loop" },
  "anti-parallel-wires": { slug: "anti-parallel-wires", name: "Anti-parallel wires" },
};

export interface BiotSavartPreset {
  name: string;
  state: BiotSavartDemoState;
}

export const PRESETS: readonly BiotSavartPreset[] = [
  {
    name: PRESET_META["single-loop"].name,
    state: { carrier: "circular-loop", I: 1.0, R: 1.0, nSegments: 24, gridRes: 18 },
  },
  {
    name: PRESET_META["two-loops-helmholtz"].name,
    state: { carrier: "circular-loop", I: 2.0, R: 1.0, nSegments: 36, gridRes: 20 },
  },
  {
    name: PRESET_META["square-loop"].name,
    state: { carrier: "square-loop", I: 1.5, R: 0.8, nSegments: 12, gridRes: 18 },
  },
  {
    name: PRESET_META["anti-parallel-wires"].name,
    state: { carrier: "two-parallel-wires", I: 3.0, R: 0.6, nSegments: 12, gridRes: 18 },
  },
] as const;
