import { describe, expect, it } from "vitest";

import { analyticalMode, ftcsStep, integrate, stabilityRatio } from "../algorithm";

describe("ftcsStep", () => {
  it("preserves Dirichlet zero ends every step", () => {
    const u = [0, 0.2, 0.5, 0.7, 0.5, 0.2, 0];
    const next = ftcsStep({ u, alpha: 0.1, dx: 0.1, dt: 0.01 });
    expect(next[0]!).toBe(0);
    expect(next[next.length - 1]!).toBe(0);
  });

  it("for r=1/2 it is the discrete heat smoothing average", () => {
    // r = alpha*dt/dx^2 = 0.5 ⇒ u_new[i] = (u[i+1] + u[i-1])/2
    const alpha = 1;
    const dx = 1;
    const dt = 0.5;
    const u = [0, 1, 0, 1, 0];
    const next = ftcsStep({ u, alpha, dx, dt });
    expect(next[1]!).toBeCloseTo((0 + 0) / 2, 12);
    expect(next[2]!).toBeCloseTo((1 + 1) / 2, 12);
    expect(next[3]!).toBeCloseTo((0 + 0) / 2, 12);
  });

  it("RangeError on grids smaller than 3 points", () => {
    expect(() => ftcsStep({ u: [0, 0], alpha: 1, dx: 0.1, dt: 0.01 })).toThrow(
      RangeError,
    );
  });

  it("RangeError on non-positive alpha/dx/dt", () => {
    expect(() => ftcsStep({ u: [0, 1, 0], alpha: 0, dx: 0.1, dt: 0.01 })).toThrow(
      RangeError,
    );
    expect(() => ftcsStep({ u: [0, 1, 0], alpha: 1, dx: 0, dt: 0.01 })).toThrow(
      RangeError,
    );
    expect(() => ftcsStep({ u: [0, 1, 0], alpha: 1, dx: 0.1, dt: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("stabilityRatio", () => {
  it("equals alpha*dt/dx^2", () => {
    expect(stabilityRatio(1, 0.1, 0.005)).toBeCloseTo(0.5, 12);
    expect(stabilityRatio(0.5, 0.2, 0.04)).toBeCloseTo(0.5, 12);
  });
});

describe("analyticalMode", () => {
  it("at t=0, u(x,0) = sin(mπx/L) sampled on the grid; vanishes at endpoints", () => {
    const u = analyticalMode({ L: 1, alpha: 1, t: 0, nGrid: 11, mode: 1 });
    expect(u[0]!).toBeCloseTo(0, 12);
    expect(u[u.length - 1]!).toBeCloseTo(0, 12);
    // peak of mode 1 is at x=L/2 = index 5 with value sin(π/2)=1
    expect(u[5]!).toBeCloseTo(1, 12);
  });

  it("decays as exp(-alpha (mπ/L)^2 t)", () => {
    const u0 = analyticalMode({ L: 1, alpha: 1, t: 0, nGrid: 11, mode: 1 });
    const u1 = analyticalMode({ L: 1, alpha: 1, t: 0.05, nGrid: 11, mode: 1 });
    const decay = Math.exp(-1 * Math.PI * Math.PI * 0.05);
    expect(u1[5]!).toBeCloseTo(u0[5]! * decay, 12);
  });

  it("higher modes decay faster", () => {
    const m1 = analyticalMode({ L: 1, alpha: 1, t: 0.05, nGrid: 21, mode: 1 });
    const m3 = analyticalMode({ L: 1, alpha: 1, t: 0.05, nGrid: 21, mode: 3 });
    // mode-1 peak vs |mode-3 peak|
    const peak1 = Math.max(...m1.map(Math.abs));
    const peak3 = Math.max(...m3.map(Math.abs));
    expect(peak3).toBeLessThan(peak1);
  });

  it("RangeError on bad inputs", () => {
    expect(() => analyticalMode({ L: 0, alpha: 1, t: 0, nGrid: 5, mode: 1 })).toThrow(
      RangeError,
    );
    expect(() => analyticalMode({ L: 1, alpha: 1, t: 0, nGrid: 2, mode: 1 })).toThrow(
      RangeError,
    );
    expect(() => analyticalMode({ L: 1, alpha: 1, t: 0, nGrid: 5, mode: 0 })).toThrow(
      RangeError,
    );
    expect(() => analyticalMode({ L: 1, alpha: 1, t: -1, nGrid: 5, mode: 1 })).toThrow(
      RangeError,
    );
  });
});

describe("integrate — convergence to analytical mode", () => {
  it("FTCS evolution of the mode-1 initial condition matches the analytical decay", () => {
    const L = 1;
    const alpha = 1;
    const nGrid = 21;
    const dx = L / (nGrid - 1);
    // Stable: r = alpha*dt/dx^2 = 0.4
    const dt = (0.4 * dx * dx) / alpha;
    const nSteps = 200;
    const tEnd = nSteps * dt;
    const initial = analyticalMode({ L, alpha, t: 0, nGrid, mode: 1 });
    const numerical = integrate({ initial, alpha, dx, dt, nSteps });
    const reference = analyticalMode({ L, alpha, t: tEnd, nGrid, mode: 1 });
    // FTCS converges to the analytical solution; for these moderate
    // settings the L-infinity error should be well below 1e-3.
    let maxErr = 0;
    for (let i = 0; i < nGrid; i += 1) {
      maxErr = Math.max(maxErr, Math.abs(numerical[i]! - reference[i]!));
    }
    expect(maxErr).toBeLessThan(2e-3);
  });

  it("integrate(0 steps) returns the initial condition unchanged", () => {
    const initial = [0, 1, 2, 1, 0];
    const u = integrate({ initial, alpha: 1, dx: 0.1, dt: 0.001, nSteps: 0 });
    expect(u).toEqual(initial);
  });

  it("RangeError on negative or non-integer step count", () => {
    expect(() =>
      integrate({ initial: [0, 1, 0], alpha: 1, dx: 0.1, dt: 0.001, nSteps: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      integrate({ initial: [0, 1, 0], alpha: 1, dx: 0.1, dt: 0.001, nSteps: 1.5 }),
    ).toThrow(RangeError);
  });
});
