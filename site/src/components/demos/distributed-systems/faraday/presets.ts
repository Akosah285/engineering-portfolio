/**
 * Named presets for the Faraday's-law visualiser.
 *
 * Each preset is a snapshot of share-relevant state so consumers can jump
 * via <PresetCarousel> and have the URL fragment stay in sync via
 * <useDemoState>.
 */

export interface FaradayDemoState {
  /** Number of turns in the coil. */
  N: number;
  /** Uniform magnetic-field strength (T). */
  B: number;
  /** Loop area (m²). */
  A: number;
  /** Angular frequency of rotation (rad/s). */
  omega: number;
}

export interface FaradayPreset {
  name: string;
  slug: (typeof PRESET_SLUGS)[number];
  state: FaradayDemoState;
}

export const PRESET_SLUGS = [
  "single-turn-baseline",
  "high-turn-generator",
  "weak-field",
  "fast-spin",
] as const;

export const DEFAULT_STATE: FaradayDemoState = {
  N: 1,
  B: 0.5,
  A: 0.05,
  omega: 60,
};

export const PRESET_META: Record<
  (typeof PRESET_SLUGS)[number],
  { name: string; description: string }
> = {
  "single-turn-baseline": {
    name: "Single-turn baseline",
    description: "One loop, modest field, 60 rad/s.",
  },
  "high-turn-generator": {
    name: "High-turn generator",
    description: "300 turns to crank up the peak EMF.",
  },
  "weak-field": {
    name: "Weak field",
    description: "Earth-scale 50 µT field with a big loop.",
  },
  "fast-spin": {
    name: "Fast spin",
    description: "Push ω toward 200 rad/s to shrink the period.",
  },
};

export const PRESETS: readonly FaradayPreset[] = [
  {
    slug: "single-turn-baseline",
    name: PRESET_META["single-turn-baseline"].name,
    state: { N: 1, B: 0.5, A: 0.05, omega: 60 },
  },
  {
    slug: "high-turn-generator",
    name: PRESET_META["high-turn-generator"].name,
    state: { N: 300, B: 1.0, A: 0.05, omega: 120 },
  },
  {
    slug: "weak-field",
    name: PRESET_META["weak-field"].name,
    state: { N: 50, B: 0.05, A: 0.2, omega: 30 },
  },
  {
    slug: "fast-spin",
    name: PRESET_META["fast-spin"].name,
    state: { N: 10, B: 0.5, A: 0.05, omega: 200 },
  },
] as const;
