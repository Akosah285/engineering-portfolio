/**
 * Named signal-pair presets for the convolution visualiser.
 *
 * Each pair is identified by a slug and exposes a `build(nSamples)`
 * function that materialises both signals at the requested resolution.
 * Signal arrays are NEVER stored in shareable state; we keep just the
 * slug + nSamples in the URL fragment and rebuild on demand.
 */

import { type Sample, expDecay, rect } from "./algorithm";

export type PairSlug = "rect-rect" | "rect-exp" | "exp-exp" | "wide-narrow";

export const PAIR_SLUGS: readonly PairSlug[] = [
  "rect-rect",
  "rect-exp",
  "exp-exp",
  "wide-narrow",
] as const;

export interface PairSignals {
  readonly f: readonly Sample[];
  readonly g: readonly Sample[];
  readonly tMin: number;
  readonly tMax: number;
  readonly dt: number;
}

export interface PairDefinition {
  readonly slug: PairSlug;
  readonly name: string;
  readonly tMin: number;
  readonly tMax: number;
  build(nSamples: number): PairSignals;
}

function dtFor(tMin: number, tMax: number, n: number): number {
  return (tMax - tMin) / (n - 1);
}

export const PAIRS: Readonly<Record<PairSlug, PairDefinition>> = {
  "rect-rect": {
    slug: "rect-rect",
    name: "Rect ⋆ Rect (triangle)",
    tMin: -3,
    tMax: 3,
    build(n) {
      const tMin = -3;
      const tMax = 3;
      return {
        f: rect({ width: 2, height: 1, nSamples: n, tMin, tMax, center: 0 }),
        g: rect({ width: 2, height: 1, nSamples: n, tMin, tMax, center: 0 }),
        tMin,
        tMax,
        dt: dtFor(tMin, tMax, n),
      };
    },
  },
  "rect-exp": {
    slug: "rect-exp",
    name: "Rect ⋆ ExpDecay",
    tMin: -2,
    tMax: 6,
    build(n) {
      const tMin = -2;
      const tMax = 6;
      return {
        f: rect({ width: 2, height: 1, nSamples: n, tMin, tMax, center: 0 }),
        g: expDecay({ tau: 1, nSamples: n, tMin, tMax }),
        tMin,
        tMax,
        dt: dtFor(tMin, tMax, n),
      };
    },
  },
  "exp-exp": {
    slug: "exp-exp",
    name: "ExpDecay ⋆ ExpDecay",
    tMin: -1,
    tMax: 6,
    build(n) {
      const tMin = -1;
      const tMax = 6;
      return {
        f: expDecay({ tau: 0.5, nSamples: n, tMin, tMax }),
        g: expDecay({ tau: 0.5, nSamples: n, tMin, tMax }),
        tMin,
        tMax,
        dt: dtFor(tMin, tMax, n),
      };
    },
  },
  "wide-narrow": {
    slug: "wide-narrow",
    name: "Wide Rect ⋆ Narrow Rect",
    tMin: -4,
    tMax: 4,
    build(n) {
      const tMin = -4;
      const tMax = 4;
      return {
        f: rect({ width: 4, height: 1, nSamples: n, tMin, tMax, center: 0 }),
        g: rect({ width: 1, height: 1, nSamples: n, tMin, tMax, center: 0 }),
        tMin,
        tMax,
        dt: dtFor(tMin, tMax, n),
      };
    },
  },
};

export function getPair(slug: PairSlug): PairDefinition {
  return PAIRS[slug];
}

export interface ConvolutionDemoState {
  pairSlug: PairSlug;
  nSamples: number;
  slideSpeed: number;
}

export const DEFAULT_STATE: ConvolutionDemoState = {
  pairSlug: "rect-rect",
  nSamples: 120,
  slideSpeed: 10,
};

export interface ConvolutionPreset {
  name: string;
  state: ConvolutionDemoState;
}

export const PRESETS: readonly ConvolutionPreset[] = [
  {
    name: "Rect ⋆ Rect (triangle)",
    state: { pairSlug: "rect-rect", nSamples: 120, slideSpeed: 10 },
  },
  {
    name: "Rect ⋆ ExpDecay",
    state: { pairSlug: "rect-exp", nSamples: 160, slideSpeed: 12 },
  },
  {
    name: "ExpDecay ⋆ ExpDecay",
    state: { pairSlug: "exp-exp", nSamples: 160, slideSpeed: 12 },
  },
  {
    name: "Wide Rect ⋆ Narrow Rect",
    state: { pairSlug: "wide-narrow", nSamples: 140, slideSpeed: 10 },
  },
] as const;
