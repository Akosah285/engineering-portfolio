import { describe, expect, it } from "vitest";

import {
  componentLabels,
  degrees,
  generate,
  largestComponentSize,
  meanDegree,
  mulberry32,
} from "../algorithm";

describe("generate — boundary cases", () => {
  it("p=0 produces an empty graph (no edges)", () => {
    const g = generate({ nNodes: 10, p: 0, random: mulberry32(42) });
    expect(g.edges.length).toBe(0);
    for (const nbrs of g.adjacency) expect(nbrs.length).toBe(0);
  });

  it("p=1 produces the complete graph (n*(n-1)/2 edges)", () => {
    const n = 10;
    const g = generate({ nNodes: n, p: 1, random: mulberry32(42) });
    expect(g.edges.length).toBe((n * (n - 1)) / 2);
    for (let i = 0; i < n; i += 1) expect(g.adjacency[i]!.length).toBe(n - 1);
  });

  it("nNodes=0 produces a trivial empty graph", () => {
    const g = generate({ nNodes: 0, p: 0.5, random: mulberry32(42) });
    expect(g.nNodes).toBe(0);
    expect(g.edges).toEqual([]);
    expect(g.adjacency).toEqual([]);
  });

  it("nNodes=1 has 0 edges (no self-loops)", () => {
    const g = generate({ nNodes: 1, p: 1, random: mulberry32(42) });
    expect(g.edges).toEqual([]);
  });
});

describe("generate — statistics on G(n, p)", () => {
  it("mean degree is approximately (n-1) * p for a moderate-sized graph", () => {
    const n = 200;
    const p = 0.05;
    const g = generate({ nNodes: n, p, random: mulberry32(123) });
    const m = meanDegree(g);
    const expected = (n - 1) * p;
    // standard error scales as sqrt((n-1) p (1-p)) / sqrt(n) ~ 0.7 here
    expect(Math.abs(m - expected)).toBeLessThan(1.0);
  });

  it("seeded PRNG yields the same graph twice", () => {
    const a = generate({ nNodes: 50, p: 0.1, random: mulberry32(7) });
    const b = generate({ nNodes: 50, p: 0.1, random: mulberry32(7) });
    expect(a.edges).toEqual(b.edges);
  });

  it("different seeds yield different graphs (statistically very likely)", () => {
    const a = generate({ nNodes: 50, p: 0.1, random: mulberry32(7) });
    const b = generate({ nNodes: 50, p: 0.1, random: mulberry32(8) });
    expect(a.edges).not.toEqual(b.edges);
  });
});

describe("degrees", () => {
  it("returns an array of length n", () => {
    const g = generate({ nNodes: 5, p: 0.5, random: mulberry32(1) });
    expect(degrees(g).length).toBe(5);
  });

  it("sum of degrees equals 2 * |E|", () => {
    const g = generate({ nNodes: 30, p: 0.2, random: mulberry32(99) });
    const sumDeg = degrees(g).reduce((a, b) => a + b, 0);
    expect(sumDeg).toBe(2 * g.edges.length);
  });
});

describe("componentLabels / largestComponentSize", () => {
  it("an empty graph has each node as its own component", () => {
    const g = generate({ nNodes: 5, p: 0, random: mulberry32(1) });
    const labels = componentLabels(g);
    expect(new Set(labels).size).toBe(5);
    expect(largestComponentSize(g)).toBe(1);
  });

  it("the complete graph is one component of size n", () => {
    const g = generate({ nNodes: 6, p: 1, random: mulberry32(1) });
    const labels = componentLabels(g);
    expect(new Set(labels).size).toBe(1);
    expect(largestComponentSize(g)).toBe(6);
  });

  it("returns 0 for largest component of an empty (zero-node) graph", () => {
    const g = generate({ nNodes: 0, p: 0.5, random: mulberry32(1) });
    expect(largestComponentSize(g)).toBe(0);
  });

  it("two-node graph with single edge has component size 2", () => {
    const g = generate({ nNodes: 2, p: 1, random: mulberry32(1) });
    expect(largestComponentSize(g)).toBe(2);
  });
});

describe("generate — error gates", () => {
  it("RangeError on negative or non-integer nNodes", () => {
    expect(() => generate({ nNodes: -1, p: 0.5 })).toThrow(RangeError);
    expect(() => generate({ nNodes: 1.5, p: 0.5 })).toThrow(RangeError);
  });

  it("RangeError on p outside [0, 1]", () => {
    expect(() => generate({ nNodes: 5, p: -0.1 })).toThrow(RangeError);
    expect(() => generate({ nNodes: 5, p: 1.1 })).toThrow(RangeError);
  });
});

describe("mulberry32", () => {
  it("returns numbers in [0, 1)", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 100; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
