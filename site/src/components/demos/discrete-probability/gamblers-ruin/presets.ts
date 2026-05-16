/**
 * Named presets for the Gambler's Ruin visualiser.
 *
 * Each preset captures all share-relevant state so consumers can jump
 * to any scenario via <PresetCarousel> and the URL fragment stays in
 * sync via <useDemoState>.
 */

export interface GamblersRuinDemoState {
  N: number;
  k: number;
  p: number;
  numWalks: number;
  seed: number;
}

export interface GamblersRuinPreset {
  name: string;
  state: GamblersRuinDemoState;
}

export const DEFAULT_STATE: GamblersRuinDemoState = {
  N: 50,
  k: 25,
  p: 0.5,
  numWalks: 50,
  seed: 42,
};

export const PRESETS: readonly GamblersRuinPreset[] = [
  {
    name: "Fair coin (50/50)",
    state: { N: 50, k: 25, p: 0.5, numWalks: 50, seed: 42 },
  },
  {
    name: "Slight house edge (49% win)",
    state: { N: 100, k: 50, p: 0.49, numWalks: 100, seed: 7 },
  },
  {
    name: "Lucky player (52% win)",
    state: { N: 50, k: 25, p: 0.52, numWalks: 50, seed: 1 },
  },
  {
    name: "Long climb from low",
    state: { N: 80, k: 10, p: 0.5, numWalks: 100, seed: 2024 },
  },
] as const;
