/**
 * Named presets for the Monte Carlo π visualiser (#74).
 *
 * Each preset is a snapshot of all share-relevant state so the
 * <PresetCarousel> can jump between them and <useDemoState> keeps
 * the URL fragment in sync.
 */

export interface MonteCarloDemoState {
  seed: number;
  targetSamples: number;
  speed: number;
}

export interface MonteCarloPreset {
  name: string;
  state: MonteCarloDemoState;
}

export const DEFAULT_STATE: MonteCarloDemoState = {
  seed: 42,
  targetSamples: 10000,
  speed: 100,
};

export const PRESETS: readonly MonteCarloPreset[] = [
  {
    name: "Slow & visible",
    state: { seed: 1, targetSamples: 2000, speed: 10 },
  },
  {
    name: "Standard",
    state: { seed: 42, targetSamples: 10000, speed: 100 },
  },
  {
    name: "Many samples",
    state: { seed: 7, targetSamples: 50000, speed: 500 },
  },
  {
    name: "Noisy small sample",
    state: { seed: 12345, targetSamples: 1000, speed: 20 },
  },
] as const;
