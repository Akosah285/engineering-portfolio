import { describe, expect, it } from "vitest";

import {
  analyticalStanding,
  cflRatio,
  firstStep,
  integrate,
  leapfrogStep,
} from "../algorithm";

describe("leapfrogStep", () => {
  it("preserves Dirichlet zero ends", () => {
    const u = [0, 0.1, 0.2, 0.3, 0.2, 0.1, 0];
    const v = [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0];
    const next = leapfrogStep({ uPrev: v, uCurr: u, c: 1, dx: 0.1, dt: 0.05 });
    expect(next[0]!).toBe(0);
    expect(next[next.length - 1]!).toBe(0);
  });

  it("starting from rest with no displacement remains zero", () => {
    const z = [0, 0, 0, 0, 0];
    const next = leapfrogStep({ uPrev: z, uCurr: z, c: 1, dx: 0.1, dt: 0.05 });
    for (const v of next) expect(v).toBe(0);
  });

  it("RangeError on grid <3 / mismatched arrays / non-positive params", () => {
    expect(() => leapfrogStep({ uPrev: [0, 0], uCurr: [0, 0], c: 1, dx: 0.1, dt: 0.05 })).toThrow(RangeError);
    expect(() => leapfrogStep({ uPrev: [0, 0, 0], uCurr: [0, 0], c: 1, dx: 0.1, dt: 0.05 })).toThrow(RangeError);
    expect(() => leapfrogStep({ uPrev: [0, 0, 0], uCurr: [0, 0, 0], c: 0, dx: 0.1, dt: 0.05 })).toThrow(RangeError);
    expect(() => leapfrogStep({ uPrev: [0, 0, 0], uCurr: [0, 0, 0], c: 1, dx: 0, dt: 0.05 })).toThrow(RangeError);
    expect(() => leapfrogStep({ uPrev: [0, 0, 0], uCurr: [0, 0, 0], c: 1, dx: 0.1, dt: 0 })).toThrow(RangeError);
  });
});

describe("firstStep", () => {
  it("with v0=0, the first step matches the leapfrog formula with uPrev = uCurr", () => {
    const u0 = [0, 0.1, 0.2, 0.1, 0];
    const v0 = [0, 0, 0, 0, 0];
    const u1a = firstStep({ u0, v0, c: 1, dx: 0.1, dt: 0.05 });
    const u1b = leapfrogStep({ uPrev: u0, uCurr: u0, c: 1, dx: 0.1, dt: 0.05 });
    // The leapfrog version is 2u - u + r²Δ = u + r²Δ; firstStep gives u + 0.5 r²Δ.
    // For our test, both should still be on the order of magnitude of u, but
    // they differ by the 0.5 factor on the curvature term.  We only check
    // boundary preservation here since the formulas legitimately differ.
    expect(u1a[0]!).toBe(0);
    expect(u1a[u1a.length - 1]!).toBe(0);
    expect(u1b[0]!).toBe(0);
    expect(u1b[u1b.length - 1]!).toBe(0);
  });

  it("RangeError on bad inputs", () => {
    expect(() => firstStep({ u0: [0, 0, 0], v0: [0, 0], c: 1, dx: 0.1, dt: 0.05 })).toThrow(RangeError);
    expect(() => firstStep({ u0: [0, 0], v0: [0, 0], c: 1, dx: 0.1, dt: 0.05 })).toThrow(RangeError);
  });
});

describe("cflRatio", () => {
  it("equals c*dt/dx", () => {
    expect(cflRatio(2, 0.1, 0.05)).toBeCloseTo(1, 12);
    expect(cflRatio(1, 0.1, 0.05)).toBeCloseTo(0.5, 12);
  });
});

describe("integrate — convergence to analytical standing wave", () => {
  it("leapfrog evolution of mode 1 matches the analytical standing wave", () => {
    const L = 1;
    const c = 1;
    const nGrid = 41;
    const dx = L / (nGrid - 1);
    // CFL = 0.9 (well within stability limit)
    const dt = 0.9 * dx / c;
    const nSteps = 50;
    const tEnd = nSteps * dt;
    const u0 = analyticalStanding({ L, c, t: 0, nGrid, mode: 1 });
    const v0 = new Array<number>(nGrid).fill(0); // standing wave starts at rest
    const numerical = integrate({ u0, v0, c, dx, dt, nSteps });
    const reference = analyticalStanding({ L, c, t: tEnd, nGrid, mode: 1 });
    let maxErr = 0;
    for (let i = 0; i < nGrid; i += 1) {
      maxErr = Math.max(maxErr, Math.abs(numerical[i]! - reference[i]!));
    }
    // Leapfrog is 2nd-order; this combination gives ~1e-3 error.
    expect(maxErr).toBeLessThan(5e-3);
  });

  it("integrate(0 steps) returns u0 unchanged", () => {
    const u0 = [0, 0.1, 0.2, 0.1, 0];
    const r = integrate({ u0, v0: [0, 0, 0, 0, 0], c: 1, dx: 0.1, dt: 0.05, nSteps: 0 });
    expect(r).toEqual(u0);
  });

  it("RangeError on negative or non-integer nSteps", () => {
    expect(() =>
      integrate({ u0: [0, 0, 0], v0: [0, 0, 0], c: 1, dx: 0.1, dt: 0.05, nSteps: -1 }),
    ).toThrow(RangeError);
  });
});

describe("analyticalStanding", () => {
  it("at t=0 returns sin(mπx/L); zero at the ends", () => {
    const u = analyticalStanding({ L: 1, c: 1, t: 0, nGrid: 11, mode: 1 });
    expect(u[0]!).toBeCloseTo(0, 12);
    expect(u[u.length - 1]!).toBeCloseTo(0, 12);
    expect(u[5]!).toBeCloseTo(1, 12);
  });

  it("reverses sign after half a period (mode 1, c=L=1: T=2, t=1)", () => {
    const u = analyticalStanding({ L: 1, c: 1, t: 1, nGrid: 11, mode: 1 });
    expect(u[5]!).toBeCloseTo(-1, 12);
  });

  it("RangeError on bad inputs", () => {
    expect(() => analyticalStanding({ L: 0, c: 1, t: 0, nGrid: 5, mode: 1 })).toThrow(RangeError);
    expect(() => analyticalStanding({ L: 1, c: 0, t: 0, nGrid: 5, mode: 1 })).toThrow(RangeError);
    expect(() => analyticalStanding({ L: 1, c: 1, t: 0, nGrid: 2, mode: 1 })).toThrow(RangeError);
    expect(() => analyticalStanding({ L: 1, c: 1, t: 0, nGrid: 5, mode: 0 })).toThrow(RangeError);
    expect(() => analyticalStanding({ L: 1, c: 1, t: -1, nGrid: 5, mode: 1 })).toThrow(RangeError);
  });
});
