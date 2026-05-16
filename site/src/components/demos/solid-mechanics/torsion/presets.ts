/**
 * Named presets for the torsion visualiser.
 *
 * Each preset is a snapshot of the share-relevant state (geometry slug +
 * scalar inputs) so consumers can jump between configurations via
 * <PresetCarousel> and the URL fragment stays in sync via useDemoState.
 */

export type GeometrySlug =
  | "solid-thin"
  | "solid-thick"
  | "hollow-thin-wall"
  | "hollow-thick-wall";

export const GEOMETRY_SLUGS = [
  "solid-thin",
  "solid-thick",
  "hollow-thin-wall",
  "hollow-thick-wall",
] as const satisfies readonly GeometrySlug[];

export interface TorsionDemoState {
  geometrySlug: GeometrySlug;
  torque_Nm: number;
  length_m: number;
  G_GPa: number;
  outerRadius_mm: number;
  innerRadius_mm: number;
}

export interface GeometryMeta {
  label: string;
  outerRadius_mm: number;
  innerRadius_mm: number;
}

export const PRESET_META: Record<GeometrySlug, GeometryMeta> = {
  "solid-thin": { label: "Solid (thin)", outerRadius_mm: 10, innerRadius_mm: 0 },
  "solid-thick": { label: "Solid (thick)", outerRadius_mm: 25, innerRadius_mm: 0 },
  "hollow-thin-wall": {
    label: "Hollow (thin wall)",
    outerRadius_mm: 20,
    innerRadius_mm: 18,
  },
  "hollow-thick-wall": {
    label: "Hollow (thick wall)",
    outerRadius_mm: 25,
    innerRadius_mm: 10,
  },
};

export const DEFAULT_STATE: TorsionDemoState = {
  geometrySlug: "solid-thin",
  torque_Nm: 200,
  length_m: 1,
  G_GPa: 80,
  outerRadius_mm: PRESET_META["solid-thin"].outerRadius_mm,
  innerRadius_mm: PRESET_META["solid-thin"].innerRadius_mm,
};

export interface TorsionPreset {
  name: string;
  state: TorsionDemoState;
}

export const PRESETS: readonly TorsionPreset[] = GEOMETRY_SLUGS.map((slug) => {
  const meta = PRESET_META[slug];
  return {
    name: meta.label,
    state: {
      geometrySlug: slug,
      torque_Nm: 200,
      length_m: 1,
      G_GPa: 80,
      outerRadius_mm: meta.outerRadius_mm,
      innerRadius_mm: meta.innerRadius_mm,
    },
  };
});
