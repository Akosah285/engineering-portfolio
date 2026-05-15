/**
 * Polynomial regression with optional Ridge (L2) / Lasso (L1) regularization.
 *
 * Pure module — no DOM, no React, no random globals. Deterministic given
 * inputs (RNG is seeded). This is the algorithm half of the
 * <PolynomialRegression> demo and is what <CodeReveal> displays
 * (per plan §7.9 — algorithm-centric demos default ON).
 *
 * Math reference (concise):
 *
 *   OLS    : minimize ||y - Xβ||²
 *            β = (XᵀX)⁻¹ Xᵀy
 *
 *   Ridge  : minimize ||y - Xβ||² + λ Σ_{j>=1} β_j²
 *            β = (XᵀX + λI')⁻¹ Xᵀy   where I' has 0 in position [0,0]
 *            (intercept is not penalised)
 *
 *   Lasso  : minimize (1/2n) ||y - Xβ||² + λ Σ_{j>=1} |β_j|
 *            Solved via cyclic coordinate descent with soft-thresholding.
 *            Intercept fitted analytically (mean of residuals).
 *
 * For the demo's data sizes (degree ≤ 15, n ≤ ~200), naive Gaussian
 * elimination on a (degree+1) × (degree+1) matrix is fast and clear.
 */

export type Regularization =
  | { type: "none"; lambda: 0 }
  | { type: "ridge"; lambda: number }
  | { type: "lasso"; lambda: number };

/**
 * Evaluate a polynomial at x using Horner's method.
 *
 * coeffs[i] is the coefficient of x^i, so:
 *   evaluatePolynomial([a, b, c], x) = a + b*x + c*x^2
 */
export function evaluatePolynomial(coeffs: readonly number[], x: number): number {
  if (coeffs.length === 0) return 0;
  let acc = coeffs[coeffs.length - 1]!;
  for (let i = coeffs.length - 2; i >= 0; i--) {
    acc = acc * x + coeffs[i]!;
  }
  return acc;
}

/**
 * Mean squared error between two equal-length arrays.
 */
export function meanSquaredError(
  predicted: readonly number[],
  actual: readonly number[],
): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return 0;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    const d = predicted[i]! - actual[i]!;
    sum += d * d;
  }
  return sum / predicted.length;
}

/**
 * Build the Vandermonde-style design matrix:
 *   X[i] = [1, x_i, x_i^2, ..., x_i^degree]
 */
function buildDesignMatrix(xs: readonly number[], degree: number): number[][] {
  const n = xs.length;
  const cols = degree + 1;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(cols);
    let pow = 1;
    for (let j = 0; j < cols; j++) {
      row[j] = pow;
      pow *= xs[i]!;
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Solve a square linear system Ax = b using Gaussian elimination with
 * partial pivoting. Returns x; throws on a singular matrix (which the
 * demo guards against by ensuring lambda > 0 when the problem is
 * underdetermined).
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]!]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(augmented[i]?.[i]!);
    for (let k = i + 1; k < n; k++) {
      const v = Math.abs(augmented[k]?.[i]!);
      if (v > maxVal) {
        maxVal = v;
        maxRow = k;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error("Singular matrix in solveLinearSystem");
    }
    if (maxRow !== i) {
      [augmented[i], augmented[maxRow]] = [augmented[maxRow]!, augmented[i]!];
    }

    const pivot = augmented[i]?.[i]!;
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k]?.[i]! / pivot;
      for (let j = i; j <= n; j++) {
        augmented[k]![j]! -= factor * augmented[i]?.[j]!;
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i]?.[n]!;
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i]?.[j]! * x[j]!;
    }
    x[i] = sum / augmented[i]?.[i]!;
  }
  return x;
}

/**
 * Multiply Xᵀ X (gram matrix). X is n×p, returns p×p.
 */
function gramMatrix(X: readonly number[][]): number[][] {
  const n = X.length;
  const p = X[0]?.length;
  const G: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k]?.[i]! * X[k]?.[j]!;
      }
      G[i]![j] = sum;
    }
  }
  return G;
}

/**
 * Multiply Xᵀ y. X is n×p, y is n; returns length p.
 */
function transposeTimesVector(X: readonly number[][], y: readonly number[]): number[] {
  const n = X.length;
  const p = X[0]?.length;
  const out = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += X[i]?.[j]! * y[i]!;
    }
    out[j] = sum;
  }
  return out;
}

/**
 * Soft-threshold operator used by Lasso coordinate descent:
 *   soft(z, γ) = sign(z) * max(|z| - γ, 0)
 */
function softThreshold(z: number, gamma: number): number {
  if (z > gamma) return z - gamma;
  if (z < -gamma) return z + gamma;
  return 0;
}

/**
 * Fit a polynomial of given degree to (xs, ys) under the given regularization.
 *
 * Returns coefficients [c_0, c_1, ..., c_degree] in ascending power order.
 */
export function fitPolynomial(
  xs: readonly number[],
  ys: readonly number[],
  degree: number,
  regularization: Regularization,
): number[] {
  if (xs.length !== ys.length) {
    throw new Error("xs and ys must have the same length");
  }
  if (degree < 0) throw new Error("degree must be >= 0");

  const X = buildDesignMatrix(xs, degree);

  if (regularization.type === "lasso") {
    return fitLasso(X, ys, regularization.lambda);
  }

  // OLS or Ridge — both reduce to a single linear solve.
  const G = gramMatrix(X);
  const Xty = transposeTimesVector(X, ys);

  if (regularization.type === "ridge" && regularization.lambda > 0) {
    // Add λ to the diagonal of G except position [0,0] (don't penalise intercept)
    for (let i = 1; i < G.length; i++) {
      G[i]![i]! += regularization.lambda;
    }
  }

  return solveLinearSystem(G, Xty);
}

/**
 * Lasso fit via cyclic coordinate descent with soft-thresholding.
 * Intercept (β_0) is NOT penalised; we fit it analytically each pass.
 */
function fitLasso(
  X: readonly number[][],
  y: readonly number[],
  lambda: number,
): number[] {
  const n = X.length;
  const p = X[0]?.length;
  const beta = new Array<number>(p).fill(0);

  // Pre-compute column norms for the coordinate-descent updates.
  const colNormSq = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += X[i]?.[j]! * X[i]?.[j]!;
    }
    colNormSq[j] = s;
  }

  // Residuals = y - Xβ  (initially y, since β=0)
  const residuals = [...y];

  const maxIter = 500;
  const tol = 1e-7;
  const nLambda = n * lambda;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;
    for (let j = 0; j < p; j++) {
      const oldBeta = beta[j]!;
      const norm = colNormSq[j]!;
      if (norm < 1e-12) continue;

      // ρ_j = Xᵀ_j · (residuals + X_j · β_j) = Xᵀ_j · residuals + ||X_j||² β_j
      let rho = 0;
      for (let i = 0; i < n; i++) {
        rho += X[i]?.[j]! * residuals[i]!;
      }
      rho += norm * oldBeta;

      let newBeta: number;
      if (j === 0) {
        // Don't penalise intercept
        newBeta = rho / norm;
      } else {
        newBeta = softThreshold(rho, nLambda) / norm;
      }

      const delta = newBeta - oldBeta;
      if (delta !== 0) {
        // Update residuals: residuals -= X_j * delta
        for (let i = 0; i < n; i++) {
          residuals[i]! -= X[i]?.[j]! * delta;
        }
        beta[j] = newBeta;
        if (Math.abs(delta) > maxChange) maxChange = Math.abs(delta);
      }
    }
    if (maxChange < tol) break;
  }

  return beta;
}

/**
 * Mulberry32 — small, well-distributed seedable PRNG (32-bit state).
 * Produces values in [0, 1).
 */
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
 * Box-Muller transform: two uniforms → one standard normal.
 */
function gauss(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Underlying truth function used by the demo's noisy dataset.
 * Smooth, non-monotonic — gives sensible behaviour for degrees 2..6 and
 * lets higher degrees overfit visibly.
 */
export function truthFunction(x: number): number {
  return Math.sin(2.5 * x) + 0.4 * x;
}

export interface NoisyDataConfig {
  seed: number;
  n: number;
  noise: number;
}

export interface NoisyData {
  xs: number[];
  ys: number[];
}

/**
 * Generate a synthetic dataset: `n` points evenly spaced over [-1, 1]
 * with truth = truthFunction(x) + Normal(0, noise²).
 *
 * Deterministic given seed.
 */
export function generateNoisyData(config: NoisyDataConfig): NoisyData {
  const { seed, n, noise } = config;
  const rand = mulberry32(seed);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -1 + (2 * i) / (n - 1);
    xs.push(x);
    const y = truthFunction(x) + (noise === 0 ? 0 : noise * gauss(rand));
    ys.push(y);
  }
  return { xs, ys };
}

export interface BestDegreeOptions {
  degrees: readonly number[];
  regularization: Regularization;
}

export interface BestDegreeResult {
  bestDegree: number;
  scores: number[];
}

/**
 * Pick the best polynomial degree for a dataset using the Bayesian
 * Information Criterion (BIC):
 *   BIC = n * ln(MSE) + k * ln(n)
 * where k = degree + 1. Lower BIC is better. BIC penalises higher-degree
 * fits, so we prefer simpler models when MSE is comparable.
 */
export function selectBestDegree(
  xs: readonly number[],
  ys: readonly number[],
  options: BestDegreeOptions,
): BestDegreeResult {
  const n = xs.length;
  const scores: number[] = [];
  let bestDegree = options.degrees[0]!;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const degree of options.degrees) {
    const coeffs = fitPolynomial(xs, ys, degree, options.regularization);
    const predicted = xs.map((x) => evaluatePolynomial(coeffs, x));
    const mse = Math.max(meanSquaredError(predicted, ys), 1e-12);
    const k = degree + 1;
    const bic = n * Math.log(mse) + k * Math.log(n);
    scores.push(bic);
    if (bic < bestScore) {
      bestScore = bic;
      bestDegree = degree;
    }
  }

  return { bestDegree, scores };
}
