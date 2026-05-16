/**
 * K-Means clustering on RGB pixels for the image-compression demo (#26).
 *
 * Pure module. Deterministic given a seed (k-means++ initialisation uses
 * a Mulberry32 PRNG). All operations are O(n × k × iterations) which is
 * fine for the small bundled images (~150×150 → 22 500 pixels).
 *
 * Math reference (concise):
 *
 *   K-Means objective: minimize Σ_i ||x_i - μ_{c(i)}||²   (inertia)
 *
 *   Algorithm (Lloyd's): repeat until assignments don't change
 *     1. Assign each x_i to its nearest centroid μ_j
 *     2. Recompute each μ_j as the mean of its assigned points
 *
 *   k-means++ init: pick first centroid uniformly at random;
 *     each subsequent centroid is chosen with probability proportional
 *     to D(x)² where D(x) = distance to nearest already-chosen centroid.
 */

export type RGB = readonly [number, number, number];

export interface KMeansOptions {
  k: number;
  seed: number;
  maxIter: number;
}

export interface KMeansResult {
  centroids: RGB[];
  assignments: number[];
  iterations: number;
  inertia: number;
}

/** Sum of squared differences across the three RGB channels. */
export function euclideanDistanceSq(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * For each pixel, return the index of its nearest centroid.
 */
export function assignToClusters(
  pixels: readonly RGB[],
  centroids: readonly RGB[],
): number[] {
  const n = pixels.length;
  const k = centroids.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const p = pixels[i]!;
    let best = 0;
    let bestDist = euclideanDistanceSq(p, centroids[0]!);
    for (let j = 1; j < k; j++) {
      const d = euclideanDistanceSq(p, centroids[j]!);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    out[i] = best;
  }
  return out;
}

/**
 * Recompute centroids as the mean color of the pixels assigned to each cluster.
 * Empty clusters get a black sentinel — they'll be re-seeded in the next
 * iteration if the assignment step finds any pixel closer to the sentinel.
 */
export function recomputeCentroids(
  pixels: readonly RGB[],
  assignments: readonly number[],
  k: number,
): RGB[] {
  const sums = Array.from({ length: k }, () => [0, 0, 0]);
  const counts = new Array<number>(k).fill(0);
  for (let i = 0; i < pixels.length; i++) {
    const a = assignments[i]!;
    const p = pixels[i]!;
    sums[a]![0]! += p[0];
    sums[a]![1]! += p[1];
    sums[a]![2]! += p[2];
    counts[a]! += 1;
  }
  const centroids: RGB[] = [];
  for (let j = 0; j < k; j++) {
    const c = counts[j]!;
    if (c === 0) {
      centroids.push([0, 0, 0]);
    } else {
      centroids.push([
        Math.round(sums[j]![0]! / c),
        Math.round(sums[j]![1]! / c),
        Math.round(sums[j]![2]! / c),
      ]);
    }
  }
  return centroids;
}

/** Mulberry32 PRNG — deterministic, well-distributed, 32-bit state. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * k-means++ initialisation: pick the first centroid uniformly at random,
 * each subsequent one weighted by squared distance to the closest chosen
 * centroid. Better starting points → faster convergence and lower final
 * inertia than random init.
 */
export function initCentroidsKPP(pixels: readonly RGB[], k: number, seed: number): RGB[] {
  const rand = mulberry32(seed);
  const n = pixels.length;
  if (n === 0) return [];

  const chosen: RGB[] = [];
  const firstIdx = Math.floor(rand() * n) % n;
  chosen.push(pixels[firstIdx]!);

  // Track squared distance from each pixel to the closest chosen centroid.
  const dists = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    dists[i] = euclideanDistanceSq(pixels[i]!, chosen[0]!);
  }

  while (chosen.length < k) {
    let total = 0;
    for (const d of dists) total += d;
    if (total === 0) {
      // All pixels coincide with chosen centroids — just repeat the last one.
      chosen.push(chosen[chosen.length - 1]!);
      continue;
    }
    const target = rand() * total;
    let acc = 0;
    let pickIdx = 0;
    for (let i = 0; i < n; i++) {
      acc += dists[i]!;
      if (acc >= target) {
        pickIdx = i;
        break;
      }
    }
    chosen.push(pixels[pickIdx]!);
    // Update distances: each pixel now uses the min over all chosen centroids.
    const newCentroid = chosen[chosen.length - 1]!;
    for (let i = 0; i < n; i++) {
      const d = euclideanDistanceSq(pixels[i]!, newCentroid);
      if (d < dists[i]!) dists[i] = d;
    }
  }

  return chosen;
}

/**
 * Run Lloyd's algorithm to convergence (or maxIter, whichever first).
 *
 * Returns:
 * - centroids: final cluster colors
 * - assignments: pixel-to-cluster index mapping
 * - iterations: how many iterations actually ran (≤ maxIter)
 * - inertia: final Σ ||x_i - μ_{c(i)}||²
 */
export function kMeans(pixels: readonly RGB[], options: KMeansOptions): KMeansResult {
  const { k, seed, maxIter } = options;
  if (k < 1) throw new Error("k must be >= 1");
  if (pixels.length === 0) {
    return { centroids: [], assignments: [], iterations: 0, inertia: 0 };
  }

  let centroids = initCentroidsKPP(pixels, k, seed);
  let assignments = assignToClusters(pixels, centroids);
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const newCentroids = recomputeCentroids(pixels, assignments, k);
    const newAssignments = assignToClusters(pixels, newCentroids);
    centroids = newCentroids;
    let changed = false;
    for (let i = 0; i < newAssignments.length; i++) {
      if (newAssignments[i] !== assignments[i]) {
        changed = true;
        break;
      }
    }
    assignments = newAssignments;
    if (!changed) break;
  }

  let inertia = 0;
  for (let i = 0; i < pixels.length; i++) {
    inertia += euclideanDistanceSq(pixels[i]!, centroids[assignments[i]!]!);
  }

  return { centroids, assignments, iterations, inertia };
}
