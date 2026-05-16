/**
 * Named presets for the Lagrange vs natural-cubic-spline visualiser.
 *
 * Each preset names a node set; the visualiser resolves the nodes (and an
 * optional underlying function f for error measurement) via getNodeSet().
 * f is NOT stored in `useDemoState` because the schema only supports
 * string/number/enum values — it lives only in this lookup table.
 */

import type { Point } from "./algorithm";

export const NODE_SET_SLUGS = [
  "runge-equispaced",
  "runge-chebyshev",
  "smooth-sine",
  "hand-picked",
] as const;

export type NodeSetSlug = (typeof NODE_SET_SLUGS)[number];

export interface NodeSet {
  readonly slug: NodeSetSlug;
  readonly name: string;
  readonly nodes: readonly Point[];
  /** Underlying function f(x), if the node set is sampled from one. */
  readonly f?: (x: number) => number;
  readonly domain: readonly [number, number];
}

function equispaced(a: number, b: number, count: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < count; i += 1) {
    xs.push(a + ((b - a) * i) / (count - 1));
  }
  return xs;
}

/**
 * Chebyshev nodes on [a, b] with n+1 nodes:
 *   x_k = (a+b)/2 + ((b-a)/2) cos((2k+1)π / (2(n+1))),  k = 0..n
 * The raw formula yields nodes in descending order; we sort ascending so
 * they satisfy the algorithm's strictly-x-ascending precondition.
 */
function chebyshev(a: number, b: number, count: number): number[] {
  const xs: number[] = [];
  const mid = (a + b) / 2;
  const half = (b - a) / 2;
  for (let k = 0; k < count; k += 1) {
    xs.push(mid + half * Math.cos(((2 * k + 1) * Math.PI) / (2 * count)));
  }
  return xs.sort((u, v) => u - v);
}

const runge = (x: number): number => 1 / (1 + 25 * x * x);
const sineWave = (x: number): number => Math.sin(Math.PI * x);

function samplePoints(
  xs: readonly number[],
  f: (x: number) => number,
): readonly Point[] {
  return xs.map((x) => ({ x, y: f(x) }));
}

const RUNGE_EQUISPACED: NodeSet = {
  slug: "runge-equispaced",
  name: "Runge's function (equispaced)",
  domain: [-1, 1],
  f: runge,
  nodes: samplePoints(equispaced(-1, 1, 11), runge),
};

const RUNGE_CHEBYSHEV: NodeSet = {
  slug: "runge-chebyshev",
  name: "Runge's function (Chebyshev nodes)",
  domain: [-1, 1],
  f: runge,
  nodes: samplePoints(chebyshev(-1, 1, 11), runge),
};

const SMOOTH_SINE: NodeSet = {
  slug: "smooth-sine",
  name: "Smooth sine",
  domain: [-1, 1],
  f: sineWave,
  nodes: samplePoints(equispaced(-1, 1, 8), sineWave),
};

const HAND_PICKED: NodeSet = {
  slug: "hand-picked",
  name: "Hand-picked points",
  domain: [-1, 1],
  nodes: [
    { x: -1.0, y: 0.2 },
    { x: -0.6, y: 0.9 },
    { x: -0.2, y: 0.4 },
    { x: 0.1, y: 0.7 },
    { x: 0.5, y: -0.3 },
    { x: 0.8, y: 0.1 },
    { x: 1.0, y: 0.55 },
  ],
};

export const NODE_SETS: Readonly<Record<NodeSetSlug, NodeSet>> = {
  "runge-equispaced": RUNGE_EQUISPACED,
  "runge-chebyshev": RUNGE_CHEBYSHEV,
  "smooth-sine": SMOOTH_SINE,
  "hand-picked": HAND_PICKED,
};

export function getNodeSet(slug: NodeSetSlug): NodeSet {
  return NODE_SETS[slug];
}

export type YesNo = "yes" | "no";

export interface LagrangeSplineDemoState {
  nodeSetSlug: NodeSetSlug;
  showLagrange: YesNo;
  showSpline: YesNo;
  showOriginal: YesNo;
}

export interface LagrangeSplinePreset {
  name: string;
  state: LagrangeSplineDemoState;
}

export const DEFAULT_STATE: LagrangeSplineDemoState = {
  nodeSetSlug: "runge-equispaced",
  showLagrange: "yes",
  showSpline: "yes",
  showOriginal: "yes",
};

export const PRESETS: readonly LagrangeSplinePreset[] = [
  {
    name: RUNGE_EQUISPACED.name,
    state: {
      nodeSetSlug: "runge-equispaced",
      showLagrange: "yes",
      showSpline: "yes",
      showOriginal: "yes",
    },
  },
  {
    name: RUNGE_CHEBYSHEV.name,
    state: {
      nodeSetSlug: "runge-chebyshev",
      showLagrange: "yes",
      showSpline: "yes",
      showOriginal: "yes",
    },
  },
  {
    name: SMOOTH_SINE.name,
    state: {
      nodeSetSlug: "smooth-sine",
      showLagrange: "yes",
      showSpline: "yes",
      showOriginal: "yes",
    },
  },
  {
    name: HAND_PICKED.name,
    state: {
      nodeSetSlug: "hand-picked",
      showLagrange: "yes",
      showSpline: "yes",
      showOriginal: "no",
    },
  },
] as const;
