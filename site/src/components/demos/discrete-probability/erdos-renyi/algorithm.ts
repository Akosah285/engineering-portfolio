// Erdős-Rényi random graph G(n, p) generator + a few descriptive
// statistics (degree distribution, edge count, connected-component
// labeling) used by the v4 Discrete & Probability random-graph demo.
//
// Pure module: takes a `random()` callable so callers (including tests)
// can inject a seeded PRNG for determinism.

export type Random = () => number;

export interface ERInput {
  readonly nNodes: number;
  readonly p: number;
  readonly random?: Random;
}

export interface ERGraph {
  readonly nNodes: number;
  readonly edges: [number, number][];
  readonly adjacency: number[][];
}

/** Generate G(n, p): each unordered pair {i, j} included with probability p. */
export function generate(input: ERInput): ERGraph {
  if (!Number.isInteger(input.nNodes) || input.nNodes < 0) {
    throw new RangeError("generate: nNodes must be a non-negative integer.");
  }
  if (!(input.p >= 0 && input.p <= 1)) {
    throw new RangeError("generate: p must be in [0, 1].");
  }
  const rand: Random = input.random ?? Math.random;
  const adjacency: number[][] = Array.from(
    { length: input.nNodes },
    () => [] as number[],
  );
  const edges: [number, number][] = [];
  for (let i = 0; i < input.nNodes; i += 1) {
    for (let j = i + 1; j < input.nNodes; j += 1) {
      if (rand() < input.p) {
        edges.push([i, j]);
        adjacency[i]!.push(j);
        adjacency[j]!.push(i);
      }
    }
  }
  return { nNodes: input.nNodes, edges, adjacency };
}

/** Degree of every node, indexed 0..n-1. */
export function degrees(graph: ERGraph): number[] {
  return graph.adjacency.map((nbrs) => nbrs.length);
}

/** Mean degree (handles n=0 by returning 0). */
export function meanDegree(graph: ERGraph): number {
  if (graph.nNodes === 0) return 0;
  let s = 0;
  for (const nbrs of graph.adjacency) s += nbrs.length;
  return s / graph.nNodes;
}

/** Connected-component labels via BFS.  Returns an array of length n. */
export function componentLabels(graph: ERGraph): number[] {
  const labels = new Array<number>(graph.nNodes).fill(-1);
  let next = 0;
  for (let start = 0; start < graph.nNodes; start += 1) {
    if (labels[start] !== -1) continue;
    const queue: number[] = [start];
    labels[start] = next;
    while (queue.length > 0) {
      const v = queue.shift()!;
      for (const u of graph.adjacency[v]!) {
        if (labels[u] === -1) {
          labels[u] = next;
          queue.push(u);
        }
      }
    }
    next += 1;
  }
  return labels;
}

/** Size of the largest connected component. */
export function largestComponentSize(graph: ERGraph): number {
  const labels = componentLabels(graph);
  if (labels.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let maxSize = 0;
  for (const c of counts.values()) if (c > maxSize) maxSize = c;
  return maxSize;
}

/**
 * Tiny mulberry32 PRNG.  Deterministic, seedable, used by tests so the
 * generator behaves reproducibly under the suite.
 */
export function mulberry32(seed: number): Random {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
