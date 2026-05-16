import { describe, expect, it } from "vitest";

import { pageRank } from "../algorithm";

describe("pageRank — basic invariants", () => {
  it("ranks sum to 1", () => {
    const r = pageRank({
      nNodes: 5,
      edges: [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
      ],
    });
    const total = r.ranks.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("on a fully symmetric directed cycle, all ranks are equal to 1/N", () => {
    const N = 6;
    const edges: [number, number][] = [];
    for (let i = 0; i < N; i += 1) edges.push([i, (i + 1) % N]);
    const r = pageRank({ nNodes: N, edges });
    for (const v of r.ranks) expect(v).toBeCloseTo(1 / N, 9);
  });

  it("nodes with more incoming links rank higher", () => {
    // 0 -> 3, 1 -> 3, 2 -> 3, 3 -> 0
    const r = pageRank({
      nNodes: 4,
      edges: [
        [0, 3],
        [1, 3],
        [2, 3],
        [3, 0],
      ],
    });
    // Node 3 has 3 inbound, node 0 has 1 inbound, nodes 1 & 2 only get teleport mass.
    expect(r.ranks[3]!).toBeGreaterThan(r.ranks[0]!);
    expect(r.ranks[0]!).toBeGreaterThan(r.ranks[1]!);
    expect(r.ranks[0]!).toBeGreaterThan(r.ranks[2]!);
  });
});

describe("pageRank — dangling nodes", () => {
  it("a graph with a dangling node still conserves mass", () => {
    // 0 -> 1, 1 -> 2; node 2 dangles.
    const r = pageRank({
      nNodes: 3,
      edges: [
        [0, 1],
        [1, 2],
      ],
    });
    const total = r.ranks.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("a graph of all dangling nodes converges to uniform", () => {
    const r = pageRank({ nNodes: 4, edges: [] });
    for (const v of r.ranks) expect(v).toBeCloseTo(0.25, 10);
  });
});

describe("pageRank — convergence", () => {
  it("converges within maxIterations on a small graph", () => {
    const r = pageRank({
      nNodes: 5,
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
        [3, 4],
        [4, 3],
      ],
    });
    expect(r.converged).toBe(true);
    expect(r.iterations).toBeLessThan(200);
  });

  it("respects a custom initial distribution (still sums to 1 after first normalize)", () => {
    const r = pageRank({
      nNodes: 3,
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      initial: [10, 1, 1],
    });
    const total = r.ranks.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("respects a custom damping factor", () => {
    const lo = pageRank({
      nNodes: 3,
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      damping: 0.1,
    });
    const hi = pageRank({
      nNodes: 3,
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      damping: 0.99,
    });
    // Both still converge for a strongly connected cycle.
    expect(lo.converged).toBe(true);
    expect(hi.converged).toBe(true);
    // Both should give uniform on the symmetric cycle.
    for (const v of lo.ranks) expect(v).toBeCloseTo(1 / 3, 9);
    for (const v of hi.ranks) expect(v).toBeCloseTo(1 / 3, 9);
  });
});

describe("pageRank — error handling", () => {
  it("RangeError on bad nNodes / damping / tolerance / maxIterations", () => {
    expect(() => pageRank({ nNodes: 0, edges: [] })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 1, edges: [], damping: 0 })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 1, edges: [], damping: 1 })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 1, edges: [], tolerance: 0 })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 1, edges: [], maxIterations: 0 })).toThrow(
      RangeError,
    );
  });

  it("RangeError on out-of-range edge endpoints", () => {
    expect(() => pageRank({ nNodes: 3, edges: [[0, 5]] })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 3, edges: [[-1, 0]] })).toThrow(RangeError);
  });

  it("RangeError on initial of wrong length or non-positive sum", () => {
    expect(() => pageRank({ nNodes: 3, edges: [], initial: [1, 1] })).toThrow(RangeError);
    expect(() => pageRank({ nNodes: 3, edges: [], initial: [0, 0, 0] })).toThrow(
      RangeError,
    );
  });
});
