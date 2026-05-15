import { describe, expect, it } from "vitest";
import { mohrCircle } from "../algorithm";

describe("mohrCircle", () => {
  it("returns sigma1 = sigmaX, sigma2 = sigmaY when tauXY = 0 and sigmaX > sigmaY", () => {
    const r = mohrCircle({ sigmaX: 100, sigmaY: 30, tauXY: 0 });
    expect(r.sigma1).toBeCloseTo(100, 10);
    expect(r.sigma2).toBeCloseTo(30, 10);
    expect(r.tauMax).toBeCloseTo(35, 10);
  });

  it("centre is the average of normal stresses", () => {
    const r = mohrCircle({ sigmaX: 80, sigmaY: 20, tauXY: 12 });
    expect(r.centre).toBeCloseTo(50, 10);
  });

  it("pure shear: sigma1 = +tau, sigma2 = -tau, principal angle = 45 deg", () => {
    const r = mohrCircle({ sigmaX: 0, sigmaY: 0, tauXY: 50 });
    expect(r.sigma1).toBeCloseTo(50, 10);
    expect(r.sigma2).toBeCloseTo(-50, 10);
    expect(r.thetaP).toBeCloseTo(Math.PI / 4, 10);
  });

  it("hydrostatic stress: sigma1 = sigma2 = sigma, radius = 0", () => {
    const r = mohrCircle({ sigmaX: 50, sigmaY: 50, tauXY: 0 });
    expect(r.radius).toBeCloseTo(0, 10);
    expect(r.sigma1).toBeCloseTo(50, 10);
    expect(r.sigma2).toBeCloseTo(50, 10);
  });

  it("classic textbook case (Hibbeler): sigmaX=-20, sigmaY=90, tauXY=60", () => {
    const r = mohrCircle({ sigmaX: -20, sigmaY: 90, tauXY: 60 });
    // Centre = 35, R = sqrt((-55)^2 + 60^2) = sqrt(3025 + 3600) = sqrt(6625) ≈ 81.39
    expect(r.centre).toBeCloseTo(35, 10);
    expect(r.radius).toBeCloseTo(Math.sqrt(6625), 10);
    expect(r.sigma1).toBeCloseTo(35 + Math.sqrt(6625), 10);
    expect(r.sigma2).toBeCloseTo(35 - Math.sqrt(6625), 10);
  });

  it("tauMax always equals radius", () => {
    for (const i of [-50, 0, 25, 100]) {
      const r = mohrCircle({ sigmaX: i, sigmaY: -i / 2, tauXY: 18 });
      expect(r.tauMax).toBeCloseTo(r.radius, 12);
    }
  });

  it("rejects NaN / Infinity inputs", () => {
    expect(() =>
      mohrCircle({ sigmaX: NaN, sigmaY: 0, tauXY: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      mohrCircle({ sigmaX: Infinity, sigmaY: 0, tauXY: 0 }),
    ).toThrow(RangeError);
  });

  it("invariance: sigma1 + sigma2 = sigmaX + sigmaY (trace invariant)", () => {
    for (const [sx, sy, t] of [
      [10, 20, 5],
      [-30, 70, 15],
      [0, 0, 50],
      [100, -100, 200],
    ]) {
      const r = mohrCircle({ sigmaX: sx!, sigmaY: sy!, tauXY: t! });
      expect(r.sigma1 + r.sigma2).toBeCloseTo(sx! + sy!, 10);
    }
  });
});
