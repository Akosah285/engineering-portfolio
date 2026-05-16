/**
 * bayesTheorem — pure posterior calculation for v4 Bayes demo (#68).
 *
 * Two framings are common in courses:
 *   1. Disease test: prior = base rate, sensitivity = P(+|disease),
 *      specificity = P(-|no disease). Posterior = P(disease | +).
 *   2. General: posterior ∝ likelihood × prior.
 *
 * We expose the test-framing inputs because that's the most demand-rich
 * use-case (the whole "doctor's intuition is wrong" insight). Caller can
 * still use it for any binary-evidence problem by mapping their terms
 * onto sensitivity / specificity / prior.
 */

export interface BayesInput {
  /** P(condition) before the test — must be in [0, 1]. */
  readonly prior: number;
  /** P(test+ | condition) — must be in [0, 1]. */
  readonly sensitivity: number;
  /** P(test- | no condition) — must be in [0, 1]. */
  readonly specificity: number;
}

export interface BayesResult {
  /** P(condition | test+). */
  readonly posteriorPositive: number;
  /** P(condition | test-). */
  readonly posteriorNegative: number;
  /** Marginal P(test+). Useful for population dot-grid visualisations. */
  readonly marginalPositive: number;
}

function checkProbability(p: number, name: string): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError(`bayesTheorem: ${name} must be in [0, 1].`);
  }
}

export function bayesTheorem(input: BayesInput): BayesResult {
  checkProbability(input.prior, "prior");
  checkProbability(input.sensitivity, "sensitivity");
  checkProbability(input.specificity, "specificity");

  const { prior, sensitivity, specificity } = input;
  const falsePositiveRate = 1 - specificity;
  const falseNegativeRate = 1 - sensitivity;

  const marginalPositive = sensitivity * prior + falsePositiveRate * (1 - prior);
  const marginalNegative = falseNegativeRate * prior + specificity * (1 - prior);

  // Edge case: if marginalPositive = 0, no positive results possible →
  // posterior is undefined; return 0 by convention so downstream UI can
  // render "—" instead of NaN.
  const posteriorPositive =
    marginalPositive === 0 ? 0 : (sensitivity * prior) / marginalPositive;
  const posteriorNegative =
    marginalNegative === 0 ? 0 : (falseNegativeRate * prior) / marginalNegative;

  return { posteriorPositive, posteriorNegative, marginalPositive };
}
