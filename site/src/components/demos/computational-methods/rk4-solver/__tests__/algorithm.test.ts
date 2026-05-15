import { describe, it, expect } from "vitest";
import { rk4Step, rk4Integrate, type DerivativeFn } from "../algorithm";

describe("rk4Step", () => {
  it("integrates the scalar exponential decay y' = -y to the analytic solution", () => {
    // y(0) = 1, exact y(0.1) = e^{-0.1} ≈ 0.9048374
    const f: DerivativeFn = (_t, y) => [-y[0]!];
    const next = rk4Step({ f, t: 0, y: [1], dt: 0.1 });
    expect(next[0]).toBeCloseTo(Math.exp(-0.1), 6);
  });

  it("is exact for a constant derivative (f = 1)", () => {
    const f: DerivativeFn = () => [1];
    const next = rk4Step({ f, t: 0, y: [0], dt: 0.5 });
    expect(next[0]).toBeCloseTo(0.5, 12);
  });

  it("is exact for a linear-in-t derivative f = t (RK4 is exact for polynomials of order ≤4)", () => {
    // y' = t, y(0) = 0 ⇒ y(dt) = dt²/2
    const f: DerivativeFn = (t) => [t];
    const next = rk4Step({ f, t: 0, y: [0], dt: 0.4 });
    expect(next[0]).toBeCloseTo(0.08, 12);
  });

  it("integrates a 2D harmonic oscillator (x' = v, v' = -x) within ~1e-5 over one step", () => {
    // Exact: x(t)=cos(t), v(t)=-sin(t).  Single-step local truncation error
    // for RK4 is O(dt^5) ≈ 1e-5 at dt=0.1.
    const f: DerivativeFn = (_t, y) => [y[1]!, -y[0]!];
    const next = rk4Step({ f, t: 0, y: [1, 0], dt: 0.1 });
    expect(next[0]).toBeCloseTo(Math.cos(0.1), 5);
    expect(next[1]).toBeCloseTo(-Math.sin(0.1), 5);
  });

  it("throws RangeError on non-positive dt", () => {
    const f: DerivativeFn = () => [0];
    expect(() => rk4Step({ f, t: 0, y: [0], dt: 0 })).toThrow(RangeError);
    expect(() => rk4Step({ f, t: 0, y: [0], dt: -0.1 })).toThrow(RangeError);
  });

  it("throws RangeError on non-finite dt", () => {
    const f: DerivativeFn = () => [0];
    expect(() => rk4Step({ f, t: 0, y: [0], dt: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => rk4Step({ f, t: 0, y: [0], dt: Number.NaN })).toThrow(RangeError);
  });

  it("throws RangeError when f returns a wrong-length vector", () => {
    const f: DerivativeFn = () => [0, 0]; // returns length-2 for length-1 state
    expect(() => rk4Step({ f, t: 0, y: [0], dt: 0.1 })).toThrow(RangeError);
  });
});

describe("rk4Integrate", () => {
  it("returns a trajectory whose first point is exactly the initial condition", () => {
    const f: DerivativeFn = (_t, y) => [-y[0]!];
    const traj = rk4Integrate({ f, t0: 0, y0: [1], tEnd: 1, dt: 0.1 });
    expect(traj[0]).toEqual({ t: 0, y: [1] });
  });

  it("integrates y' = -y across [0,1] to within 1e-8 of e^{-1} at dt=0.01", () => {
    const f: DerivativeFn = (_t, y) => [-y[0]!];
    const traj = rk4Integrate({ f, t0: 0, y0: [1], tEnd: 1, dt: 0.01 });
    const last = traj[traj.length - 1]!;
    expect(last.t).toBeCloseTo(1, 12);
    expect(last.y[0]).toBeCloseTo(Math.exp(-1), 8);
  });

  it("conserves energy of a harmonic oscillator to ~1e-5 over one period", () => {
    // x' = v, v' = -x.  Energy E = (x² + v²)/2 should stay ≈ 0.5.
    // Pick dt so 2π/dt is an integer number of steps; otherwise the loop
    // stops short of one full period and v(end) is not ≈ 0.
    const f: DerivativeFn = (_t, y) => [y[1]!, -y[0]!];
    const N = 1000;
    const tEnd = 2 * Math.PI;
    const dt = tEnd / N;
    const traj = rk4Integrate({ f, t0: 0, y0: [1, 0], tEnd, dt });
    const last = traj[traj.length - 1]!;
    const energy = (last.y[0]! ** 2 + last.y[1]! ** 2) / 2;
    expect(energy).toBeCloseTo(0.5, 5);
    expect(last.y[0]).toBeCloseTo(1, 5);
    expect(last.y[1]).toBeCloseTo(0, 5);
  });

  it("supports the 3D Lorenz system without exploding (sigma=10, rho=28, beta=8/3)", () => {
    // Integration smoke test: bounded after 2 seconds, finite values.
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 3;
    const f: DerivativeFn = (_t, y) => [
      sigma * (y[1]! - y[0]!),
      y[0]! * (rho - y[2]!) - y[1]!,
      y[0]! * y[1]! - beta * y[2]!,
    ];
    const traj = rk4Integrate({ f, t0: 0, y0: [1, 1, 1], tEnd: 2, dt: 0.001 });
    const last = traj[traj.length - 1]!;
    expect(traj.length).toBe(2001);
    for (const v of last.y) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(100); // attractor lives in roughly |x|<30
    }
  });

  it("returns a single-point trajectory when tEnd === t0", () => {
    const f: DerivativeFn = (_t, y) => [-y[0]!];
    const traj = rk4Integrate({ f, t0: 0, y0: [5], tEnd: 0, dt: 0.1 });
    expect(traj).toEqual([{ t: 0, y: [5] }]);
  });

  it("throws RangeError when tEnd < t0", () => {
    const f: DerivativeFn = () => [0];
    expect(() => rk4Integrate({ f, t0: 1, y0: [0], tEnd: 0, dt: 0.1 })).toThrow(RangeError);
  });

  it("throws RangeError on non-finite t0 or tEnd", () => {
    const f: DerivativeFn = () => [0];
    expect(() => rk4Integrate({ f, t0: 0, y0: [0], tEnd: Number.POSITIVE_INFINITY, dt: 0.1 }))
      .toThrow(RangeError);
    expect(() => rk4Integrate({ f, t0: Number.NaN, y0: [0], tEnd: 1, dt: 0.1 })).toThrow(RangeError);
  });
});
