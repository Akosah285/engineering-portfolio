/**
 * Named presets for the Failure Criteria visualizer.
 *
 * Each preset is a full snapshot of share-relevant state so that the
 * <PresetCarousel> can jump straight to a configuration and the URL
 * fragment (via <useDemoState>) stays in sync.
 */

export interface FailureCriteriaDemoState {
  s1: number;
  s2: number;
  sy: number;
}

export const PRESET_SLUGS = [
  "pure-tension",
  "biaxial-tension",
  "pure-shear",
  "compression-tension",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "pure-tension": { name: "Pure tension" },
  "biaxial-tension": { name: "Biaxial tension" },
  "pure-shear": { name: "Pure shear" },
  "compression-tension": { name: "Compression-tension" },
};

export const DEFAULT_STATE: FailureCriteriaDemoState = {
  s1: 150,
  s2: 0,
  sy: 250,
};

export interface FailureCriteriaPreset {
  name: string;
  state: FailureCriteriaDemoState;
}

export const PRESETS: readonly FailureCriteriaPreset[] = [
  {
    name: PRESET_META["pure-tension"].name,
    state: { s1: 200, s2: 0, sy: 250 },
  },
  {
    name: PRESET_META["biaxial-tension"].name,
    state: { s1: 200, s2: 200, sy: 250 },
  },
  {
    name: PRESET_META["pure-shear"].name,
    state: { s1: 150, s2: -150, sy: 250 },
  },
  {
    name: PRESET_META["compression-tension"].name,
    state: { s1: 200, s2: -200, sy: 250 },
  },
] as const;
