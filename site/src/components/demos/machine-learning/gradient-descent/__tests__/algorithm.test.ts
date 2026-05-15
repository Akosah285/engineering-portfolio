import { describe, expect, it } from "vitest";
import {
  gradientDescentStep,
  isConverged,
  runDescent,
  type DescentState,
  type GradFn,
} from "../algorithm";

// ∇L for L(x, y) = x² + y² → (2x, 2y) — used by most tests
const quadGrad: GradFn = (x, y) => [2 * x, 2 * y] as const;

describe("gradientDescentStep", () => {
  it("moves toward the minimum on a quadratic bowl (no momentum)", () => {
    const start: DescentState = { x: 1, y: -1, vx: 0, vy: 0 };
    const next = gradientDescentStep(start, quadGrad, { lr: 0.1, momentum: 0 });
    // step is x ← x − η·2x → 1 − 0.1·2 = 0.8
    expect(next.x).toBeCloseTo(0.8, 10);
    expect(next.y).toBeCloseTo(-0.8, 10);
  });

  it("accumulates velocity with momentum > 0", () => {
    const s0: DescentState = { x: 1, y: 0, vx: 0, vy: 0 };
    const s1 = gradientDescentStep(s0, quadGrad, { lr: 0.1, momentum: 0.9 });
    const s2 = gradientDescentStep(s1, quadGrad, { lr: 0.1, momentum: 0.9 });
    // |s2.vx| should be larger than |s1.vx| because momentum carries velocity
    expect(Math.abs(s2.vx)).toBeGreaterThan(Math.abs(s1.vx));
  });

  it("returns a fresh state object — does not mutate input", () => {
    const start: DescentState = { x: 1, y: 1, vx: 0, vy: 0 };
    const before = { ...start };
    gradientDescentStep(start, quadGrad, { lr: 0.1, momentum: 0 });
    expect(start).toEqual(before);
  });

  it("is a no-op (mathematically) at a stationary point with zero velocity", () => {
    const stationary: DescentState = { x: 0, y: 0, vx: 0, vy: 0 };
    const next = gradientDescentStep(stationary, quadGrad, {
      lr: 0.5,
      momentum: 0.9,
    });
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  it("with momentum=1 and zero gradient, velocity carries the iterate forward", () => {
    const s: DescentState = { x: 0, y: 0, vx: 0.3, vy: -0.2 };
    const next = gradientDescentStep(s, quadGrad, { lr: 0.1, momentum: 1.0 });
    expect(next.x).toBeCloseTo(0.3, 10);
    expect(next.y).toBeCloseTo(-0.2, 10);
  });

  it("supports negative-x positions (sign correctness)", () => {
    const s: DescentState = { x: -2, y: 0, vx: 0, vy: 0 };
    const next = gradientDescentStep(s, quadGrad, { lr: 0.1, momentum: 0 });
    // grad = (2·-2, 0) = (-4, 0); step = x − η·gx = -2 − 0.1·(-4) = -1.6
    expect(next.x).toBeCloseTo(-1.6, 10);
  });
});

describe("isConverged", () => {
  it("is true at the minimum of the quadratic bowl", () => {
    const s: DescentState = { x: 0, y: 0, vx: 0, vy: 0 };
    expect(isConverged(s, quadGrad)).toBe(true);
  });

  it("is false far from the minimum", () => {
    const s: DescentState = { x: 1, y: 1, vx: 0, vy: 0 };
    expect(isConverged(s, quadGrad)).toBe(false);
  });

  it("respects a custom threshold", () => {
    // grad at (0.01, 0) = (0.02, 0), |grad| = 0.02
    const s: DescentState = { x: 0.01, y: 0, vx: 0, vy: 0 };
    expect(isConverged(s, quadGrad, 0.01)).toBe(false);
    expect(isConverged(s, quadGrad, 0.05)).toBe(true);
  });
});

describe("runDescent", () => {
  it("returns the start state plus iterations", () => {
    const start: DescentState = { x: 1, y: 1, vx: 0, vy: 0 };
    const traj = runDescent(start, quadGrad, { lr: 0.1, momentum: 0 }, 10);
    expect(traj.length).toBe(11); // start + 10 steps
    expect(traj[0]).toEqual(start);
  });

  it("converges for a well-conditioned bowl + small lr", () => {
    const start: DescentState = { x: 1, y: 1, vx: 0, vy: 0 };
    const traj = runDescent(
      start,
      quadGrad,
      { lr: 0.1, momentum: 0 },
      500,
      1e-6,
    );
    const last = traj[traj.length - 1]!;
    expect(Math.hypot(last.x, last.y)).toBeLessThan(1e-3);
  });

  it("stops early on convergence", () => {
    const startNearMin: DescentState = { x: 1e-6, y: 1e-6, vx: 0, vy: 0 };
    const traj = runDescent(
      startNearMin,
      quadGrad,
      { lr: 0.1, momentum: 0 },
      1000,
      1e-3,
    );
    expect(traj.length).toBeLessThan(5);
  });

  it("bails out on divergence (NaN/Infinity from oversize lr)", () => {
    const start: DescentState = { x: 1e305, y: 0, vx: 0, vy: 0 };
    // Starting near the float64 ceiling + lr=10 makes the next step Infinity.
    const traj = runDescent(start, quadGrad, { lr: 10, momentum: 0 }, 100);
    const last = traj[traj.length - 1]!;
    expect(Number.isFinite(last.x) && Number.isFinite(last.y)).toBe(false);
    expect(traj.length).toBeLessThan(50);
  });

  it("converges faster with momentum on a long flat valley", () => {
    // Use a stretched bowl L = 0.01·x² + y²
    const stretched: GradFn = (x, y) => [0.02 * x, 2 * y] as const;
    const start: DescentState = { x: 5, y: 0.1, vx: 0, vy: 0 };

    const trajVanilla = runDescent(
      start,
      stretched,
      { lr: 0.1, momentum: 0 },
      400,
      1e-3,
    );
    const trajMomentum = runDescent(
      start,
      stretched,
      { lr: 0.1, momentum: 0.9 },
      400,
      1e-3,
    );
    expect(trajMomentum.length).toBeLessThan(trajVanilla.length);
  });
});
