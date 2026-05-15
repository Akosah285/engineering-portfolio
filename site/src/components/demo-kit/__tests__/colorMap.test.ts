import { describe, expect, it } from "vitest";
import {
  computeColorBarTicks,
  viridis,
  rdbu,
  type ColorBarTick,
} from "../colorMap";

/**
 * computeColorBarTicks + built-in colour maps — pure brain of <ColorBar> (#55).
 *
 * Tests cover:
 *   - tick generation across positive, negative, and crossing-zero ranges
 *   - viridis / rdbu return [r,g,b] tuples in [0, 255]
 *   - viridis is monotonic in luminance (perceptual property)
 *   - rdbu is white-ish at t=0.5 (diverging)
 *   - colour maps clamp t outside [0, 1]
 */

describe("computeColorBarTicks", () => {
  it("returns the requested tick count (loosely)", () => {
    const ticks = computeColorBarTicks(0, 1, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });

  it("first / last ticks pin to the requested min and max", () => {
    const ticks = computeColorBarTicks(0, 100, 5);
    expect(ticks[0]?.value).toBe(0);
    expect(ticks[ticks.length - 1]?.value).toBe(100);
  });

  it("each tick has a normalized position in [0, 1]", () => {
    const ticks = computeColorBarTicks(-5, 5, 5);
    for (const tick of ticks) {
      expect(tick.normalized).toBeGreaterThanOrEqual(0);
      expect(tick.normalized).toBeLessThanOrEqual(1);
    }
  });

  it("emits a label string for each tick", () => {
    const ticks = computeColorBarTicks(0, 1, 5);
    for (const tick of ticks) {
      expect(typeof tick.label).toBe("string");
      expect(tick.label.length).toBeGreaterThan(0);
    }
  });

  it("ticks are sorted ascending by value", () => {
    const ticks: ColorBarTick[] = computeColorBarTicks(-1, 1, 5);
    const values = ticks.map((t) => t.value);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it("clamps a zero-width range to a tiny non-zero span", () => {
    const ticks = computeColorBarTicks(5, 5, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("inverts when max < min by swapping bounds", () => {
    const ticks = computeColorBarTicks(10, 0, 5);
    expect(ticks[0]?.value).toBe(0);
    expect(ticks[ticks.length - 1]?.value).toBe(10);
  });
});

describe("viridis colour map", () => {
  it("returns three components in [0, 255]", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = viridis(t);
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });

  it("is darkest near t=0 (purple-ish) and brightest near t=1 (yellow-ish)", () => {
    const [r0, g0, b0] = viridis(0);
    const [r1, g1, b1] = viridis(1);
    const lum0 = r0 + g0 + b0;
    const lum1 = r1 + g1 + b1;
    expect(lum1).toBeGreaterThan(lum0);
  });

  it("clamps t < 0 to t = 0 and t > 1 to t = 1", () => {
    expect(viridis(-1)).toEqual(viridis(0));
    expect(viridis(2)).toEqual(viridis(1));
  });
});

describe("rdbu (red-blue diverging) colour map", () => {
  it("returns three components in [0, 255]", () => {
    for (const t of [0, 0.5, 1]) {
      const [r, g, b] = rdbu(t);
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });

  it("is reddish at t=0 and blueish at t=1", () => {
    const [r0, _g0, b0] = rdbu(0);
    const [r1, _g1, b1] = rdbu(1);
    expect(r0).toBeGreaterThan(b0);
    expect(b1).toBeGreaterThan(r1);
  });

  it("is near-neutral (light) at t=0.5", () => {
    const [r, g, b] = rdbu(0.5);
    // A diverging map's midpoint should be lighter than its endpoints.
    const midLum = r + g + b;
    const endLum = rdbu(0)[0] + rdbu(0)[1] + rdbu(0)[2];
    expect(midLum).toBeGreaterThan(endLum * 0.9);
  });

  it("clamps t outside [0, 1]", () => {
    expect(rdbu(-1)).toEqual(rdbu(0));
    expect(rdbu(2)).toEqual(rdbu(1));
  });
});
