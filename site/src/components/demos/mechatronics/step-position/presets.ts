/**
 * Named presets for the step-position visualiser.
 */

export const PRESET_SLUGS = [
  "short-move-constant",
  "long-move-trapezoidal",
  "reverse-direction",
  "high-accel-quick",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const USE_TRAPEZOIDAL_VALUES = ["on", "off"] as const;
export type UseTrapezoidal = (typeof USE_TRAPEZOIDAL_VALUES)[number];

export interface StepPositionDemoState {
  currentTicks: number;
  targetTicks: number;
  maxStepsPerSec: number;
  accel: number;
  useTrapezoidal: UseTrapezoidal;
}

export interface StepPositionPreset {
  slug: PresetSlug;
  name: string;
  state: StepPositionDemoState;
}

export const DEFAULT_STATE: StepPositionDemoState = {
  currentTicks: 0,
  targetTicks: 40,
  maxStepsPerSec: 200,
  accel: 800,
  useTrapezoidal: "on",
};

export const PRESET_META: Record<PresetSlug, string> = {
  "short-move-constant": "Short move (constant)",
  "long-move-trapezoidal": "Long move (trapezoidal)",
  "reverse-direction": "Reverse direction",
  "high-accel-quick": "High accel quick",
};

export const PRESETS: readonly StepPositionPreset[] = [
  {
    slug: "short-move-constant",
    name: PRESET_META["short-move-constant"],
    state: {
      currentTicks: 0,
      targetTicks: 15,
      maxStepsPerSec: 100,
      accel: 500,
      useTrapezoidal: "off",
    },
  },
  {
    slug: "long-move-trapezoidal",
    name: PRESET_META["long-move-trapezoidal"],
    state: {
      currentTicks: -50,
      targetTicks: 80,
      maxStepsPerSec: 250,
      accel: 600,
      useTrapezoidal: "on",
    },
  },
  {
    slug: "reverse-direction",
    name: PRESET_META["reverse-direction"],
    state: {
      currentTicks: 60,
      targetTicks: -40,
      maxStepsPerSec: 200,
      accel: 700,
      useTrapezoidal: "on",
    },
  },
  {
    slug: "high-accel-quick",
    name: PRESET_META["high-accel-quick"],
    state: {
      currentTicks: 0,
      targetTicks: 50,
      maxStepsPerSec: 400,
      accel: 1800,
      useTrapezoidal: "on",
    },
  },
] as const;
