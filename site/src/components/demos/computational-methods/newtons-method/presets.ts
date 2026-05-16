/**
 * Named presets + function lookup for the Newton's-method visualiser (#77).
 *
 * The React shell stores only serialisable fields (numbers, enums) in
 * <useDemoState>; the actual f/df callbacks live in this FUNCTIONS table
 * keyed by a `funcSlug` enum so the URL fragment stays clean.
 */

export type FuncSlug = "sqrt2" | "cubic" | "bad-seed" | "sine";

export const FUNC_SLUGS = ["sqrt2", "cubic", "bad-seed", "sine"] as const;

export interface NewtonDemoState {
  funcSlug: FuncSlug;
  x0: number;
  tolerance: number;
  maxIterations: number;
}

export const DEFAULT_STATE: NewtonDemoState = {
  funcSlug: "sqrt2",
  x0: 1.5,
  tolerance: 1e-6,
  maxIterations: 20,
};

export interface NewtonPreset {
  name: string;
  state: NewtonDemoState;
}

export const PRESETS: readonly NewtonPreset[] = [
  {
    name: "Square root of 2",
    state: { funcSlug: "sqrt2", x0: 1.5, tolerance: 1e-6, maxIterations: 20 },
  },
  {
    name: "Cubic real root",
    state: { funcSlug: "cubic", x0: 1.5, tolerance: 1e-6, maxIterations: 20 },
  },
  {
    name: "Bad seed (cycle)",
    state: { funcSlug: "bad-seed", x0: 0, tolerance: 1e-6, maxIterations: 20 },
  },
  {
    name: "Quadratic convergence",
    state: { funcSlug: "sine", x0: 3, tolerance: 1e-8, maxIterations: 20 },
  },
] as const;

export interface NewtonFunction {
  readonly name: string;
  readonly f: (x: number) => number;
  readonly df: (x: number) => number;
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
}

export const FUNCTIONS: Record<FuncSlug, NewtonFunction> = {
  sqrt2: {
    name: "x² − 2",
    f: (x) => x * x - 2,
    df: (x) => 2 * x,
    xRange: [-2, 2],
    yRange: [-3, 3],
  },
  cubic: {
    name: "x³ − x − 1",
    f: (x) => x * x * x - x - 1,
    df: (x) => 3 * x * x - 1,
    xRange: [-2, 2.5],
    yRange: [-5, 5],
  },
  "bad-seed": {
    name: "x³ − 2x + 2",
    f: (x) => x * x * x - 2 * x + 2,
    df: (x) => 3 * x * x - 2,
    xRange: [-2.5, 2],
    yRange: [-5, 5],
  },
  sine: {
    name: "sin(x)",
    f: Math.sin,
    df: Math.cos,
    xRange: [-1, 7],
    yRange: [-1.5, 1.5],
  },
};

export function getFunction(slug: FuncSlug): NewtonFunction {
  return FUNCTIONS[slug];
}
