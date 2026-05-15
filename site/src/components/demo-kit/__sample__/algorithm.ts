/**
 * Sample algorithm for the demo-kit pattern shakedown.
 *
 * The `algorithm.ts` extraction convention (plan §7.13) keeps the demo's
 * core math in one place — the React component imports both the function
 * (for execution) and the raw source (for display via <CodeReveal>) so
 * what runs is exactly what's shown.
 *
 * This file is intentionally tiny — its purpose is to verify the
 * `import source from "./algorithm.ts?raw"` pattern resolves at build.
 */

/**
 * One step of plain gradient descent on a single-variable function.
 *
 * @param x        Current position.
 * @param gradFn   Derivative f'(x).
 * @param lr       Learning rate.
 * @returns        The next x after one step.
 */
export function gradientDescentStep(
  x: number,
  gradFn: (x: number) => number,
  lr: number,
): number {
  return x - lr * gradFn(x);
}
