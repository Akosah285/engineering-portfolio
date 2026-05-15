import { describe, expect, it } from "vitest";
import { SURFACES, SURFACE_SLUGS, type SurfaceSlug, getSurface } from "../surfaces";

describe("SURFACES", () => {
  it("exposes exactly the four named surfaces", () => {
    expect(Object.keys(SURFACES).sort()).toEqual([
      "plateau",
      "quadratic",
      "rosenbrock",
      "saddle",
    ]);
  });

  it("each surface returns finite loss + gradient at its minimum", () => {
    for (const slug of SURFACE_SLUGS) {
      const s = SURFACES[slug];
      const { x, y } = s.minimum;
      expect(Number.isFinite(s.loss(x, y))).toBe(true);
      const [gx, gy] = s.grad(x, y);
      expect(Number.isFinite(gx)).toBe(true);
      expect(Number.isFinite(gy)).toBe(true);
    }
  });

  it("the quadratic bowl has gradient (0,0) at its minimum", () => {
    const [gx, gy] = SURFACES.quadratic.grad(0, 0);
    expect(gx).toBe(0);
    expect(gy).toBe(0);
  });

  it("Rosenbrock has gradient (0,0) at (1,1)", () => {
    const [gx, gy] = SURFACES.rosenbrock.grad(1, 1);
    expect(gx).toBeCloseTo(0, 10);
    expect(gy).toBeCloseTo(0, 10);
  });

  it("saddle gradient is (2x, -2y) — sign flip in y", () => {
    const [gx, gy] = SURFACES.saddle.grad(1, 1);
    expect(gx).toBe(2);
    expect(gy).toBe(-2);
  });

  it("plateau gradient vanishes far from the origin", () => {
    const [gxFar] = SURFACES.plateau.grad(50, 0);
    expect(Math.abs(gxFar)).toBeLessThan(1e-3);
  });

  it("plateau gradient at origin is zero", () => {
    const [gx, gy] = SURFACES.plateau.grad(0, 0);
    expect(gx).toBe(0);
    expect(gy).toBe(0);
  });

  it("each surface has bounds with min < max in both axes", () => {
    for (const slug of SURFACE_SLUGS) {
      const { bounds } = SURFACES[slug];
      expect(bounds.xMin).toBeLessThan(bounds.xMax);
      expect(bounds.yMin).toBeLessThan(bounds.yMax);
    }
  });
});

describe("getSurface", () => {
  it("returns the named surface for a known slug", () => {
    for (const slug of SURFACE_SLUGS) {
      const s = getSurface(slug);
      expect(s.slug).toBe(slug);
    }
  });

  it("falls back to quadratic for unknown / null / undefined input", () => {
    expect(getSurface("unknown" as SurfaceSlug).slug).toBe("quadratic");
    expect(getSurface(null).slug).toBe("quadratic");
    expect(getSurface(undefined).slug).toBe("quadratic");
    expect(getSurface("").slug).toBe("quadratic");
  });
});
