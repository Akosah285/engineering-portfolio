import { describe, it, expect } from "vitest";
import { complementaryFilter, fuseHeading } from "../algorithm";

describe("complementaryFilter", () => {
  it("α = 1 → pure gyro integration", () => {
    const r = complementaryFilter({
      alpha: 1,
      dt: 0.1,
      omegaGyro: [0, 1, 1, 1, 1],
      thetaAcc: [0, 0, 0, 0, 0],
      theta0: 0,
    });
    // θ accumulates +1 * 0.1 = 0.1 per step.
    expect(r.thetaFused[4]!).toBeCloseTo(0.4, 10);
  });

  it("α = 0 → pure accelerometer (each step exactly thetaAcc[k])", () => {
    const r = complementaryFilter({
      alpha: 0,
      dt: 0.1,
      omegaGyro: [10, 10, 10, 10],
      thetaAcc: [0.1, 0.2, 0.3, 0.4],
    });
    expect(r.thetaFused[1]!).toBeCloseTo(0.2, 10);
    expect(r.thetaFused[3]!).toBeCloseTo(0.4, 10);
  });

  it("starts at theta0 if provided, else thetaAcc[0]", () => {
    const r1 = complementaryFilter({
      alpha: 0.9,
      dt: 0.1,
      omegaGyro: [0, 0],
      thetaAcc: [0.5, 0.5],
    });
    expect(r1.thetaFused[0]!).toBe(0.5);
    const r2 = complementaryFilter({
      alpha: 0.9,
      dt: 0.1,
      omegaGyro: [0, 0],
      thetaAcc: [0.5, 0.5],
      theta0: 1.0,
    });
    expect(r2.thetaFused[0]!).toBe(1.0);
  });

  it("removes gyro drift in steady-state when accelerometer is correct", () => {
    // Gyro has +1 deg/s bias; accelerometer reports true 0 angle.
    const dt = 0.01;
    const N = 5000;
    const omega = new Array<number>(N).fill(0.0174533); // 1 deg/s drift
    const acc = new Array<number>(N).fill(0);
    const r = complementaryFilter({
      alpha: 0.98,
      dt,
      omegaGyro: omega,
      thetaAcc: acc,
      theta0: 0,
    });
    // Steady-state: bias drift suppressed by accelerometer reference.
    // For complementary filter with constant gyro bias b and zero acc:
    //   θ_ss = α b dt / (1 - α)
    const expected = (0.98 * 0.0174533 * dt) / (1 - 0.98);
    expect(r.thetaFused[N - 1]!).toBeCloseTo(expected, 4);
  });

  it("RangeError on mismatched lengths", () => {
    expect(() =>
      complementaryFilter({
        alpha: 0.9,
        dt: 0.1,
        omegaGyro: [0, 0],
        thetaAcc: [0, 0, 0],
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on alpha out of [0, 1]", () => {
    expect(() =>
      complementaryFilter({
        alpha: 1.5,
        dt: 0.1,
        omegaGyro: [0],
        thetaAcc: [0],
      }),
    ).toThrow(RangeError);
    expect(() =>
      complementaryFilter({
        alpha: -0.1,
        dt: 0.1,
        omegaGyro: [0],
        thetaAcc: [0],
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on dt <= 0", () => {
    expect(() =>
      complementaryFilter({
        alpha: 0.5,
        dt: 0,
        omegaGyro: [0],
        thetaAcc: [0],
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on empty input", () => {
    expect(() =>
      complementaryFilter({
        alpha: 0.5,
        dt: 0.1,
        omegaGyro: [],
        thetaAcc: [],
      }),
    ).toThrow(RangeError);
  });
});

describe("fuseHeading", () => {
  it("α = 0 → pure encoder heading", () => {
    const r = fuseHeading({
      alpha: 0,
      dyawImu: [0, 0.5, 0.5, 0.5],
      headingEnc: [0, 0.1, 0.2, 0.3],
    });
    expect(r.heading[1]!).toBeCloseTo(0.1, 10);
    expect(r.heading[3]!).toBeCloseTo(0.3, 10);
  });

  it("α = 1 → pure IMU integration", () => {
    const r = fuseHeading({
      alpha: 1,
      dyawImu: [0, 0.1, 0.1, 0.1],
      headingEnc: [0, 1, 2, 3],
      heading0: 0,
    });
    expect(r.heading[3]!).toBeCloseTo(0.3, 10);
  });

  it("RangeError on mismatched lengths", () => {
    expect(() =>
      fuseHeading({ alpha: 0.5, dyawImu: [0], headingEnc: [0, 0] }),
    ).toThrow(RangeError);
  });
});
