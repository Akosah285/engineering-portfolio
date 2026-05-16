/**
 * Named presets for the Laplace-rectangle visualiser.
 *
 * Each preset is a full snapshot of share-relevant state so the
 * PresetCarousel can jump between configurations and useDemoState
 * keeps the URL fragment in sync.
 */

export interface LaplaceRectDemoState {
  nGrid: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  omega: number;
}

export interface LaplaceRectPreset {
  name: string;
  state: LaplaceRectDemoState;
}

export const PRESET_SLUGS = [
  "hot-top",
  "alternating-walls",
  "uniform-hot",
  "asymmetric-corner",
] as const;

export type LaplaceRectPresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<LaplaceRectPresetSlug, { name: string }> = {
  "hot-top": { name: "Hot top" },
  "alternating-walls": { name: "Alternating walls" },
  "uniform-hot": { name: "Uniform hot" },
  "asymmetric-corner": { name: "Asymmetric corner" },
};

export const DEFAULT_STATE: LaplaceRectDemoState = {
  nGrid: 30,
  top: 100,
  bottom: 0,
  left: 0,
  right: 0,
  omega: 1.5,
};

export const PRESETS: readonly LaplaceRectPreset[] = [
  {
    name: PRESET_META["hot-top"].name,
    state: { nGrid: 30, top: 100, bottom: 0, left: 0, right: 0, omega: 1.5 },
  },
  {
    name: PRESET_META["alternating-walls"].name,
    state: { nGrid: 30, top: 100, bottom: -100, left: 100, right: -100, omega: 1.5 },
  },
  {
    name: PRESET_META["uniform-hot"].name,
    state: { nGrid: 30, top: 100, bottom: 100, left: 100, right: 100, omega: 1.5 },
  },
  {
    name: PRESET_META["asymmetric-corner"].name,
    state: { nGrid: 40, top: 100, bottom: 0, left: 100, right: 0, omega: 1.7 },
  },
] as const;
