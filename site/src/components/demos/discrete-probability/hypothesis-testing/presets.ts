/**
 * Named presets for the hypothesis-testing visualiser.
 */

import type { Alternative } from "./algorithm";

export type ScenarioSlug =
  | "weak-effect"
  | "strong-effect"
  | "no-effect"
  | "borderline"
  | "tiny-sample";

export type AlphaSlug = "0.01" | "0.05" | "0.10";

export const SCENARIO_SLUGS = [
  "weak-effect",
  "strong-effect",
  "no-effect",
  "borderline",
  "tiny-sample",
] as const satisfies readonly ScenarioSlug[];

export const ALTERNATIVE_SLUGS = [
  "two-sided",
  "greater",
  "less",
] as const satisfies readonly Alternative[];

export const ALPHA_SLUGS = ["0.01", "0.05", "0.10"] as const satisfies readonly AlphaSlug[];

export interface HypothesisDemoState {
  scenarioSlug: ScenarioSlug;
  alternative: Alternative;
  alpha: AlphaSlug;
  xbar: number;
  mu0: number;
  sigma: number;
  n: number;
}

export interface HypothesisPreset {
  name: string;
  state: HypothesisDemoState;
}

export const DEFAULT_STATE: HypothesisDemoState = {
  scenarioSlug: "weak-effect",
  alternative: "two-sided",
  alpha: "0.05",
  xbar: 0.3,
  mu0: 0,
  sigma: 1,
  n: 30,
};

export const PRESETS: readonly HypothesisPreset[] = [
  {
    name: "Weak effect",
    state: {
      scenarioSlug: "weak-effect",
      alternative: "two-sided",
      alpha: "0.05",
      xbar: 0.3,
      mu0: 0,
      sigma: 1,
      n: 30,
    },
  },
  {
    name: "Strong effect",
    state: {
      scenarioSlug: "strong-effect",
      alternative: "two-sided",
      alpha: "0.05",
      xbar: 1.5,
      mu0: 0,
      sigma: 1,
      n: 30,
    },
  },
  {
    name: "No effect",
    state: {
      scenarioSlug: "no-effect",
      alternative: "two-sided",
      alpha: "0.05",
      xbar: 0,
      mu0: 0,
      sigma: 1,
      n: 30,
    },
  },
  {
    name: "Borderline",
    state: {
      scenarioSlug: "borderline",
      alternative: "two-sided",
      alpha: "0.05",
      xbar: 0.36,
      mu0: 0,
      sigma: 1,
      n: 30,
    },
  },
  {
    name: "Tiny sample",
    state: {
      scenarioSlug: "tiny-sample",
      alternative: "two-sided",
      alpha: "0.05",
      xbar: 1.0,
      mu0: 0,
      sigma: 1,
      n: 4,
    },
  },
] as const;

/** Critical |z| thresholds keyed by alpha and alternative. */
export const CRITICAL_Z: Record<AlphaSlug, { twoSided: number; oneSided: number }> = {
  "0.10": { twoSided: 1.645, oneSided: 1.282 },
  "0.05": { twoSided: 1.96, oneSided: 1.645 },
  "0.01": { twoSided: 2.576, oneSided: 2.326 },
};
