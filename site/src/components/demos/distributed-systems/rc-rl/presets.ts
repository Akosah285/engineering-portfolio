/**
 * Named presets for the RC/RL first-order step-response visualiser.
 *
 * Mode is a string enum keyed to the three circuits the demo can render:
 *   - "rc-charge"    — capacitor charging through R from a step source
 *   - "rc-discharge" — capacitor discharging through R from V0
 *   - "rl"           — inductor current rising in series RL with step source
 */

export const MODE_VALUES = ["rc-charge", "rc-discharge", "rl"] as const;
export type RcRlMode = (typeof MODE_VALUES)[number];

export interface RcRlDemoState {
  mode: RcRlMode;
  R: number;
  C: number;
  L: number;
  Vstep: number;
}

export interface RcRlPreset {
  name: string;
  state: RcRlDemoState;
}

export const DEFAULT_STATE: RcRlDemoState = {
  mode: "rc-charge",
  R: 100,
  C: 0.001,
  L: 0.5,
  Vstep: 5,
};

export const PRESET_SLUGS = [
  "fast-rc-charge",
  "slow-rc-discharge",
  "rl-step-response",
  "high-r-slow",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "fast-rc-charge": { name: "Fast RC charge" },
  "slow-rc-discharge": { name: "Slow RC discharge" },
  "rl-step-response": { name: "RL step response" },
  "high-r-slow": { name: "High-R slow" },
};

export const PRESETS: readonly RcRlPreset[] = [
  {
    name: PRESET_META["fast-rc-charge"].name,
    state: { mode: "rc-charge", R: 50, C: 0.0001, L: 0.5, Vstep: 5 },
  },
  {
    name: PRESET_META["slow-rc-discharge"].name,
    state: { mode: "rc-discharge", R: 500, C: 0.005, L: 0.5, Vstep: 12 },
  },
  {
    name: PRESET_META["rl-step-response"].name,
    state: { mode: "rl", R: 100, C: 0.001, L: 1.0, Vstep: 12 },
  },
  {
    name: PRESET_META["high-r-slow"].name,
    state: { mode: "rc-charge", R: 1000, C: 0.001, L: 0.5, Vstep: 24 },
  },
] as const;
