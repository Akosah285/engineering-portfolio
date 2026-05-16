/**
 * Named presets + function lookup for the bisection visualiser (#78).
 *
 * Functions live in a slug-keyed lookup so the demo state stays
 * serialisable (number/string/enum only) and shareable via the URL.
 */

export type FuncSlug = "sqrt2" | "cubic" | "transcend" | "flat";

export const FUNC_SLUGS = ["sqrt2", "cubic", "transcend", "flat"] as const;

export interface BisectionDemoState {
  funcSlug: FuncSlug;
  a: number;
  b: number;
  tolerance: number;
  maxIterations: number;
}

export interface BisectionPreset {
  name: string;
  state: BisectionDemoState;
}

export interface BisectionFunction {
  readonly name: string;
  readonly f: (x: number) => number;
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
}

export const FUNCTIONS: Record<FuncSlug, BisectionFunction> = {
  sqrt2: {
    name: "x² − 2",
    f: (x) => x * x - 2,
    xRange: [-0.5, 2.5],
    yRange: [-3, 3],
  },
  cubic: {
    name: "x³ − x − 1",
    f: (x) => x * x * x - x - 1,
    xRange: [0, 2.5],
    yRange: [-2, 5],
  },
  transcend: {
    name: "cos(x) − x",
    f: (x) => Math.cos(x) - x,
    xRange: [-0.5, 1.5],
    yRange: [-1, 2],
  },
  flat: {
    name: "(x − 1)⁷",
    f: (x) => (x - 1) ** 7,
    xRange: [-0.5, 2.5],
    yRange: [-1, 1],
  },
};

export const DEFAULT_STATE: BisectionDemoState = {
  funcSlug: "sqrt2",
  a: 0,
  b: 2,
  tolerance: 1e-6,
  maxIterations: 30,
};

export const PRESETS: readonly BisectionPreset[] = [
  {
    name: "Square root of 2",
    state: {
      funcSlug: "sqrt2",
      a: 0,
      b: 2,
      tolerance: 1e-6,
      maxIterations: 30,
    },
  },
  {
    name: "Cubic real root",
    state: {
      funcSlug: "cubic",
      a: 1,
      b: 2,
      tolerance: 1e-6,
      maxIterations: 30,
    },
  },
  {
    name: "Transcendental",
    state: {
      funcSlug: "transcend",
      a: 0,
      b: 1,
      tolerance: 1e-6,
      maxIterations: 30,
    },
  },
  {
    name: "Slow shrink",
    state: {
      funcSlug: "flat",
      a: 0,
      b: 2,
      tolerance: 1e-8,
      maxIterations: 60,
    },
  },
] as const;
