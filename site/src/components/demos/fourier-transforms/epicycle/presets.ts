/**
 * Named parametric path presets for the epicycle visualiser.
 *
 * Each preset describes a closed planar curve f: [0,1) → ℂ that the
 * <EpicycleVisualizer> samples via samplePath() and then DFTs into a
 * chain of rotating circles.
 */

import type { Complex } from "./algorithm";

export type PathSlug = "circle" | "square" | "heart" | "figure-eight";

export const PATH_SLUGS = ["circle", "square", "heart", "figure-eight"] as const;

export interface PathDefinition {
  slug: PathSlug;
  name: string;
  fn: (t: number) => Complex;
}

const TAU = Math.PI * 2;

const circle: PathDefinition = {
  slug: "circle",
  name: "Circle",
  fn: (t) => ({ re: Math.cos(TAU * t), im: Math.sin(TAU * t) }),
};

const square: PathDefinition = {
  slug: "square",
  name: "Square wave",
  fn: (t) => {
    const t4 = t * 4;
    if (t4 < 1) return { re: -1 + 2 * t4, im: -1 };
    if (t4 < 2) return { re: 1, im: -1 + 2 * (t4 - 1) };
    if (t4 < 3) return { re: 1 - 2 * (t4 - 2), im: 1 };
    return { re: -1, im: 1 - 2 * (t4 - 3) };
  },
};

const heart: PathDefinition = {
  slug: "heart",
  name: "Heart",
  fn: (t) => {
    const a = TAU * t;
    const sinA = Math.sin(a);
    const re = 16 * sinA * sinA * sinA;
    const im =
      13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    // Heart is parametrised in y-up; flip y so it points up on canvas
    // (where +im draws upward in our projection).
    return { re: re / 16, im: im / 16 };
  },
};

const figureEight: PathDefinition = {
  slug: "figure-eight",
  name: "Figure-eight (lissajous)",
  fn: (t) => ({ re: Math.sin(TAU * t), im: Math.sin(2 * TAU * t) }),
};

const PATHS: Record<PathSlug, PathDefinition> = {
  circle,
  square,
  heart,
  "figure-eight": figureEight,
};

export function getPath(slug: PathSlug): PathDefinition {
  return PATHS[slug];
}

export interface EpicycleDemoState {
  pathSlug: PathSlug;
  numTerms: number;
  samplePoints: number;
  cycleSpeed: number;
}

export interface EpicyclePreset {
  name: string;
  state: EpicycleDemoState;
}

export const DEFAULT_STATE: EpicycleDemoState = {
  pathSlug: "heart",
  numTerms: 24,
  samplePoints: 128,
  cycleSpeed: 0.5,
};

export const PRESETS: readonly EpicyclePreset[] = [
  {
    name: "Circle",
    state: { pathSlug: "circle", numTerms: 1, samplePoints: 64, cycleSpeed: 0.5 },
  },
  {
    name: "Square wave",
    state: { pathSlug: "square", numTerms: 32, samplePoints: 128, cycleSpeed: 0.5 },
  },
  {
    name: "Heart",
    state: { pathSlug: "heart", numTerms: 24, samplePoints: 128, cycleSpeed: 0.5 },
  },
  {
    name: "Figure-eight (lissajous)",
    state: {
      pathSlug: "figure-eight",
      numTerms: 16,
      samplePoints: 128,
      cycleSpeed: 0.5,
    },
  },
] as const;
