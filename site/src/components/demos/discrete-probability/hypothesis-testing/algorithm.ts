// Hypothesis testing: one-sample and two-sample tests with z-statistics,
// normal CDF, p-values, and decision under significance level α.
//
// References: Casella & Berger §8.1-8.3.

// Approximate normal CDF using error function approximation (Abramowitz & Stegun 7.1.26).
export function erf(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError("x must be finite");
  const sign = Math.sign(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw new RangeError("sigma must be > 0");
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export type Alternative = "two-sided" | "greater" | "less";

export interface OneSampleZInput {
  readonly xbar: number;
  readonly mu0: number;
  readonly sigma: number; // known population sd
  readonly n: number;
  readonly alternative?: Alternative;
}

export interface ZResult {
  readonly z: number;
  readonly pValue: number;
}

export function oneSampleZ(input: OneSampleZInput): ZResult {
  const { xbar, mu0, sigma, n } = input;
  const alt = input.alternative ?? "two-sided";
  if (sigma <= 0) throw new RangeError("sigma must be > 0");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n must be positive integer");
  const z = (xbar - mu0) / (sigma / Math.sqrt(n));
  return { z, pValue: pValueFromZ(z, alt) };
}

export interface TwoSampleZInput {
  readonly xbar1: number;
  readonly xbar2: number;
  readonly sigma1: number;
  readonly sigma2: number;
  readonly n1: number;
  readonly n2: number;
  readonly mu0Diff?: number;
  readonly alternative?: Alternative;
}

export function twoSampleZ(input: TwoSampleZInput): ZResult {
  const alt = input.alternative ?? "two-sided";
  const { xbar1, xbar2, sigma1, sigma2, n1, n2 } = input;
  if (sigma1 <= 0 || sigma2 <= 0) throw new RangeError("sigmas must be > 0");
  if (!Number.isInteger(n1) || n1 < 1) throw new RangeError("n1 must be positive integer");
  if (!Number.isInteger(n2) || n2 < 1) throw new RangeError("n2 must be positive integer");
  const mu0 = input.mu0Diff ?? 0;
  const se = Math.sqrt((sigma1 * sigma1) / n1 + (sigma2 * sigma2) / n2);
  const z = (xbar1 - xbar2 - mu0) / se;
  return { z, pValue: pValueFromZ(z, alt) };
}

function pValueFromZ(z: number, alt: Alternative): number {
  if (alt === "two-sided") {
    return 2 * (1 - normalCdf(Math.abs(z)));
  }
  if (alt === "greater") {
    return 1 - normalCdf(z);
  }
  return normalCdf(z);
}

// Decision: reject H0 iff p < α.
export function decide(p: number, alpha: number): "reject H0" | "fail to reject H0" {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError("p must be in [0, 1]");
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new RangeError("alpha must be in (0, 1)");
  }
  return p < alpha ? "reject H0" : "fail to reject H0";
}
