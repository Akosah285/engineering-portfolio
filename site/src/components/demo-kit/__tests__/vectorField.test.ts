import { describe, expect, it } from "vitest";
import {
  computeArrows,
  type Arrow,
  type FieldFn,
} from "../vectorField";

/**
 * computeArrows — pure brain of <VectorFieldPlot> (#54).
 *
 * Tests cover:
 *   - grid produces gridSize × gridSize arrows
 *   - arrows are placed at evenly-spaced sample points within the domain
 *   - arrow length is normalized to ~1 cell width by default (avoids visual noise)
 *   - magnitude is captured per-arrow for optional colour mapping
 *   - singularities (extreme magnitudes) are clipped at the configured cap
 *   - zero-magnitude points get arrows of length 0 (rendered as dots downstream)
 */

const constantField: FieldFn = () => [1, 0];
const radialField: FieldFn = (x, y) => {
  const r2 = x * x + y * y;
  if (r2 === 0) return [0, 0];
  const inv = 1 / r2;
  return [x * inv, y * inv];
};

describe("computeArrows — grid", () => {
  it("produces gridSize × gridSize arrows", () => {
    const arrows = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 8,
      fieldFn: constantField,
    });
    expect(arrows).toHaveLength(64);
  });

  it("places arrows at evenly-spaced cell centres within the domain", () => {
    const arrows = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 4,
      fieldFn: constantField,
    });
    // Cell width = 0.25; cell centres at 0.125, 0.375, 0.625, 0.875.
    const xs = [...new Set(arrows.map((a) => a.x))].sort((a, b) => a - b);
    expect(xs).toHaveLength(4);
    expect(xs[0]).toBeCloseTo(0.125, 6);
    expect(xs[3]).toBeCloseTo(0.875, 6);
  });

  it("handles non-square domains", () => {
    const arrows = computeArrows({
      xDomain: [-2, 2],
      yDomain: [0, 1],
      gridSize: 4,
      fieldFn: constantField,
    });
    expect(arrows).toHaveLength(16);
    const xs = arrows.map((a) => a.x);
    expect(Math.min(...xs)).toBeGreaterThan(-2);
    expect(Math.max(...xs)).toBeLessThan(2);
  });
});

describe("computeArrows — magnitude + normalization", () => {
  it("captures the raw vector magnitude per arrow", () => {
    const arrows: Arrow[] = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 2,
      fieldFn: () => [3, 4], // magnitude 5
    });
    for (const a of arrows) {
      expect(a.magnitude).toBeCloseTo(5, 6);
    }
  });

  it("by default normalizes drawn arrow length to ~1 cell width", () => {
    const arrows = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 4,
      fieldFn: () => [10, 0], // huge raw magnitude
    });
    const cellWidth = 1 / 4;
    for (const a of arrows) {
      const drawnMag = Math.hypot(a.dx, a.dy);
      expect(drawnMag).toBeLessThanOrEqual(cellWidth + 1e-9);
      expect(drawnMag).toBeGreaterThan(0);
    }
  });

  it("preserves direction after normalization", () => {
    const arrows = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 2,
      fieldFn: () => [3, 4], // 36.87° from +x
    });
    for (const a of arrows) {
      const angle = Math.atan2(a.dy, a.dx);
      expect(angle).toBeCloseTo(Math.atan2(4, 3), 5);
    }
  });
});

describe("computeArrows — clipping + singularities", () => {
  it("clamps arrow length at the configured magnitude cap", () => {
    const arrows = computeArrows({
      xDomain: [-1, 1],
      yDomain: [-1, 1],
      gridSize: 8,
      fieldFn: radialField,
      maxMagnitude: 2,
    });
    // The clipping is applied to magnitude before normalization, so the
    // captured (possibly-clipped) magnitude should never exceed the cap.
    for (const a of arrows) {
      expect(a.magnitudeClipped).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it("emits zero-length arrows for zero-magnitude samples", () => {
    const arrows = computeArrows({
      xDomain: [0, 1],
      yDomain: [0, 1],
      gridSize: 2,
      fieldFn: () => [0, 0],
    });
    for (const a of arrows) {
      expect(a.dx).toBe(0);
      expect(a.dy).toBe(0);
      expect(a.magnitude).toBe(0);
    }
  });

  it("never returns NaN even when the field returns NaN", () => {
    const arrows = computeArrows({
      xDomain: [-1, 1],
      yDomain: [-1, 1],
      gridSize: 4,
      fieldFn: () => [NaN, NaN],
    });
    for (const a of arrows) {
      expect(Number.isFinite(a.dx)).toBe(true);
      expect(Number.isFinite(a.dy)).toBe(true);
      expect(Number.isFinite(a.magnitude)).toBe(true);
    }
  });
});

describe("computeArrows — domain validation", () => {
  it("throws when gridSize < 1", () => {
    expect(() =>
      computeArrows({
        xDomain: [0, 1],
        yDomain: [0, 1],
        gridSize: 0,
        fieldFn: constantField,
      }),
    ).toThrow(/grid/i);
  });

  it("auto-corrects an inverted domain by swapping bounds", () => {
    const arrows = computeArrows({
      xDomain: [1, 0],
      yDomain: [1, 0],
      gridSize: 2,
      fieldFn: constantField,
    });
    expect(arrows).toHaveLength(4);
    for (const a of arrows) {
      expect(a.x).toBeGreaterThan(0);
      expect(a.x).toBeLessThan(1);
    }
  });
});
