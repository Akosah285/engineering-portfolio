/**
 * Named graph presets for the PageRank visualiser.
 *
 * Each preset bundles the graph topology (nodes + directed edges) along
 * with a snapshot of share-relevant control state. The visualiser keeps
 * only the slug in <useDemoState> — edges are resolved via lookup so we
 * don't bloat the URL fragment with adjacency arrays.
 */

import type { Edge } from "./algorithm";

export const GRAPH_SLUGS = [
  "linear-chain",
  "star",
  "two-cluster",
  "cycle-6",
  "web-example",
] as const;

export type GraphSlug = (typeof GRAPH_SLUGS)[number];

export const TOLERANCE_KEYS = ["1e-3", "1e-6", "1e-9"] as const;
export type ToleranceKey = (typeof TOLERANCE_KEYS)[number];

export const TOLERANCE_VALUES: Readonly<Record<ToleranceKey, number>> = {
  "1e-3": 1e-3,
  "1e-6": 1e-6,
  "1e-9": 1e-9,
};

export interface GraphDef {
  readonly slug: GraphSlug;
  readonly name: string;
  readonly nNodes: number;
  readonly edges: readonly Edge[];
}

function cliqueEdges(offset: number, size: number): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (i !== j) out.push([offset + i, offset + j] as const);
    }
  }
  return out;
}

export const GRAPHS: Readonly<Record<GraphSlug, GraphDef>> = {
  "linear-chain": {
    slug: "linear-chain",
    name: "Linear chain (1→2→3→4→5)",
    nNodes: 5,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ] as const,
  },
  star: {
    slug: "star",
    name: "Star (1 hub, 4 spokes)",
    nNodes: 5,
    edges: [
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ] as const,
  },
  "two-cluster": {
    slug: "two-cluster",
    name: "Two-cluster bridge",
    nNodes: 8,
    edges: [...cliqueEdges(0, 4), ...cliqueEdges(4, 4), [3, 4] as const],
  },
  "cycle-6": {
    slug: "cycle-6",
    name: "Cycle of 6",
    nNodes: 6,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
    ] as const,
  },
  "web-example": {
    slug: "web-example",
    name: "Web example",
    nNodes: 7,
    edges: [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 5],
      [4, 1],
      [4, 5],
      [4, 6],
      [5, 4],
      [6, 4],
      [6, 0],
    ] as const,
  },
};

export function getGraph(slug: GraphSlug): GraphDef {
  return GRAPHS[slug];
}

export interface PageRankDemoState {
  graphSlug: GraphSlug;
  damping: number;
  maxIterations: number;
  toleranceKey: ToleranceKey;
}

export const DEFAULT_STATE: PageRankDemoState = {
  graphSlug: "web-example",
  damping: 0.85,
  maxIterations: 200,
  toleranceKey: "1e-6",
};

export interface PageRankPreset {
  name: string;
  state: PageRankDemoState;
}

export const PRESETS: readonly PageRankPreset[] = [
  {
    name: GRAPHS["linear-chain"].name,
    state: { ...DEFAULT_STATE, graphSlug: "linear-chain" },
  },
  {
    name: GRAPHS.star.name,
    state: { ...DEFAULT_STATE, graphSlug: "star" },
  },
  {
    name: GRAPHS["two-cluster"].name,
    state: { ...DEFAULT_STATE, graphSlug: "two-cluster" },
  },
  {
    name: GRAPHS["cycle-6"].name,
    state: { ...DEFAULT_STATE, graphSlug: "cycle-6" },
  },
  {
    name: GRAPHS["web-example"].name,
    state: { ...DEFAULT_STATE, graphSlug: "web-example" },
  },
] as const;
