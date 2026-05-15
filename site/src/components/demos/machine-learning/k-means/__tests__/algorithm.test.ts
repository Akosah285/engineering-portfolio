import { describe, expect, it } from "vitest";
import {
  assignToClusters,
  euclideanDistanceSq,
  initCentroidsKPP,
  kMeans,
  recomputeCentroids,
  type RGB,
} from "../algorithm";

const r = (red: number, g: number, b: number): RGB => [red, g, b];

describe("euclideanDistanceSq", () => {
  it("is 0 for identical colors", () => {
    expect(euclideanDistanceSq(r(10, 20, 30), r(10, 20, 30))).toBe(0);
  });

  it("computes sum of squared channel differences", () => {
    expect(euclideanDistanceSq(r(0, 0, 0), r(3, 4, 12))).toBe(9 + 16 + 144);
  });

  it("is symmetric", () => {
    expect(euclideanDistanceSq(r(1, 2, 3), r(40, 50, 60))).toBe(
      euclideanDistanceSq(r(40, 50, 60), r(1, 2, 3)),
    );
  });
});

describe("assignToClusters", () => {
  it("assigns each pixel to its nearest centroid", () => {
    const pixels: RGB[] = [r(0, 0, 0), r(255, 255, 255), r(10, 10, 10)];
    const centroids: RGB[] = [r(0, 0, 0), r(255, 255, 255)];
    const assignments = assignToClusters(pixels, centroids);
    expect(assignments).toEqual([0, 1, 0]);
  });

  it("handles a single centroid (everyone in cluster 0)", () => {
    const pixels: RGB[] = [r(50, 50, 50), r(200, 200, 200)];
    const centroids: RGB[] = [r(128, 128, 128)];
    expect(assignToClusters(pixels, centroids)).toEqual([0, 0]);
  });

  it("returns assignments matching input length", () => {
    const pixels: RGB[] = [
      r(1, 2, 3),
      r(4, 5, 6),
      r(7, 8, 9),
      r(10, 11, 12),
    ];
    const centroids: RGB[] = [r(0, 0, 0), r(255, 255, 255)];
    const assignments = assignToClusters(pixels, centroids);
    expect(assignments).toHaveLength(4);
  });
});

describe("recomputeCentroids", () => {
  it("computes the mean color of each cluster", () => {
    const pixels: RGB[] = [r(0, 0, 0), r(10, 10, 10), r(100, 100, 100)];
    const assignments = [0, 0, 1];
    const centroids = recomputeCentroids(pixels, assignments, 2);
    expect(centroids[0]).toEqual([5, 5, 5]);
    expect(centroids[1]).toEqual([100, 100, 100]);
  });

  it("returns k centroids", () => {
    const pixels: RGB[] = [r(0, 0, 0), r(255, 255, 255)];
    const assignments = [0, 1];
    const centroids = recomputeCentroids(pixels, assignments, 3);
    expect(centroids).toHaveLength(3);
  });

  it("leaves an empty cluster's centroid as a black sentinel", () => {
    const pixels: RGB[] = [r(0, 0, 0)];
    const assignments = [0];
    const centroids = recomputeCentroids(pixels, assignments, 2);
    expect(centroids[1]).toEqual([0, 0, 0]);
  });
});

describe("initCentroidsKPP", () => {
  it("returns k distinct centroids drawn from the pixel set", () => {
    const pixels: RGB[] = Array.from({ length: 30 }, (_, i) =>
      r(i * 8, 0, 0),
    );
    const centroids = initCentroidsKPP(pixels, 4, 42);
    expect(centroids).toHaveLength(4);
    for (const c of centroids) {
      expect(pixels.some((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2])).toBe(
        true,
      );
    }
  });

  it("is deterministic for the same seed", () => {
    const pixels: RGB[] = Array.from({ length: 50 }, (_, i) =>
      r(i, 255 - i, (i * 5) % 256),
    );
    const a = initCentroidsKPP(pixels, 5, 7);
    const b = initCentroidsKPP(pixels, 5, 7);
    expect(a).toEqual(b);
  });

  it("differs for different seeds (with high probability)", () => {
    const pixels: RGB[] = Array.from({ length: 100 }, (_, i) =>
      r(i % 256, (i * 3) % 256, (i * 7) % 256),
    );
    const a = initCentroidsKPP(pixels, 4, 1);
    const b = initCentroidsKPP(pixels, 4, 999);
    expect(a).not.toEqual(b);
  });

  it("when k >= number of unique colors, returns all unique colors", () => {
    const pixels: RGB[] = [r(0, 0, 0), r(255, 255, 255)];
    const centroids = initCentroidsKPP(pixels, 2, 1);
    expect(centroids).toHaveLength(2);
  });
});

describe("kMeans", () => {
  it("recovers two well-separated clusters", () => {
    const pixels: RGB[] = [];
    for (let i = 0; i < 30; i++) {
      pixels.push(r(10 + (i % 3), 10 + (i % 3), 10 + (i % 3)));
      pixels.push(r(240 + (i % 3), 240 + (i % 3), 240 + (i % 3)));
    }
    const result = kMeans(pixels, { k: 2, seed: 42, maxIter: 50 });
    expect(result.centroids).toHaveLength(2);
    // Centroids should be near (10,10,10) and (240,240,240) in some order
    const sortedR = result.centroids
      .map((c) => c[0])
      .sort((a, b) => a - b);
    expect(sortedR[0]!).toBeLessThan(50);
    expect(sortedR[1]!).toBeGreaterThan(200);
  });

  it("is deterministic given the same seed", () => {
    const pixels: RGB[] = Array.from({ length: 50 }, (_, i) =>
      r((i * 7) % 256, (i * 13) % 256, (i * 19) % 256),
    );
    const a = kMeans(pixels, { k: 4, seed: 1, maxIter: 30 });
    const b = kMeans(pixels, { k: 4, seed: 1, maxIter: 30 });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.centroids).toEqual(b.centroids);
  });

  it("converges within maxIter (iterations <= maxIter)", () => {
    const pixels: RGB[] = Array.from({ length: 100 }, (_, i) =>
      r(i % 256, (i * 3) % 256, (i * 7) % 256),
    );
    const result = kMeans(pixels, { k: 5, seed: 1, maxIter: 20 });
    expect(result.iterations).toBeLessThanOrEqual(20);
  });

  it("returns an assignment for every pixel", () => {
    const pixels: RGB[] = Array.from({ length: 23 }, (_, i) =>
      r(i * 10, i * 5, i * 11),
    );
    const result = kMeans(pixels, { k: 3, seed: 1, maxIter: 20 });
    expect(result.assignments).toHaveLength(23);
    for (const a of result.assignments) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(3);
    }
  });

  it("k=1 maps everyone to centroid 0 with mean color", () => {
    const pixels: RGB[] = [r(100, 0, 0), r(0, 100, 0), r(0, 0, 100)];
    const result = kMeans(pixels, { k: 1, seed: 1, maxIter: 5 });
    expect(result.centroids).toHaveLength(1);
    expect(result.centroids[0]![0]!).toBeCloseTo(100 / 3, 0);
    expect(result.assignments.every((a) => a === 0)).toBe(true);
  });

  it("inertia decreases (or stays equal) with larger k", () => {
    const pixels: RGB[] = Array.from({ length: 80 }, (_, i) =>
      r((i * 13) % 256, (i * 31) % 256, (i * 47) % 256),
    );
    const small = kMeans(pixels, { k: 2, seed: 1, maxIter: 30 });
    const big = kMeans(pixels, { k: 8, seed: 1, maxIter: 30 });
    expect(big.inertia).toBeLessThanOrEqual(small.inertia);
  });
});
