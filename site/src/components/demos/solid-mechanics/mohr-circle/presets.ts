/**
 * Named presets + shared state shape for the Mohr's Circle visualiser (#89).
 *
 * Each preset captures a stress state (σx, σy, τxy) plus the slug used by
 * <useDemoState> to round-trip via the URL fragment.
 */

export const PRESET_SLUGS = [
  "uniaxial-tension",
  "pure-shear",
  "biaxial-tension",
  "compression",
  "general",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface MohrDemoState {
  presetSlug: PresetSlug;
  sigmaX: number;
  sigmaY: number;
  tauXY: number;
}

export interface PresetMeta {
  name: string;
  sigmaX: number;
  sigmaY: number;
  tauXY: number;
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  "uniaxial-tension": { name: "Uniaxial tension", sigmaX: 100, sigmaY: 0, tauXY: 0 },
  "pure-shear": { name: "Pure shear", sigmaX: 0, sigmaY: 0, tauXY: 50 },
  "biaxial-tension": { name: "Biaxial tension", sigmaX: 100, sigmaY: 50, tauXY: 0 },
  compression: { name: "Compression", sigmaX: -80, sigmaY: 0, tauXY: 0 },
  general: { name: "General", sigmaX: 80, sigmaY: 30, tauXY: 40 },
};

export const DEFAULT_STATE: MohrDemoState = {
  presetSlug: "uniaxial-tension",
  sigmaX: PRESET_META["uniaxial-tension"].sigmaX,
  sigmaY: PRESET_META["uniaxial-tension"].sigmaY,
  tauXY: PRESET_META["uniaxial-tension"].tauXY,
};

export interface MohrPreset {
  name: string;
  state: MohrDemoState;
}

export const PRESETS: readonly MohrPreset[] = PRESET_SLUGS.map((slug) => {
  const meta = PRESET_META[slug];
  return {
    name: meta.name,
    state: {
      presetSlug: slug,
      sigmaX: meta.sigmaX,
      sigmaY: meta.sigmaY,
      tauXY: meta.tauXY,
    },
  };
});
