/**
 * Named presets for the markov-chain visualiser (#66).
 *
 * Only share-relevant state ({@link MarkovDemoState}) goes into the URL
 * fragment; the transition matrices themselves are looked up at runtime
 * via {@link getChain}. Keeps fragments short and ensures only verified
 * row-stochastic matrices are reachable from URL state.
 */

import { type Matrix, isStochastic } from "./algorithm";

export const CHAIN_SLUGS = [
  "weather",
  "rock-paper-scissors",
  "ring-5",
  "absorbing-3",
] as const;
export type ChainSlug = (typeof CHAIN_SLUGS)[number];

export const INITIAL_STATE_SLUGS = [
  "uniform",
  "state-0",
  "state-1",
  "state-2",
  "state-3",
] as const;
export type InitialStateSlug = (typeof INITIAL_STATE_SLUGS)[number];

export interface MarkovChain {
  slug: ChainSlug;
  name: string;
  P: Matrix;
  stateLabels: readonly string[];
}

export interface MarkovDemoState {
  chainSlug: ChainSlug;
  initialStateSlug: InitialStateSlug;
  stepDelay: number;
}

export const DEFAULT_STATE: MarkovDemoState = {
  chainSlug: "weather",
  initialStateSlug: "state-0",
  stepDelay: 600,
};

const CHAINS: readonly MarkovChain[] = [
  {
    slug: "weather",
    name: "Weather (sun/rain)",
    P: [
      [0.8, 0.2],
      [0.3, 0.7],
    ],
    stateLabels: ["Sun", "Rain"],
  },
  {
    slug: "rock-paper-scissors",
    name: "Rock-Paper-Scissors player",
    // A biased mixing matrix: tends to follow rock→paper→scissors→rock
    // but stays put with non-trivial probability.
    P: [
      [0.2, 0.6, 0.2],
      [0.2, 0.2, 0.6],
      [0.6, 0.2, 0.2],
    ],
    stateLabels: ["Rock", "Paper", "Scissors"],
  },
  {
    slug: "ring-5",
    name: "Random walk on 5-node ring",
    // Built below by ringMatrix(5); kept inline for an explicit, auditable
    // row-stochastic table.
    P: [
      [0, 0.5, 0, 0, 0.5],
      [0.5, 0, 0.5, 0, 0],
      [0, 0.5, 0, 0.5, 0],
      [0, 0, 0.5, 0, 0.5],
      [0.5, 0, 0, 0.5, 0],
    ],
    stateLabels: ["S0", "S1", "S2", "S3", "S4"],
  },
  {
    slug: "absorbing-3",
    name: "Absorbing chain (3 states)",
    P: [
      [0.4, 0.5, 0.1],
      [0.2, 0.6, 0.2],
      [0, 0, 1],
    ],
    stateLabels: ["A", "B", "Sink"],
  },
] as const;

// Defensive: assert every preset matrix is row-stochastic at module load.
// Catches typos at the first import rather than mid-render.
for (const chain of CHAINS) {
  if (!isStochastic(chain.P)) {
    throw new Error(`markov-chain preset "${chain.slug}" is not row-stochastic`);
  }
}

export const PRESET_CHAINS: readonly MarkovChain[] = CHAINS;

export function getChain(slug: ChainSlug): MarkovChain {
  const found = CHAINS.find((c) => c.slug === slug);
  if (!found) {
    // Should be unreachable thanks to the enum, but keep a sane fallback.
    return CHAINS[0]!;
  }
  return found;
}

/**
 * Resolve an initial distribution for the given chain. If the requested
 * "state-k" index is out of range for this chain, silently falls back
 * to the uniform distribution.
 */
export function resolveInitialDistribution(
  chain: MarkovChain,
  slug: InitialStateSlug,
): number[] {
  const n = chain.P.length;
  if (slug === "uniform") {
    return new Array<number>(n).fill(1 / n);
  }
  const idx = Number(slug.slice("state-".length));
  if (!Number.isInteger(idx) || idx < 0 || idx >= n) {
    return new Array<number>(n).fill(1 / n);
  }
  const v = new Array<number>(n).fill(0);
  v[idx] = 1;
  return v;
}

export interface MarkovPreset {
  name: string;
  state: MarkovDemoState;
}

export const PRESETS: readonly MarkovPreset[] = CHAINS.map((c) => ({
  name: c.name,
  state: {
    chainSlug: c.slug,
    initialStateSlug: "state-0" as InitialStateSlug,
    stepDelay: DEFAULT_STATE.stepDelay,
  },
}));
