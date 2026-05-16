/**
 * Named presets for the shear-and-moment visualiser (#96).
 *
 * Magnitudes are stored in slider-friendly units (kN, kN/m) and converted
 * to SI when assembling the BeamInput for `analyze`.
 */

export const PRESET_SLUGS = [
  "centered-point",
  "off-center-point",
  "uniform-load",
  "combined-load",
] as const;

export type ShearMomentPresetSlug = (typeof PRESET_SLUGS)[number];

export interface ShearMomentDemoState {
  preset: ShearMomentPresetSlug;
  /** Span length (m). */
  L: number;
  /** Point-load magnitude (kN, positive = downward). */
  P: number;
  /** Position of point load from left support (m). */
  xP: number;
  /** UDL intensity (kN/m, positive = downward). */
  w: number;
}

export interface ShearMomentPreset {
  name: string;
  state: ShearMomentDemoState;
}

export const DEFAULT_STATE: ShearMomentDemoState = {
  preset: "centered-point",
  L: 6,
  P: 10,
  xP: 3,
  w: 0,
};

export interface PresetMeta {
  label: string;
  narration: string;
  state: ShearMomentDemoState;
}

export const PRESET_META: Record<ShearMomentPresetSlug, PresetMeta> = {
  "centered-point": {
    label: "Centered point load",
    narration:
      "Single downward point load at midspan — symmetric triangular moment diagram.",
    state: { preset: "centered-point", L: 6, P: 10, xP: 3, w: 0 },
  },
  "off-center-point": {
    label: "Off-center point load",
    narration:
      "Point load shifted toward the right support — asymmetric reactions, peak moment under the load.",
    state: { preset: "off-center-point", L: 6, P: 12, xP: 4.5, w: 0 },
  },
  "uniform-load": {
    label: "Uniform load",
    narration:
      "Uniformly distributed load over the whole span — parabolic moment diagram peaking at midspan.",
    state: { preset: "uniform-load", L: 6, P: 0, xP: 3, w: 5 },
  },
  "combined-load": {
    label: "Combined point + UDL",
    narration:
      "Superposition of a point load and a uniform load — diagrams add linearly.",
    state: { preset: "combined-load", L: 8, P: 10, xP: 5, w: 4 },
  },
};

export const PRESETS: readonly ShearMomentPreset[] = PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].label,
  state: PRESET_META[slug].state,
}));
