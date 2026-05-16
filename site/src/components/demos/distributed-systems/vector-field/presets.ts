/**
 * Named presets for the vector-field visualizer (#101).
 *
 * Each preset is a snapshot of all share-relevant state, so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via <useDemoState>.
 */

export type ColoringMode = "magnitude" | "divergence" | "curl";
export type FieldKind = "uniform" | "radial" | "vortex" | "saddle";

export const COLORING_MODES = ["magnitude", "divergence", "curl"] as const;
export const FIELD_KINDS = ["uniform", "radial", "vortex", "saddle"] as const;

export interface VectorFieldDemoState {
  coloring: ColoringMode;
  field: FieldKind;
  nx: number;
  ny: number;
}

export interface VectorFieldPreset {
  name: string;
  state: VectorFieldDemoState;
}

export const DEFAULT_STATE: VectorFieldDemoState = {
  coloring: "magnitude",
  field: "uniform",
  nx: 16,
  ny: 16,
};

export const PRESET_SLUGS = [
  "uniform-flow",
  "radial-outflow",
  "vortex-rotation",
  "saddle-point",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<PresetSlug, { name: string; description: string }> = {
  "uniform-flow": {
    name: "Uniform flow",
    description: "Constant vector field — zero divergence, zero curl.",
  },
  "radial-outflow": {
    name: "Radial outflow",
    description: "F = (x, y) — a source field with positive divergence everywhere.",
  },
  "vortex-rotation": {
    name: "Vortex rotation",
    description: "F = (−y, x) — rigid rotation with positive curl, zero divergence.",
  },
  "saddle-point": {
    name: "Saddle point",
    description: "F = (x, −y) — diverges along x, converges along y; zero divergence.",
  },
};

export const PRESETS: readonly VectorFieldPreset[] = [
  {
    name: PRESET_META["uniform-flow"].name,
    state: { coloring: "magnitude", field: "uniform", nx: 16, ny: 16 },
  },
  {
    name: PRESET_META["radial-outflow"].name,
    state: { coloring: "divergence", field: "radial", nx: 16, ny: 16 },
  },
  {
    name: PRESET_META["vortex-rotation"].name,
    state: { coloring: "curl", field: "vortex", nx: 16, ny: 16 },
  },
  {
    name: PRESET_META["saddle-point"].name,
    state: { coloring: "divergence", field: "saddle", nx: 16, ny: 16 },
  },
] as const;
