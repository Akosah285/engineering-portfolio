/**
 * Named presets for the stress-strain visualiser (#90).
 *
 * Five canonical material curves taught in undergraduate mechanics:
 * mild steel, aluminium 6061, austenitic stainless 304, titanium grade 2,
 * and grey cast iron (brittle counter-example).
 */

export const MATERIAL_SLUGS = [
  "mild-steel",
  "aluminum-6061",
  "stainless-304",
  "titanium-grade2",
  "cast-iron",
] as const;

export type MaterialSlug = (typeof MATERIAL_SLUGS)[number];

export interface MaterialMeta {
  readonly label: string;
  readonly E_GPa: number;
  readonly yieldStress_MPa: number;
  readonly ultimateStress_MPa: number;
  readonly plateauEndStrain: number;
  readonly ultimateStrain: number;
  readonly failureStrain: number;
}

export const PRESET_META: Readonly<Record<MaterialSlug, MaterialMeta>> = {
  "mild-steel": {
    label: "Mild steel",
    E_GPa: 200,
    yieldStress_MPa: 250,
    ultimateStress_MPa: 400,
    plateauEndStrain: 0.02,
    ultimateStrain: 0.18,
    failureStrain: 0.25,
  },
  "aluminum-6061": {
    label: "Aluminum 6061",
    E_GPa: 69,
    yieldStress_MPa: 276,
    ultimateStress_MPa: 310,
    plateauEndStrain: 0.006,
    ultimateStrain: 0.1,
    failureStrain: 0.17,
  },
  "stainless-304": {
    label: "Stainless 304",
    E_GPa: 193,
    yieldStress_MPa: 215,
    ultimateStress_MPa: 505,
    plateauEndStrain: 0.015,
    ultimateStrain: 0.4,
    failureStrain: 0.5,
  },
  "titanium-grade2": {
    label: "Titanium Grade 2",
    E_GPa: 105,
    yieldStress_MPa: 275,
    ultimateStress_MPa: 345,
    plateauEndStrain: 0.01,
    ultimateStrain: 0.2,
    failureStrain: 0.28,
  },
  "cast-iron": {
    label: "Cast iron",
    E_GPa: 110,
    yieldStress_MPa: 200,
    ultimateStress_MPa: 200,
    plateauEndStrain: 0.005,
    ultimateStrain: 0.008,
    failureStrain: 0.012,
  },
};

export interface StressStrainDemoState {
  materialSlug: MaterialSlug;
  E_GPa: number;
  yieldStress_MPa: number;
  ultimateStress_MPa: number;
  plateauEndStrain: number;
  failureStrain: number;
}

export const DEFAULT_STATE: StressStrainDemoState = {
  materialSlug: "mild-steel",
  E_GPa: PRESET_META["mild-steel"].E_GPa,
  yieldStress_MPa: PRESET_META["mild-steel"].yieldStress_MPa,
  ultimateStress_MPa: PRESET_META["mild-steel"].ultimateStress_MPa,
  plateauEndStrain: PRESET_META["mild-steel"].plateauEndStrain,
  failureStrain: PRESET_META["mild-steel"].failureStrain,
};

export interface StressStrainPreset {
  name: string;
  state: StressStrainDemoState;
}

function presetFromSlug(slug: MaterialSlug): StressStrainPreset {
  const m = PRESET_META[slug];
  return {
    name: m.label,
    state: {
      materialSlug: slug,
      E_GPa: m.E_GPa,
      yieldStress_MPa: m.yieldStress_MPa,
      ultimateStress_MPa: m.ultimateStress_MPa,
      plateauEndStrain: m.plateauEndStrain,
      failureStrain: m.failureStrain,
    },
  };
}

export const PRESETS: readonly StressStrainPreset[] = MATERIAL_SLUGS.map(presetFromSlug);
