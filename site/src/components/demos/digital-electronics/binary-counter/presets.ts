/**
 * Named presets for the binary-counter visualiser (#118).
 *
 * Each preset is a snapshot of all share-relevant state, so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via useDemoState.
 */

export type Direction = "up" | "down";

export interface BinaryCounterDemoState {
  bits: number;
  nTicks: number;
  initial: number;
  direction: Direction;
}

export interface BinaryCounterPreset {
  name: string;
  state: BinaryCounterDemoState;
}

export const PRESET_SLUGS = ["4-bit-up", "4-bit-down", "8-bit-up", "load-1010"] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const DEFAULT_STATE: BinaryCounterDemoState = {
  bits: 4,
  nTicks: 16,
  initial: 0,
  direction: "up",
};

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "4-bit-up": { name: "4-bit up" },
  "4-bit-down": { name: "4-bit down" },
  "8-bit-up": { name: "8-bit up" },
  "load-1010": { name: "Load 1010" },
};

export const PRESETS: readonly BinaryCounterPreset[] = [
  {
    name: PRESET_META["4-bit-up"].name,
    state: { bits: 4, nTicks: 16, initial: 0, direction: "up" },
  },
  {
    name: PRESET_META["4-bit-down"].name,
    state: { bits: 4, nTicks: 16, initial: 0, direction: "down" },
  },
  {
    name: PRESET_META["8-bit-up"].name,
    state: { bits: 8, nTicks: 64, initial: 0, direction: "up" },
  },
  {
    name: PRESET_META["load-1010"].name,
    state: { bits: 4, nTicks: 16, initial: 0b1010, direction: "up" },
  },
] as const;
