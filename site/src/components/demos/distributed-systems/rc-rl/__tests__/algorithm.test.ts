import { describe, expect, it } from "vitest";

import {
  rcChargingVoltage,
  rcDischargingVoltage,
  rcTimeConstant,
  rlCurrent,
  rlTimeConstant,
  timeToFraction,
} from "../algorithm";

describe("rcChargingVoltage", () => {
  it("is 0 at t=0 and approaches Vstep as t→∞", () => {
    expect(rcChargingVoltage({ Vstep: 5, tau: 1, t: 0 })).toBe(0);
    expect(rcChargingVoltage({ Vstep: 5, tau: 1, t: 100 })).toBeCloseTo(5, 12);
  });

  it("reaches ~63.2% of Vstep at t=τ (textbook)", () => {
    expect(rcChargingVoltage({ Vstep: 1, tau: 1, t: 1 })).toBeCloseTo(1 - 1 / Math.E, 12);
  });

  it("reaches ~99.3% of Vstep at t=5τ", () => {
    const v = rcChargingVoltage({ Vstep: 1, tau: 1, t: 5 });
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeCloseTo(1 - Math.exp(-5), 12);
  });

  it("returns 0 for t<0", () => {
    expect(rcChargingVoltage({ Vstep: 5, tau: 1, t: -1 })).toBe(0);
  });

  it("RangeError on bad tau or non-finite t", () => {
    expect(() => rcChargingVoltage({ Vstep: 5, tau: 0, t: 1 })).toThrow(RangeError);
    expect(() => rcChargingVoltage({ Vstep: 5, tau: 1, t: Number.NaN })).toThrow(
      RangeError,
    );
  });
});

describe("rcDischargingVoltage", () => {
  it("equals V0 at t=0 and decays to 0", () => {
    expect(rcDischargingVoltage(5, 1, 0)).toBeCloseTo(5, 12);
    expect(rcDischargingVoltage(5, 1, 100)).toBeCloseTo(0, 12);
  });

  it("at t=τ has decayed to 1/e of V0", () => {
    expect(rcDischargingVoltage(5, 1, 1)).toBeCloseTo(5 / Math.E, 12);
  });

  it("returns V0 for t<0 (pre-switch)", () => {
    expect(rcDischargingVoltage(5, 1, -1)).toBe(5);
  });
});

describe("rlCurrent", () => {
  it("reaches V/R asymptotically", () => {
    const v = rlCurrent(10, 2, 1, 100);
    expect(v).toBeCloseTo(5, 12);
  });

  it("at t=τ=L/R reaches ~63.2% of V/R", () => {
    const v = rlCurrent(10, 2, 1, 0.5); // τ = L/R = 0.5
    expect(v).toBeCloseTo(5 * (1 - 1 / Math.E), 12);
  });

  it("returns 0 at t=0 and t<0", () => {
    expect(rlCurrent(10, 2, 1, 0)).toBe(0);
    expect(rlCurrent(10, 2, 1, -1)).toBe(0);
  });

  it("RangeError on R<=0 or L<=0", () => {
    expect(() => rlCurrent(10, 0, 1, 1)).toThrow(RangeError);
    expect(() => rlCurrent(10, 2, 0, 1)).toThrow(RangeError);
  });
});

describe("time constants", () => {
  it("rcTimeConstant = R*C", () => {
    expect(rcTimeConstant(1000, 1e-6)).toBeCloseTo(1e-3, 12);
  });

  it("rlTimeConstant = L/R", () => {
    expect(rlTimeConstant(2, 1)).toBeCloseTo(0.5, 12);
  });

  it("RangeError on bad params", () => {
    expect(() => rcTimeConstant(0, 1)).toThrow(RangeError);
    expect(() => rcTimeConstant(1, 0)).toThrow(RangeError);
    expect(() => rlTimeConstant(0, 1)).toThrow(RangeError);
    expect(() => rlTimeConstant(1, 0)).toThrow(RangeError);
  });
});

describe("timeToFraction", () => {
  it("returns -τ ln(1-f)", () => {
    expect(timeToFraction(1, 0.5)).toBeCloseTo(-Math.log(0.5), 12);
    expect(timeToFraction(2, 0.99)).toBeCloseTo(-2 * Math.log(0.01), 12);
  });

  it("RangeError on f outside (0,1)", () => {
    expect(() => timeToFraction(1, 0)).toThrow(RangeError);
    expect(() => timeToFraction(1, 1)).toThrow(RangeError);
    expect(() => timeToFraction(1, -0.5)).toThrow(RangeError);
  });
});
