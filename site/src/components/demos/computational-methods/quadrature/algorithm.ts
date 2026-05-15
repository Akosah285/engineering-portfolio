/**
 * quadrature — pure 1D numerical integration rules (#79).
 *
 * Each rule is a small function so the React shell can run all four against
 * the same input and overlay convergence curves. We support a > b (the
 * integral negates, the standard convention).
 */

export interface IntegrationInput {
  readonly f: (x: number) => number;
  readonly a: number;
  readonly b: number;
  /** Number of subintervals. Simpson's rule requires this to be even. */
  readonly n: number;
}

function checkN(n: number, name: string): void {
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new RangeError(`${name}: n must be a positive integer.`);
  }
}

export function rectangleRule(input: IntegrationInput): number {
  checkN(input.n, "rectangleRule");
  const { f, a, b, n } = input;
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += f(a + i * h);
  }
  return sum * h;
}

export function midpointRule(input: IntegrationInput): number {
  checkN(input.n, "midpointRule");
  const { f, a, b, n } = input;
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += f(a + (i + 0.5) * h);
  }
  return sum * h;
}

export function trapezoidRule(input: IntegrationInput): number {
  checkN(input.n, "trapezoidRule");
  const { f, a, b, n } = input;
  const h = (b - a) / n;
  let sum = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i += 1) {
    sum += f(a + i * h);
  }
  return sum * h;
}

export function simpsonRule(input: IntegrationInput): number {
  checkN(input.n, "simpsonRule");
  if (input.n % 2 !== 0) {
    throw new RangeError("simpsonRule: n must be even.");
  }
  const { f, a, b, n } = input;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i += 1) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (sum * h) / 3;
}
