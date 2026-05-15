import { describe, expect, it } from "vitest";
import {
  computeAxisLayout,
  formatTickValue,
  type AxisLayout,
  type AxisTick,
} from "../plotMath";

/**
 * computeAxisLayout — pure-function brain of <PlotPanel> (#52).
 *
 * Tests cover:
 *   - linear tick generation across positive, negative, and crossing-zero domains
 *   - log-scale tick generation (powers of 10 within [min, max])
 *   - degenerate-domain clamping (zero-width → tiny epsilon span centred on min)
 *   - log-scale rejection of zero/negative bounds
 *   - tick-count guidance honoured loosely (returns ~tickCount, not exactly)
 *   - tick label formatter: 3 sig figs default; integers stay integers;
 *     scientific notation for very small / very large
 */

describe("computeAxisLayout (linear)", () => {
  it("returns 5±1 ticks across a unit interval by default", () => {
    const layout: AxisLayout = computeAxisLayout({
      min: 0,
      max: 1,
      logScale: false,
    });
    expect(layout.ticks.length).toBeGreaterThanOrEqual(4);
    expect(layout.ticks.length).toBeLessThanOrEqual(7);
    expect(layout.min).toBe(0);
    expect(layout.max).toBe(1);
    expect(layout.logScale).toBe(false);
  });

  it("ticks span the requested domain inclusively at boundaries", () => {
    const layout = computeAxisLayout({ min: 0, max: 10, logScale: false });
    const values = layout.ticks.map((t) => t.value);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(10);
  });

  it("handles negative domains symmetrically", () => {
    const layout = computeAxisLayout({ min: -5, max: 5, logScale: false });
    const values = layout.ticks.map((t) => t.value);
    expect(values).toContain(0);
    expect(values[0]).toBe(-5);
    expect(values[values.length - 1]).toBe(5);
  });

  it("respects an explicit tickCount target loosely", () => {
    const layout = computeAxisLayout({
      min: 0,
      max: 100,
      logScale: false,
      tickCount: 11,
    });
    expect(layout.ticks.length).toBeGreaterThanOrEqual(9);
    expect(layout.ticks.length).toBeLessThanOrEqual(13);
  });

  it("clamps a zero-width domain by widening to a tiny epsilon span", () => {
    const layout = computeAxisLayout({ min: 5, max: 5, logScale: false });
    expect(layout.ticks.length).toBeGreaterThanOrEqual(2);
    // The midpoint should still be near the requested value.
    const mid = (layout.min + layout.max) / 2;
    expect(Math.abs(mid - 5)).toBeLessThan(1e-6);
    // The widened span should be small (epsilon-level).
    expect(layout.max - layout.min).toBeLessThan(1);
  });

  it("clamps an inverted domain (max < min) by swapping bounds", () => {
    const layout = computeAxisLayout({ min: 10, max: -10, logScale: false });
    expect(layout.min).toBeLessThan(layout.max);
  });

  it("each tick carries a normalized position in [0,1] along the axis", () => {
    const layout = computeAxisLayout({ min: 0, max: 4, logScale: false });
    for (const tick of layout.ticks) {
      expect(tick.normalized).toBeGreaterThanOrEqual(0);
      expect(tick.normalized).toBeLessThanOrEqual(1);
    }
    const first = layout.ticks[0];
    const last = layout.ticks[layout.ticks.length - 1];
    expect(first?.normalized).toBeCloseTo(0, 6);
    expect(last?.normalized).toBeCloseTo(1, 6);
  });
});

describe("computeAxisLayout (log)", () => {
  it("emits powers of 10 within [min, max]", () => {
    const layout = computeAxisLayout({
      min: 1,
      max: 1000,
      logScale: true,
    });
    const values = layout.ticks.map((t) => t.value);
    expect(values).toEqual([1, 10, 100, 1000]);
  });

  it("normalizes log-spaced ticks evenly along the axis", () => {
    const layout = computeAxisLayout({
      min: 1,
      max: 1000,
      logScale: true,
    });
    const positions = layout.ticks.map((t) => t.normalized);
    // 4 powers of 10 → positions 0, 1/3, 2/3, 1
    expect(positions[0]).toBeCloseTo(0, 6);
    expect(positions[1]).toBeCloseTo(1 / 3, 4);
    expect(positions[2]).toBeCloseTo(2 / 3, 4);
    expect(positions[3]).toBeCloseTo(1, 6);
  });

  it("throws when min ≤ 0 in log mode", () => {
    expect(() =>
      computeAxisLayout({ min: 0, max: 100, logScale: true }),
    ).toThrow(/positive/i);
    expect(() =>
      computeAxisLayout({ min: -1, max: 100, logScale: true }),
    ).toThrow(/positive/i);
  });

  it("handles fractional log domains (min < 1)", () => {
    const layout = computeAxisLayout({
      min: 0.01,
      max: 100,
      logScale: true,
    });
    const values = layout.ticks.map((t) => t.value);
    expect(values).toEqual([0.01, 0.1, 1, 10, 100]);
  });
});

describe("formatTickValue", () => {
  it("returns integer values without a decimal point", () => {
    expect(formatTickValue(0)).toBe("0");
    expect(formatTickValue(42)).toBe("42");
    expect(formatTickValue(-100)).toBe("-100");
  });

  it("returns 3 significant figures for typical floats", () => {
    expect(formatTickValue(1.23456)).toBe("1.23");
    expect(formatTickValue(0.0123456)).toBe("0.0123");
    expect(formatTickValue(123.456)).toBe("123");
  });

  it("uses scientific notation for very small magnitudes", () => {
    const out = formatTickValue(1.23e-7);
    expect(out).toMatch(/e/i);
  });

  it("uses scientific notation for very large magnitudes", () => {
    const out = formatTickValue(1.23e9);
    expect(out).toMatch(/e/i);
  });

  it("handles negative zero as zero", () => {
    expect(formatTickValue(-0)).toBe("0");
  });

  it("each AxisTick carries a pre-formatted label", () => {
    const layout = computeAxisLayout({ min: 0, max: 1, logScale: false });
    for (const tick of layout.ticks) {
      expect(typeof tick.label).toBe("string");
      expect(tick.label.length).toBeGreaterThan(0);
    }
  });
});

describe("AxisTick contract", () => {
  it("ticks are sorted ascending by value", () => {
    const layout = computeAxisLayout({ min: -5, max: 5, logScale: false });
    const values = layout.ticks.map((t) => t.value);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it("normalized positions match the tick ordering monotonically", () => {
    const layout: AxisLayout = computeAxisLayout({
      min: 0,
      max: 100,
      logScale: false,
    });
    let prev = -Infinity;
    for (const tick of layout.ticks) {
      expect(tick.normalized).toBeGreaterThan(prev);
      prev = tick.normalized;
    }
  });

  it("first/last ticks of a log axis pin to 0/1 normalized", () => {
    const layout = computeAxisLayout({ min: 1, max: 100, logScale: true });
    const ticks: readonly AxisTick[] = layout.ticks;
    expect(ticks[0]?.normalized).toBeCloseTo(0, 6);
    expect(ticks[ticks.length - 1]?.normalized).toBeCloseTo(1, 6);
  });
});
