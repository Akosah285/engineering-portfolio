/**
 * Named loading presets for the 3-D stress visualiser.
 *
 * Each preset is a snapshot of the symmetric stress tensor (sx, sy, sz,
 * txy, txz, tyz) plus its slug. The PresetCarousel teleports the user to
 * the canonical configuration.
 */

export const LOADING_SLUGS = [
  "uniaxial-tension",
  "pure-shear",
  "hydrostatic",
  "triaxial-mixed",
] as const;

export type LoadingSlug = (typeof LOADING_SLUGS)[number];

export interface Stress3dDemoState {
  sx: number;
  sy: number;
  sz: number;
  txy: number;
  txz: number;
  tyz: number;
  loading: LoadingSlug;
}

export interface Stress3dPreset {
  slug: LoadingSlug;
  name: string;
  state: Stress3dDemoState;
}

export const PRESETS: readonly Stress3dPreset[] = [
  {
    slug: "uniaxial-tension",
    name: "Uniaxial",
    state: {
      sx: 100,
      sy: 0,
      sz: 0,
      txy: 0,
      txz: 0,
      tyz: 0,
      loading: "uniaxial-tension",
    },
  },
  {
    slug: "pure-shear",
    name: "Pure shear",
    state: {
      sx: 0,
      sy: 0,
      sz: 0,
      txy: 80,
      txz: 0,
      tyz: 0,
      loading: "pure-shear",
    },
  },
  {
    slug: "hydrostatic",
    name: "Hydrostatic",
    state: {
      sx: 50,
      sy: 50,
      sz: 50,
      txy: 0,
      txz: 0,
      tyz: 0,
      loading: "hydrostatic",
    },
  },
  {
    slug: "triaxial-mixed",
    name: "Triaxial mixed",
    state: {
      sx: 120,
      sy: 60,
      sz: 20,
      txy: 30,
      txz: 10,
      tyz: 20,
      loading: "triaxial-mixed",
    },
  },
] as const;

export const DEFAULT_STATE: Stress3dDemoState = PRESETS[0]!.state;

export function getPreset(slug: LoadingSlug): Stress3dPreset {
  const found = PRESETS.find((p) => p.slug === slug);
  return found ?? PRESETS[0]!;
}
