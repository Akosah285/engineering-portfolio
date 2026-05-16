/**
 * Named presets for the quadrature visualiser (#79).
 *
 * Each preset is a snapshot of all share-relevant state so the
 * <PresetCarousel> can jump to it and useDemoState keeps the URL fragment
 * in sync. Functions themselves are looked up by slug from FUNCTIONS so the
 * state stays serializable.
 */

export type FuncSlug = "quad" | "sine" | "gauss" | "osc";
export type RuleSlug = "rectangle" | "midpoint" | "trapezoid" | "simpson";

export interface QuadratureDemoState {
  funcSlug: FuncSlug;
  rule: RuleSlug;
  a: number;
  b: number;
  n: number;
}

export const FUNC_SLUGS = ["quad", "sine", "gauss", "osc"] as const;
export const RULE_SLUGS = ["rectangle", "midpoint", "trapezoid", "simpson"] as const;

export interface QuadFunction {
  readonly name: string;
  readonly latex: string;
  readonly f: (x: number) => number;
  readonly defaultA: number;
  readonly defaultB: number;
  readonly aRange: readonly [number, number];
  readonly bRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  readonly exact?: number;
}

export const FUNCTIONS: Record<FuncSlug, QuadFunction> = {
  quad: {
    name: "Quadratic",
    latex: "x^2",
    f: (x) => x * x,
    defaultA: 0,
    defaultB: 1,
    aRange: [-1, 1],
    bRange: [0, 2],
    yRange: [0, 4],
    exact: 1 / 3,
  },
  sine: {
    name: "Sine half-arch",
    latex: "\\sin(x)",
    f: Math.sin,
    defaultA: 0,
    defaultB: Math.PI,
    aRange: [0, Math.PI],
    bRange: [0, Math.PI * 2],
    yRange: [-1, 1.5],
    exact: 2,
  },
  gauss: {
    name: "Gaussian bump",
    latex: "e^{-x^2}",
    f: (x) => Math.exp(-x * x),
    defaultA: -2,
    defaultB: 2,
    aRange: [-3, 0],
    bRange: [0, 3],
    yRange: [0, 1.2],
    exact: 1.7641619,
  },
  osc: {
    name: "Oscillator",
    latex: "\\sin(10x)/x",
    f: (x) => Math.sin(10 * x) / x,
    defaultA: 0.1,
    defaultB: 5,
    aRange: [0.05, 1],
    bRange: [1, 10],
    yRange: [-1.5, 10],
  },
};

export const RULE_LABELS: Record<RuleSlug, string> = {
  rectangle: "Rectangle",
  midpoint: "Midpoint",
  trapezoid: "Trapezoid",
  simpson: "Simpson",
};

export const DEFAULT_STATE: QuadratureDemoState = {
  funcSlug: "quad",
  rule: "midpoint",
  a: 0,
  b: 1,
  n: 8,
};

export interface QuadraturePreset {
  name: string;
  state: QuadratureDemoState;
}

export const PRESETS: readonly QuadraturePreset[] = [
  {
    name: "Quadratic",
    state: { funcSlug: "quad", rule: "midpoint", a: 0, b: 1, n: 8 },
  },
  {
    name: "Sine half-arch",
    state: { funcSlug: "sine", rule: "trapezoid", a: 0, b: Math.PI, n: 8 },
  },
  {
    name: "Gaussian bump",
    state: { funcSlug: "gauss", rule: "simpson", a: -2, b: 2, n: 8 },
  },
  {
    name: "Oscillator",
    state: { funcSlug: "osc", rule: "simpson", a: 0.1, b: 5, n: 16 },
  },
] as const;
