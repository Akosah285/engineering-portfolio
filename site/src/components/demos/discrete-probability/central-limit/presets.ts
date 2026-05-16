/**
 * Named presets for the Central Limit Theorem visualiser (#69).
 *
 * Each preset is a snapshot of all share-relevant state (distribution
 * slug + sample-size + nSamples + seed) so consumers can jump to any
 * preset via <PresetCarousel> and the URL fragment stays in sync via
 * <useDemoState>.
 */

import type { Distribution } from "./algorithm";

export type DistSlug = "uniform" | "exponential" | "bernoulli";

export const DIST_SLUGS = ["uniform", "exponential", "bernoulli"] as const;

/**
 * Concrete Distribution objects keyed by their slug. We deliberately
 * keep the full {@link Distribution} record out of useDemoState — only
 * the slug travels via URL — and resolve to the parameterised object
 * here at render time.
 */
export const DISTRIBUTIONS: Record<DistSlug, Distribution> = {
  uniform: { kind: "uniform", a: 0, b: 1 },
  exponential: { kind: "exponential", lambda: 1 },
  bernoulli: { kind: "bernoulli", p: 0.3 },
};

export const DIST_LABELS: Record<DistSlug, string> = {
  uniform: "Uniform(0, 1)",
  exponential: "Exponential(λ=1)",
  bernoulli: "Bernoulli(0.3)",
};

export interface CltDemoState {
  distSlug: DistSlug;
  n: number;
  nSamples: number;
  seed: number;
}

export interface CltPreset {
  name: string;
  state: CltDemoState;
}

export const DEFAULT_STATE: CltDemoState = {
  distSlug: "uniform",
  n: 30,
  nSamples: 2000,
  seed: 42,
};

export const PRESETS: readonly CltPreset[] = [
  {
    name: "Uniform(0,1) - n=1 (still uniform)",
    state: { distSlug: "uniform", n: 1, nSamples: 1000, seed: 42 },
  },
  {
    name: "Uniform(0,1) - n=30 (bell)",
    state: { distSlug: "uniform", n: 30, nSamples: 2000, seed: 42 },
  },
  {
    name: "Exponential(λ=1) - n=30",
    state: { distSlug: "exponential", n: 30, nSamples: 2000, seed: 7 },
  },
  {
    name: "Bernoulli(0.3) - n=50",
    state: { distSlug: "bernoulli", n: 50, nSamples: 2000, seed: 1 },
  },
] as const;
