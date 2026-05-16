/**
 * leastSquares — ordinary linear regression by closed-form normal equations (#84).
 *
 * Fits y = m·x + b (simple linear regression).  The solution exists in
 * closed form: m = cov(x,y) / var(x),  b = mean(y) − m·mean(x).
 * Goodness-of-fit is reported as r² (coefficient of determination).
 *
 * For polynomial fits, the React shell can build x_design = [1, x, x², ...]
 * and call a multivariate variant; this brain stays simple and pure.
 */

export interface LinearFitInput {
  readonly xs: ReadonlyArray<number>;
  readonly ys: ReadonlyArray<number>;
}

export interface LinearFitResult {
  /** Slope m. */
  readonly slope: number;
  /** Intercept b. */
  readonly intercept: number;
  /** Coefficient of determination R^2 ∈ [0, 1]. NaN when ys are constant. */
  readonly r2: number;
  /** Sum of squared residuals Σ (y_i − ŷ_i)^2. */
  readonly residualSumOfSquares: number;
}

function meanOf(xs: ReadonlyArray<number>): number {
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

export function linearFit(input: LinearFitInput): LinearFitResult {
  const { xs, ys } = input;
  if (xs.length !== ys.length) {
    throw new RangeError("linearFit: xs and ys must have the same length.");
  }
  if (xs.length < 2) {
    throw new RangeError("linearFit: need at least 2 points.");
  }
  for (const v of xs) {
    if (!Number.isFinite(v))
      throw new RangeError("linearFit: xs contain non-finite values.");
  }
  for (const v of ys) {
    if (!Number.isFinite(v))
      throw new RangeError("linearFit: ys contain non-finite values.");
  }

  const xMean = meanOf(xs);
  const yMean = meanOf(ys);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i]! - xMean;
    const dy = ys[i]! - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) {
    throw new RangeError("linearFit: xs have zero variance — slope is undefined.");
  }

  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;

  // Residual sum of squares = syy - slope * sxy  (algebraic identity for OLS)
  const rss = Math.max(0, syy - slope * sxy);
  // R^2 = 1 - rss/syy.  If syy=0, ys are constant and r² is undefined.
  const r2 = syy === 0 ? Number.NaN : 1 - rss / syy;

  return { slope, intercept, r2, residualSumOfSquares: rss };
}

export function predict(fit: LinearFitResult, x: number): number {
  return fit.slope * x + fit.intercept;
}
