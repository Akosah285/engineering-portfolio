// PageRank computation via power iteration on the column-stochastic
// transition matrix with damping.  Used by the v4 Discrete & Probability
// PageRank demo.

export type Edge = readonly [from: number, to: number];

export interface PageRankInput {
  readonly nNodes: number;
  readonly edges: readonly Edge[];
  readonly damping?: number;
  readonly tolerance?: number;
  readonly maxIterations?: number;
  readonly initial?: readonly number[];
}

export interface PageRankResult {
  readonly ranks: number[];
  readonly iterations: number;
  readonly converged: boolean;
}

/**
 * PageRank by power iteration.
 *
 * Standard formulation: r = d * M r + (1 - d) / N * 1, where M is the
 * column-stochastic transition matrix.  Dangling nodes (zero out-degree)
 * have their column treated as uniform 1/N to keep total mass conserved.
 *
 * Returns the converged rank vector with entries summing to 1.
 */
export function pageRank(input: PageRankInput): PageRankResult {
  const N = input.nNodes;
  if (!Number.isInteger(N) || N < 1) {
    throw new RangeError("pageRank: nNodes must be a positive integer.");
  }
  const damping = input.damping ?? 0.85;
  if (!(damping > 0 && damping < 1)) {
    throw new RangeError("pageRank: damping must be in (0, 1).");
  }
  const tol = input.tolerance ?? 1e-9;
  if (!(tol > 0)) throw new RangeError("pageRank: tolerance must be > 0.");
  const maxIter = input.maxIterations ?? 200;
  if (!Number.isInteger(maxIter) || maxIter < 1) {
    throw new RangeError("pageRank: maxIterations must be a positive integer.");
  }
  // Out-degrees + adjacency lookup.
  const outDeg = new Array<number>(N).fill(0);
  const outNeighbors: number[][] = Array.from({ length: N }, () => [] as number[]);
  for (const [from, to] of input.edges) {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= N ||
      to >= N
    ) {
      throw new RangeError("pageRank: edge endpoint out of range.");
    }
    outDeg[from] = outDeg[from]! + 1;
    outNeighbors[from]!.push(to);
  }
  // Initial r: uniform unless caller specified.
  let r: number[];
  if (input.initial !== undefined) {
    if (input.initial.length !== N)
      throw new RangeError("pageRank: initial length mismatch.");
    const sum0 = input.initial.reduce((a, b) => a + b, 0);
    if (sum0 <= 0) throw new RangeError("pageRank: initial must have positive sum.");
    r = input.initial.map((v) => v / sum0);
  } else {
    r = new Array<number>(N).fill(1 / N);
  }
  const teleport = (1 - damping) / N;
  let converged = false;
  let iter = 0;
  for (iter = 0; iter < maxIter; iter += 1) {
    const next = new Array<number>(N).fill(teleport);
    // Dangling-node mass redistributed uniformly.
    let danglingMass = 0;
    for (let i = 0; i < N; i += 1) if (outDeg[i] === 0) danglingMass += r[i]!;
    const danglingShare = (damping * danglingMass) / N;
    for (let i = 0; i < N; i += 1) next[i] = next[i]! + danglingShare;
    // Distribute mass along outgoing edges.
    for (let i = 0; i < N; i += 1) {
      const deg = outDeg[i]!;
      if (deg === 0) continue;
      const share = (damping * r[i]!) / deg;
      for (const j of outNeighbors[i]!) next[j] = next[j]! + share;
    }
    // L1 distance for convergence check.
    let diff = 0;
    for (let i = 0; i < N; i += 1) diff += Math.abs(next[i]! - r[i]!);
    r = next;
    if (diff < tol) {
      converged = true;
      iter += 1;
      break;
    }
  }
  return { ranks: r, iterations: iter, converged };
}
