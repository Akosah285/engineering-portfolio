import type { DMInput } from "./algorithm";

/**
 * Named presets for the state-machine visualiser.
 *
 * Each preset names a sensor-input sequence to feed the robot FSM and a
 * human-readable label. The visualiser state itself only carries the
 * preset slug + animation step delay; the actual input array lives here
 * in PRESET_META because `useDemoState` can't hold arrays.
 */

export const PRESET_SLUGS = [
  "find-wall-then-follow",
  "wall-lost",
  "intersection-detour",
  "goal-from-start",
  "complex-maze",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface StateMachinePresetMeta {
  slug: PresetSlug;
  label: string;
  inputs: readonly DMInput[];
}

export const PRESET_META: Record<PresetSlug, StateMachinePresetMeta> = {
  "find-wall-then-follow": {
    slug: "find-wall-then-follow",
    label: "Find wall, then follow",
    inputs: ["tick", "tick", "wall_detected_left", "tick", "tick", "tick"],
  },
  "wall-lost": {
    slug: "wall-lost",
    label: "Wall lost",
    inputs: ["wall_detected_left", "tick", "wall_lost_left", "tick", "tick", "tick"],
  },
  "intersection-detour": {
    slug: "intersection-detour",
    label: "Intersection detour",
    inputs: [
      "wall_detected_left",
      "tick",
      "wall_detected_front",
      "tick",
      "intersection",
      "tick",
      "tick",
    ],
  },
  "goal-from-start": {
    slug: "goal-from-start",
    label: "Goal from start",
    inputs: ["tick", "tick", "goal_reached"],
  },
  "complex-maze": {
    slug: "complex-maze",
    label: "Complex maze",
    inputs: [
      "tick",
      "wall_detected_left",
      "tick",
      "tick",
      "wall_detected_front",
      "tick",
      "intersection",
      "tick",
      "wall_detected_left",
      "tick",
      "goal_reached",
    ],
  },
};

export interface StateMachineDemoState {
  presetSlug: PresetSlug;
  stepDelay: number;
}

export const DEFAULT_STATE: StateMachineDemoState = {
  presetSlug: "find-wall-then-follow",
  stepDelay: 600,
};

export interface StateMachinePreset {
  name: string;
  state: StateMachineDemoState;
}

export const PRESETS: readonly StateMachinePreset[] = PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].label,
  state: { presetSlug: slug, stepDelay: DEFAULT_STATE.stepDelay },
}));
