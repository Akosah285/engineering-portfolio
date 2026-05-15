import type { Preset } from "../../../demo-kit/PresetCarousel";

export interface PolyRegressionState {
  degree: number;
  lambda: number;
  regularization: "none" | "ridge" | "lasso";
  noise: number;
  seed: number;
  n: number;
}

export const DEFAULT_STATE: PolyRegressionState = {
  degree: 4,
  lambda: 0,
  regularization: "none",
  noise: 0.2,
  seed: 7,
  n: 50,
};

export const SAMPLE_PRESETS: ReadonlyArray<Preset<PolyRegressionState>> = [
  {
    name: "Underfit (degree 1)",
    state: {
      degree: 1,
      lambda: 0,
      regularization: "none",
      noise: 0.2,
      seed: 7,
      n: 50,
    },
  },
  {
    name: "Good fit (degree 4)",
    state: {
      degree: 4,
      lambda: 0,
      regularization: "none",
      noise: 0.2,
      seed: 7,
      n: 50,
    },
  },
  {
    name: "Overfit (degree 12)",
    state: {
      degree: 12,
      lambda: 0,
      regularization: "none",
      noise: 0.2,
      seed: 7,
      n: 50,
    },
  },
  {
    name: "Ridge tames overfit",
    state: {
      degree: 12,
      lambda: 0.5,
      regularization: "ridge",
      noise: 0.2,
      seed: 7,
      n: 50,
    },
  },
  {
    name: "Lasso sparsity",
    state: {
      degree: 8,
      lambda: 0.4,
      regularization: "lasso",
      noise: 0.2,
      seed: 7,
      n: 50,
    },
  },
  {
    name: "Tiny noisy sample",
    state: {
      degree: 6,
      lambda: 0,
      regularization: "none",
      noise: 0.4,
      seed: 11,
      n: 15,
    },
  },
] as const;
