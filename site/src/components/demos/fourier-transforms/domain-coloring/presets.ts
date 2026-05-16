/**
 * Named presets for the domain-coloring visualizer.
 *
 * Each preset is a complete snapshot of share-relevant state so consumers can
 * jump between presets via <PresetCarousel> and have the URL fragment stay in
 * sync via <useDemoState>.
 */

export const FN_SLOTS = [
  "z",
  "z2",
  "z3",
  "1/z",
  "z2-1",
  "sin-z",
  "exp-z",
] as const;

export type FnSlot = (typeof FN_SLOTS)[number];

export interface DomainColoringDemoState {
  gridSize: number;
  fnSlot: FnSlot;
}

export const DEFAULT_STATE: DomainColoringDemoState = {
  gridSize: 120,
  fnSlot: "z",
};

export const PRESET_SLUGS = [
  "identity-z",
  "z-squared",
  "reciprocal",
  "sin-of-z",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface PresetMeta {
  slug: PresetSlug;
  name: string;
  state: DomainColoringDemoState;
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  "identity-z": {
    slug: "identity-z",
    name: "Identity z",
    state: { gridSize: 120, fnSlot: "z" },
  },
  "z-squared": {
    slug: "z-squared",
    name: "Squared (z^2)",
    state: { gridSize: 120, fnSlot: "z2" },
  },
  reciprocal: {
    slug: "reciprocal",
    name: "Reciprocal 1/z",
    state: { gridSize: 120, fnSlot: "1/z" },
  },
  "sin-of-z": {
    slug: "sin-of-z",
    name: "sin(z)",
    state: { gridSize: 120, fnSlot: "sin-z" },
  },
};

export interface DomainColoringPreset {
  name: string;
  state: DomainColoringDemoState;
}

export const PRESETS: readonly DomainColoringPreset[] = PRESET_SLUGS.map(
  (slug) => ({
    name: PRESET_META[slug].name,
    state: PRESET_META[slug].state,
  }),
);
