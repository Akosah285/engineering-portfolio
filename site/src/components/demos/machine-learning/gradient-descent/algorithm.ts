/**
 * Gradient descent algorithm — pure functions, demo-extracted (#24).
 *
 * Imported twice by the visualization component:
 *   1. As a module (`import { gradientDescentStep } from "./algorithm"`)
 *      to actually run the iteration each frame.
 *   2. As raw text (`import code from "./algorithm.ts?raw"`) to display
 *      via <CodeReveal>. Single source of truth: what runs IS what is shown.
 *
 * State is two-dimensional: position (x, y) plus velocity (vx, vy) for
 * the momentum term. Surfaces supply loss(x, y) and grad(x, y).
 */

export interface DescentState {
  x: number;
  y: number;
  /** Velocity components — used for momentum. Zero initialises a fresh start. */
  vx: number;
  vy: number;
}

export interface DescentOptions {
  /** Learning rate (η). Typical range: 1e-4 .. 0.5. */
  lr: number;
  /** Momentum coefficient (β). Range: 0 (vanilla GD) .. 0.99. */
  momentum: number;
}

export type LossFn = (x: number, y: number) => number;
export type GradFn = (x: number, y: number) => readonly [number, number];

/**
 * Take one momentum-augmented gradient-descent step on a 2D loss surface.
 *
 *   v_t   = β · v_{t-1} − η · ∇L(x_{t-1})
 *   x_t   = x_{t-1} + v_t
 *
 * Returns a fresh state object — never mutates `state`.
 */
export function gradientDescentStep(
  state: DescentState,
  grad: GradFn,
  opts: DescentOptions,
): DescentState {
  const [gx, gy] = grad(state.x, state.y);
  const vx = opts.momentum * state.vx - opts.lr * gx;
  const vy = opts.momentum * state.vy - opts.lr * gy;
  return {
    x: state.x + vx,
    y: state.y + vy,
    vx,
    vy,
  };
}

/**
 * Detect convergence by gradient magnitude. Returns true when
 * ‖∇L(x, y)‖₂ falls below `threshold`.
 */
export function isConverged(
  state: DescentState,
  grad: GradFn,
  threshold = 1e-4,
): boolean {
  const [gx, gy] = grad(state.x, state.y);
  return Math.hypot(gx, gy) < threshold;
}

/**
 * Run up to `maxSteps` iterations from `start`, stopping early on
 * convergence. Returns the full trajectory including the start point.
 */
export function runDescent(
  start: DescentState,
  grad: GradFn,
  opts: DescentOptions,
  maxSteps: number,
  threshold = 1e-4,
): DescentState[] {
  const trajectory: DescentState[] = [start];
  let cur = start;
  for (let i = 0; i < maxSteps; i += 1) {
    if (isConverged(cur, grad, threshold)) break;
    cur = gradientDescentStep(cur, grad, opts);
    trajectory.push(cur);
    // Bail out on divergence (NaN / Infinity)
    if (!Number.isFinite(cur.x) || !Number.isFinite(cur.y)) break;
  }
  return trajectory;
}
