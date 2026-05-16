/**
 * Named presets for the combinatorics visualiser (#73).
 */

export const SCENARIO_SLUGS = [
  "lottery",
  "poker-hand",
  "binary-string",
  "small-team",
  "tiny",
] as const;

export type ScenarioSlug = (typeof SCENARIO_SLUGS)[number];

export interface CombinatoricsDemoState {
  scenarioSlug: ScenarioSlug;
  n: number;
  k: number;
}

export interface CombinatoricsPreset {
  name: string;
  label: string;
  state: CombinatoricsDemoState;
}

export const DEFAULT_STATE: CombinatoricsDemoState = {
  scenarioSlug: "lottery",
  n: 6,
  k: 2,
};

export const PRESETS: readonly CombinatoricsPreset[] = [
  {
    name: "Lottery",
    label: "Pick 6 of 20",
    state: { scenarioSlug: "lottery", n: 20, k: 6 },
  },
  {
    name: "Poker hand",
    label: "Hands of 5 from 13",
    state: { scenarioSlug: "poker-hand", n: 13, k: 5 },
  },
  {
    name: "Binary string",
    label: "5 ones in 10 bits",
    state: { scenarioSlug: "binary-string", n: 10, k: 5 },
  },
  {
    name: "Small team",
    label: "3-person team from 6",
    state: { scenarioSlug: "small-team", n: 6, k: 3 },
  },
  {
    name: "Tiny",
    label: "2 of 4",
    state: { scenarioSlug: "tiny", n: 4, k: 2 },
  },
] as const;

export function getPresetLabel(slug: ScenarioSlug): string {
  const preset = PRESETS.find((p) => p.state.scenarioSlug === slug);
  return preset?.label ?? "";
}
