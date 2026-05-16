/**
 * Named presets for the wave-equation visualiser.
 *
 * Each preset is a snapshot of share-relevant state (wave speed, timestep,
 * grid resolution, mode number) so a viewer can jump between scenarios via
 * <PresetCarousel> with the URL fragment kept in sync by <useDemoState>.
 */

export interface WaveEquationDemoState {
  c: number;
  dt: number;
  nGrid: number;
  mode: number;
}

export interface WaveEquationPreset {
  name: string;
  narration: string;
  state: WaveEquationDemoState;
}

export const DEFAULT_STATE: WaveEquationDemoState = {
  c: 1.0,
  dt: 0.005,
  nGrid: 80,
  mode: 1,
};

export const PRESET_SLUGS = [
  "fundamental",
  "second-harmonic",
  "fast-string",
  "high-resolution",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<
  PresetSlug,
  { label: string; narration: string; state: WaveEquationDemoState }
> = {
  fundamental: {
    label: "Fundamental (mode 1)",
    narration:
      "The lowest standing wave on a 1 m string with c = 1.0 m/s — a single half-sine oscillating about the rest line.",
    state: { c: 1.0, dt: 0.005, nGrid: 80, mode: 1 },
  },
  "second-harmonic": {
    label: "Second harmonic (mode 2)",
    narration:
      "Mode 2 standing wave: a full sine with a node at the midpoint of the string.",
    state: { c: 1.0, dt: 0.005, nGrid: 100, mode: 2 },
  },
  "fast-string": {
    label: "Fast string (c = 2.5)",
    narration:
      "Higher wave speed shrinks the stable timestep — watch the CFL ratio climb toward 1.",
    state: { c: 2.5, dt: 0.004, nGrid: 120, mode: 1 },
  },
  "high-resolution": {
    label: "High resolution (200 pts)",
    narration:
      "200 grid points resolve the third harmonic crisply, but demand a smaller dt for CFL stability.",
    state: { c: 1.0, dt: 0.002, nGrid: 200, mode: 3 },
  },
};

export const PRESETS: readonly WaveEquationPreset[] = PRESET_SLUGS.map((slug) => {
  const meta = PRESET_META[slug];
  return { name: meta.label, narration: meta.narration, state: meta.state };
});
