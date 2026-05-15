import { describe, it, expect } from "vitest";
import {
  steadyStateOmega,
  omegaAt,
  thetaAt,
  settlingTime,
  trajectory,
} from "../algorithm";

const MOTOR = { Km: 10, tauM: 0.5 } as const;

describe("steadyStateOmega", () => {
  it("returns Km · V at the given voltage", () => {
    expect(steadyStateOmega(MOTOR, 12)).toBeCloseTo(120, 12);
  });

  it("preserves the sign of the voltage", () => {
    expect(steadyStateOmega(MOTOR, -6)).toBeCloseTo(-60, 12);
  });

  it("throws on non-finite voltage", () => {
    expect(() => steadyStateOmega(MOTOR, Number.NaN)).toThrow(RangeError);
  });

  it("throws on non-positive Km or tauM", () => {
    expect(() => steadyStateOmega({ Km: 0, tauM: 1 }, 1)).toThrow(RangeError);
    expect(() => steadyStateOmega({ Km: 1, tauM: -1 }, 1)).toThrow(RangeError);
  });
});

describe("omegaAt", () => {
  it("equals omega0 at t=0", () => {
    expect(omegaAt({ motor: MOTOR, voltage: 5, omega0: 7 }, 0)).toBeCloseTo(7, 12);
  });

  it("starts at 0 when omega0 is unspecified", () => {
    expect(omegaAt({ motor: MOTOR, voltage: 5 }, 0)).toBeCloseTo(0, 12);
  });

  it("approaches steady state Km·V as t → ∞", () => {
    const omega = omegaAt({ motor: MOTOR, voltage: 5 }, 50); // many time constants
    expect(omega).toBeCloseTo(50, 6);
  });

  it("hits exactly (1 − e^{-1}) ≈ 63.2% of ω_ss at one time constant", () => {
    const omega = omegaAt({ motor: MOTOR, voltage: 10 }, MOTOR.tauM);
    const omega_ss = 10 * MOTOR.Km;
    expect(omega).toBeCloseTo(omega_ss * (1 - Math.exp(-1)), 9);
  });

  it("monotonically increasing on a step from rest with positive V", () => {
    const ts = [0.1, 0.2, 0.3, 0.4, 0.5];
    const omegas = ts.map((t) => omegaAt({ motor: MOTOR, voltage: 5 }, t));
    for (let i = 1; i < omegas.length; i += 1) {
      expect(omegas[i]!).toBeGreaterThan(omegas[i - 1]!);
    }
  });

  it("throws on negative or non-finite t", () => {
    expect(() => omegaAt({ motor: MOTOR, voltage: 5 }, -0.1)).toThrow(RangeError);
    expect(() => omegaAt({ motor: MOTOR, voltage: 5 }, Number.NaN)).toThrow(RangeError);
  });
});

describe("thetaAt", () => {
  it("equals theta0 at t=0", () => {
    expect(thetaAt({ motor: MOTOR, voltage: 5, theta0: 1.5 }, 0)).toBeCloseTo(1.5, 12);
  });

  it("for very large t, θ ≈ ω_ss·t − ω_ss·τ (linear ramp shifted by τ)", () => {
    const t = 100;
    const omega_ss = 5 * MOTOR.Km;
    const expected = omega_ss * t - omega_ss * MOTOR.tauM;
    expect(thetaAt({ motor: MOTOR, voltage: 5 }, t)).toBeCloseTo(expected, 4);
  });

  it("matches numerical integration of omega(t) for a moderate interval", () => {
    // Trapezoid integration of omega(t) over [0, 1] with 1000 panels.
    // Trapezoid has O(h²) error, so 4-decimal agreement is the right target.
    const motor = MOTOR;
    const N = 1000;
    const dt = 1 / N;
    let approx = 0;
    let prev = omegaAt({ motor, voltage: 5 }, 0);
    for (let i = 1; i <= N; i += 1) {
      const t = i * dt;
      const curr = omegaAt({ motor, voltage: 5 }, t);
      approx += 0.5 * (prev + curr) * dt;
      prev = curr;
    }
    expect(thetaAt({ motor, voltage: 5 }, 1)).toBeCloseTo(approx, 4);
  });
});

describe("settlingTime", () => {
  it("equals -τ · ln(ε); for ε=0.02 ≈ 3.912·τ", () => {
    expect(settlingTime(MOTOR, 0.02)).toBeCloseTo(MOTOR.tauM * Math.log(50), 12);
    expect(settlingTime(MOTOR, 0.02)).toBeCloseTo(MOTOR.tauM * 3.912, 3);
  });

  it("equals τ when ε = 1/e ≈ 0.368", () => {
    expect(settlingTime(MOTOR, Math.exp(-1))).toBeCloseTo(MOTOR.tauM, 12);
  });

  it("throws when epsilon is outside (0, 1)", () => {
    expect(() => settlingTime(MOTOR, 0)).toThrow(RangeError);
    expect(() => settlingTime(MOTOR, 1)).toThrow(RangeError);
    expect(() => settlingTime(MOTOR, 1.5)).toThrow(RangeError);
  });
});

describe("trajectory", () => {
  it("returns the requested number of samples spanning [0, tEnd]", () => {
    const traj = trajectory({ motor: MOTOR, voltage: 5 }, 2, 21);
    expect(traj).toHaveLength(21);
    expect(traj[0]!.t).toBe(0);
    expect(traj[20]!.t).toBeCloseTo(2, 12);
    expect(traj[0]!.omega).toBeCloseTo(0, 12);
    // Final omega should be close to but not equal to steady state at t=2 (4τ)
    expect(traj[20]!.omega).toBeLessThan(50);
    expect(traj[20]!.omega).toBeGreaterThan(45);
  });

  it("throws on samples < 2 or non-integer samples", () => {
    expect(() => trajectory({ motor: MOTOR, voltage: 5 }, 1, 1)).toThrow(RangeError);
    expect(() => trajectory({ motor: MOTOR, voltage: 5 }, 1, 1.5)).toThrow(RangeError);
  });

  it("throws on negative tEnd", () => {
    expect(() => trajectory({ motor: MOTOR, voltage: 5 }, -1, 10)).toThrow(RangeError);
  });
});
