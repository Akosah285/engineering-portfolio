/**
 * Named presets for the 2D-wave visualiser.
 */

export const SOURCE_VALUES = ["single", "two-sources", "corner"] as const;
export type SourceKind = (typeof SOURCE_VALUES)[number];

export interface Wave2DDemoState {
  nGrid: number;
  c: number;
  dt: number;
  source: SourceKind;
}

export const PRESET_SLUGS = [
  "single-pulse-center",
  "two-source-interference",
  "corner-pulse",
  "low-cfl-clean",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface Wave2DPreset {
  slug: PresetSlug;
  name: string;
  state: Wave2DDemoState;
}

export const DEFAULT_STATE: Wave2DDemoState = {
  nGrid: 60,
  c: 1.0,
  dt: 0.02,
  source: "single",
};

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "single-pulse-center": { name: "Single pulse · center" },
  "two-source-interference": { name: "Two-source interference" },
  "corner-pulse": { name: "Corner pulse" },
  "low-cfl-clean": { name: "Low CFL · clean" },
};

export const PRESETS: readonly Wave2DPreset[] = [
  {
    slug: "single-pulse-center",
    name: PRESET_META["single-pulse-center"].name,
    state: { nGrid: 60, c: 1.0, dt: 0.02, source: "single" },
  },
  {
    slug: "two-source-interference",
    name: PRESET_META["two-source-interference"].name,
    state: { nGrid: 70, c: 1.0, dt: 0.02, source: "two-sources" },
  },
  {
    slug: "corner-pulse",
    name: PRESET_META["corner-pulse"].name,
    state: { nGrid: 60, c: 1.2, dt: 0.02, source: "corner" },
  },
  {
    slug: "low-cfl-clean",
    name: PRESET_META["low-cfl-clean"].name,
    state: { nGrid: 50, c: 0.6, dt: 0.01, source: "single" },
  },
] as const;
