/**
 * Named presets for the Bayes theorem visualizer (#68).
 *
 * Each preset is a snapshot of all share-relevant state so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via useDemoState. The populationSize is stored as a string to
 * play well with the enum field type in useDemoState.
 */

export const POPULATION_SIZES = ["100", "1000", "10000"] as const;
export type PopulationSize = (typeof POPULATION_SIZES)[number];

export interface BayesDemoState {
  prior: number;
  sensitivity: number;
  specificity: number;
  populationSize: PopulationSize;
}

export interface BayesPreset {
  name: string;
  state: BayesDemoState;
}

export const DEFAULT_STATE: BayesDemoState = {
  prior: 0.001,
  sensitivity: 0.99,
  specificity: 0.99,
  populationSize: "10000",
};

export const PRESETS: readonly BayesPreset[] = [
  {
    name: "Rare disease (99% test)",
    state: {
      prior: 0.001,
      sensitivity: 0.99,
      specificity: 0.99,
      populationSize: "10000",
    },
  },
  {
    name: "Common (1% prior)",
    state: {
      prior: 0.01,
      sensitivity: 0.95,
      specificity: 0.95,
      populationSize: "10000",
    },
  },
  {
    name: "COVID-like (5% prior)",
    state: {
      prior: 0.05,
      sensitivity: 0.85,
      specificity: 0.97,
      populationSize: "10000",
    },
  },
  {
    name: "Strong test, moderate prior",
    state: {
      prior: 0.2,
      sensitivity: 0.99,
      specificity: 0.99,
      populationSize: "1000",
    },
  },
] as const;
