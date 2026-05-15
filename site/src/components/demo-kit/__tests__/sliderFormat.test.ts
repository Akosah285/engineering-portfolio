import { describe, expect, it } from "vitest";
import { clampToStep, formatSliderValue } from "../sliderFormat";

describe("clampToStep", () => {
  it("returns the value unchanged when already aligned to step and in range", () => {
    expect(clampToStep(0.5, 0, 1, 0.1)).toBeCloseTo(0.5);
    expect(clampToStep(50, 0, 100, 10)).toBe(50);
  });

  it("snaps to the nearest step multiple", () => {
    expect(clampToStep(0.53, 0, 1, 0.1)).toBeCloseTo(0.5);
    expect(clampToStep(0.57, 0, 1, 0.1)).toBeCloseTo(0.6);
  });

  it("clamps below min and above max", () => {
    expect(clampToStep(-5, 0, 10, 1)).toBe(0);
    expect(clampToStep(99, 0, 10, 1)).toBe(10);
  });

  it("returns min for non-finite values (NaN, Infinity)", () => {
    expect(clampToStep(Number.NaN, 0, 10, 1)).toBe(0);
    expect(clampToStep(Number.POSITIVE_INFINITY, -1, 5, 0.5)).toBe(-1);
    expect(clampToStep(Number.NEGATIVE_INFINITY, -1, 5, 0.5)).toBe(-1);
  });

  it("throws when min > max", () => {
    expect(() => clampToStep(0, 10, 0, 1)).toThrow(/min/);
  });

  it("falls back to plain clamping when step is zero or negative", () => {
    expect(clampToStep(3.7, 0, 10, 0)).toBe(3.7);
    expect(clampToStep(11, 0, 10, -1)).toBe(10);
    expect(clampToStep(-1, 0, 10, 0)).toBe(0);
  });

  it("rounds away floating-point drift for sub-unit steps", () => {
    const result = clampToStep(0.3, 0, 1, 0.1);
    expect(Number.isInteger(result * 10)).toBe(true);
  });

  it("handles negative ranges", () => {
    expect(clampToStep(-0.5, -1, 1, 0.5)).toBeCloseTo(-0.5);
    expect(clampToStep(-2, -1, 1, 0.5)).toBe(-1);
  });
});

describe("formatSliderValue", () => {
  it("formats integers without decimals at default precision", () => {
    expect(formatSliderValue(100)).toBe("100");
    expect(formatSliderValue(0)).toBe("0");
  });

  it("auto-picks precision by magnitude when none is given", () => {
    expect(formatSliderValue(42.567)).toBe("42.6"); // 10 <= |x| < 100
    expect(formatSliderValue(2.345)).toBe("2.35"); //   1 <= |x| < 10
    expect(formatSliderValue(0.123)).toBe("0.123"); //  |x| < 1
  });

  it("honours an explicit precision", () => {
    expect(formatSliderValue(3.14159, { precision: 2 })).toBe("3.14");
    expect(formatSliderValue(3.14159, { precision: 0 })).toBe("3");
    expect(formatSliderValue(3.14159, { precision: 4 })).toBe("3.1416");
  });

  it("appends a unit with a non-breaking space when provided", () => {
    expect(formatSliderValue(440, { unit: "Hz" })).toBe("440\u00a0Hz");
    expect(formatSliderValue(0.5, { precision: 2, unit: "s" })).toBe(
      "0.50\u00a0s",
    );
  });

  it("returns an em-dash for non-finite values", () => {
    expect(formatSliderValue(Number.NaN)).toBe("—");
    expect(formatSliderValue(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("never returns negative-precision artefacts", () => {
    expect(formatSliderValue(3.14, { precision: -2 })).toBe("3");
  });

  it("handles negative numbers correctly", () => {
    expect(formatSliderValue(-12.34)).toBe("-12.3");
    expect(formatSliderValue(-0.5)).toBe("-0.500");
  });
});
