import { describe, it, expect } from "vitest";
import { decide, isNight } from "../algorithm";

describe("decide — solar tracker", () => {
  it("balanced light → hold (within deadband)", () => {
    const r = decide({ east: 500, west: 502 });
    expect(r.direction).toBe("hold");
    expect(r.delta).toBe(0);
  });

  it("east brighter beyond deadband → step east (negative angle delta)", () => {
    const r = decide({ east: 600, west: 500, deadband: 5, stepDeg: 2, currentAngle: 10 });
    expect(r.direction).toBe("east");
    expect(r.delta).toBe(-2);
    expect(r.nextAngle).toBe(8);
  });

  it("west brighter beyond deadband → step west (positive angle delta)", () => {
    const r = decide({ east: 500, west: 600, deadband: 5, stepDeg: 2, currentAngle: 10 });
    expect(r.direction).toBe("west");
    expect(r.delta).toBe(2);
    expect(r.nextAngle).toBe(12);
  });

  it("clamps to maxAngle and reports clamped=true", () => {
    const r = decide({
      east: 100,
      west: 1000,
      stepDeg: 5,
      currentAngle: 88,
      maxAngle: 90,
    });
    expect(r.nextAngle).toBe(90);
    expect(r.clamped).toBe(true);
    expect(r.delta).toBe(2);
  });

  it("clamps to minAngle and reports clamped=true", () => {
    const r = decide({
      east: 1000,
      west: 100,
      stepDeg: 5,
      currentAngle: -88,
      minAngle: -90,
    });
    expect(r.nextAngle).toBe(-90);
    expect(r.clamped).toBe(true);
    expect(r.delta).toBe(-2);
  });

  it("exact deadband edge → hold", () => {
    const r = decide({ east: 105, west: 100, deadband: 5 });
    expect(r.direction).toBe("hold");
  });

  it("just past deadband → step", () => {
    const r = decide({ east: 106, west: 100, deadband: 5 });
    expect(r.direction).toBe("east");
  });

  it("RangeError on negative LDR", () => {
    expect(() => decide({ east: -1, west: 0 })).toThrow(RangeError);
  });

  it("RangeError on non-finite", () => {
    expect(() => decide({ east: NaN, west: 0 })).toThrow(RangeError);
  });

  it("RangeError on currentAngle outside bounds", () => {
    expect(() =>
      decide({ east: 0, west: 0, currentAngle: 91, minAngle: -90, maxAngle: 90 }),
    ).toThrow(RangeError);
  });

  it("RangeError on inverted angle range", () => {
    expect(() =>
      decide({ east: 0, west: 0, minAngle: 10, maxAngle: -10, currentAngle: 0 }),
    ).toThrow(RangeError);
  });

  it("RangeError on stepDeg <= 0", () => {
    expect(() => decide({ east: 100, west: 0, stepDeg: 0 })).toThrow(RangeError);
  });

  it("RangeError on deadband < 0", () => {
    expect(() => decide({ east: 100, west: 0, deadband: -1 })).toThrow(RangeError);
  });
});

describe("isNight", () => {
  it("true when brightness < threshold", () => {
    expect(isNight(50, 100)).toBe(true);
    expect(isNight(99, 100)).toBe(true);
  });
  it("false at or above threshold", () => {
    expect(isNight(100, 100)).toBe(false);
    expect(isNight(200, 100)).toBe(false);
  });
  it("RangeError on non-finite", () => {
    expect(() => isNight(NaN, 100)).toThrow(RangeError);
    expect(() => isNight(50, Infinity)).toThrow(RangeError);
  });
});
