// Central Limit Theorem demonstrator: draws sample means from a chosen
// underlying distribution and reports the empirical mean / variance for
// comparison against the theoretical sqrt(n)-scaled normal.  Pure module
// used by the v4 Discrete & Probability CLT demo (#69).

import { mulberry32, type Random } from "../../discrete-probability/erdos-renyi/algorithm";

export type Distribution =
  | { readonly kind: "uniform"; readonly a: number; readonly b: number }
  | { readonly kind: "exponential"; readonly lambda: number }
  | { readonly kind: "bernoulli"; readonly p: number };

export interface SampleMeanInput {
  readonly distribution: Distribution;
  readonly n: number;
  readonly nSamples: number;
  readonly random?: Random;
}

export interface SampleMeanResult {
  readonly means: number[];
  readonly empiricalMean: number;
  readonly empiricalStd: number;
  readonly theoreticalMean: number;
  readonly theoreticalStd: number;
}

/** Theoretical mean of a single draw from `dist`. */
export function distributionMean(dist: Distribution): number {
  switch (dist.kind) {
    case "uniform":
      if (!(dist.b > dist.a)) throw new RangeError("distributionMean: uniform b > a required.");
      return (dist.a + dist.b) / 2;
    case "exponential":
      if (!(dist.lambda > 0)) throw new RangeError("distributionMean: exponential lambda > 0 required.");
      return 1 / dist.lambda;
    case "bernoulli":
      if (!(dist.p >= 0 && dist.p <= 1)) {
        throw new RangeError("distributionMean: bernoulli p in [0,1] required.");
      }
      return dist.p;
  }
}

/** Theoretical variance of a single draw from `dist`. */
export function distributionVariance(dist: Distribution): number {
  switch (dist.kind) {
    case "uniform":
      if (!(dist.b > dist.a)) throw new RangeError("distributionVariance: uniform b > a required.");
      return ((dist.b - dist.a) ** 2) / 12;
    case "exponential":
      if (!(dist.lambda > 0)) throw new RangeError("distributionVariance: exponential lambda > 0 required.");
      return 1 / (dist.lambda ** 2);
    case "bernoulli":
      if (!(dist.p >= 0 && dist.p <= 1)) {
        throw new RangeError("distributionVariance: bernoulli p in [0,1] required.");
      }
      return dist.p * (1 - dist.p);
  }
}

function drawOne(dist: Distribution, r: Random): number {
  const u = r();
  switch (dist.kind) {
    case "uniform":
      return dist.a + u * (dist.b - dist.a);
    case "exponential":
      // Inverse-CDF; clamp argument away from 0.
      return -Math.log(Math.max(u, 1e-300)) / dist.lambda;
    case "bernoulli":
      return u < dist.p ? 1 : 0;
  }
}

/**
 * Draw `nSamples` sample means each averaging `n` i.i.d. draws from `dist`.
 *
 * Returns the empirical mean / standard deviation of the sample-mean
 * distribution alongside the theoretical mean μ and theoretical sd
 * σ/√n.  CLT predicts the empirical sd should converge to σ/√n.
 */
export function sampleMeans(input: SampleMeanInput): SampleMeanResult {
  if (!Number.isInteger(input.n) || input.n < 1) {
    throw new RangeError("sampleMeans: n must be a positive integer.");
  }
  if (!Number.isInteger(input.nSamples) || input.nSamples < 1) {
    throw new RangeError("sampleMeans: nSamples must be a positive integer.");
  }
  const r: Random = input.random ?? Math.random;
  const means = new Array<number>(input.nSamples);
  for (let s = 0; s < input.nSamples; s += 1) {
    let acc = 0;
    for (let i = 0; i < input.n; i += 1) acc += drawOne(input.distribution, r);
    means[s] = acc / input.n;
  }
  const empiricalMean = means.reduce((a, b) => a + b, 0) / means.length;
  let v = 0;
  for (const m of means) v += (m - empiricalMean) ** 2;
  const empiricalStd = Math.sqrt(v / means.length);
  const theoreticalMean = distributionMean(input.distribution);
  const theoreticalStd = Math.sqrt(distributionVariance(input.distribution) / input.n);
  return { means, empiricalMean, empiricalStd, theoreticalMean, theoreticalStd };
}

/** Re-export the seeded PRNG so callers don't need a separate import. */
export { mulberry32 };
