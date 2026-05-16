/**
 * Named initial-condition presets for the 1D heat-equation visualiser.
 */

export type HeatPresetSlug =
  | "sine-mode-1"
  | "sine-mode-3"
  | "gaussian-bump"
  | "two-peaks"
  | "step";

export const HEAT_PRESET_SLUGS = [
  "sine-mode-1",
  "sine-mode-3",
  "gaussian-bump",
  "two-peaks",
  "step",
] as const satisfies readonly HeatPresetSlug[];

export interface HeatDemoState {
  presetSlug: HeatPresetSlug;
  alpha: number;
  dt: number;
  nGrid: number;
}

export interface HeatPresetMeta {
  slug: HeatPresetSlug;
  name: string;
  /** Whether the analytical single-mode overlay applies to this preset. */
  analyticalMode: number | null;
  initialFn: (L: number, nGrid: number) => number[];
}

export const DEFAULT_STATE: HeatDemoState = {
  presetSlug: "sine-mode-1",
  alpha: 0.1,
  dt: 0.001,
  nGrid: 50,
};

function sampleX(L: number, nGrid: number, f: (x: number) => number): number[] {
  const out = new Array<number>(nGrid);
  for (let i = 0; i < nGrid; i += 1) {
    const x = (i / (nGrid - 1)) * L;
    out[i] = f(x);
  }
  // Enforce Dirichlet BCs.
  out[0] = 0;
  out[nGrid - 1] = 0;
  return out;
}

export const PRESET_META: Record<HeatPresetSlug, HeatPresetMeta> = {
  "sine-mode-1": {
    slug: "sine-mode-1",
    name: "Sine mode 1",
    analyticalMode: 1,
    initialFn: (L, n) => sampleX(L, n, (x) => Math.sin((Math.PI * x) / L)),
  },
  "sine-mode-3": {
    slug: "sine-mode-3",
    name: "Sine mode 3",
    analyticalMode: 3,
    initialFn: (L, n) => sampleX(L, n, (x) => Math.sin((3 * Math.PI * x) / L)),
  },
  "gaussian-bump": {
    slug: "gaussian-bump",
    name: "Gaussian bump",
    analyticalMode: null,
    initialFn: (L, n) =>
      sampleX(L, n, (x) => {
        const z = (x - L / 2) / 0.1;
        return Math.exp(-(z * z));
      }),
  },
  "two-peaks": {
    slug: "two-peaks",
    name: "Two peaks",
    analyticalMode: null,
    initialFn: (L, n) =>
      sampleX(L, n, (x) => Math.sin((Math.PI * x) / L) + 0.5 * Math.sin((2 * Math.PI * x) / L)),
  },
  step: {
    slug: "step",
    name: "Step",
    analyticalMode: null,
    initialFn: (L, n) => sampleX(L, n, (x) => (x >= L / 3 && x <= (2 * L) / 3 ? 1 : 0)),
  },
};

export interface HeatPreset {
  name: string;
  state: HeatDemoState;
}

export const PRESETS: readonly HeatPreset[] = HEAT_PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].name,
  state: { ...DEFAULT_STATE, presetSlug: slug },
}));
