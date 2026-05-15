import { describe, it, expect } from "vitest";
import { fieldAt, fieldGrid, type PointCharge } from "../algorithm";

describe("fieldAt — single positive charge at origin", () => {
  const Q: PointCharge[] = [{ x: 0, y: 0, q: 1 }];

  it("at (1, 0) gives E pointing in +x with magnitude 1 (k=1)", () => {
    const f = fieldAt({ charges: Q, x: 1, y: 0 });
    expect(f.Ex).toBeCloseTo(1, 12);
    expect(f.Ey).toBeCloseTo(0, 12);
    expect(f.magnitude).toBeCloseTo(1, 12);
  });

  it("at distance r the magnitude is k·|q|/r²", () => {
    for (const r of [0.5, 1, 2, 5]) {
      const f = fieldAt({ charges: Q, x: r, y: 0 });
      expect(f.magnitude).toBeCloseTo(1 / (r * r), 10);
    }
  });

  it("at (0, 1) the field is +y", () => {
    const f = fieldAt({ charges: Q, x: 0, y: 1 });
    expect(f.Ex).toBeCloseTo(0, 12);
    expect(f.Ey).toBeCloseTo(1, 12);
  });

  it("potential V = k·q/r is positive for q > 0", () => {
    expect(fieldAt({ charges: Q, x: 2, y: 0 }).potential).toBeCloseTo(0.5, 12);
  });

  it("scales with k (e.g. k=4 quadruples |E|)", () => {
    const a = fieldAt({ charges: Q, x: 1, y: 0, k: 1 });
    const b = fieldAt({ charges: Q, x: 1, y: 0, k: 4 });
    expect(b.magnitude).toBeCloseTo(4 * a.magnitude, 12);
  });

  it("returns NaN field and +Infinity potential exactly at the charge", () => {
    const f = fieldAt({ charges: Q, x: 0, y: 0 });
    expect(Number.isNaN(f.Ex)).toBe(true);
    expect(Number.isNaN(f.Ey)).toBe(true);
    expect(f.potential).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("fieldAt — dipole (+q at (-1,0), -q at (+1,0))", () => {
  const D: PointCharge[] = [
    { x: -1, y: 0, q: 1 },
    { x: 1, y: 0, q: -1 },
  ];

  it("on the perpendicular axis x=0 the field is purely in +x (away from + toward -)", () => {
    const f = fieldAt({ charges: D, x: 0, y: 0.5 });
    expect(f.Ex).toBeGreaterThan(0);
    expect(Math.abs(f.Ey)).toBeLessThan(1e-12);
  });

  it("V = 0 on the perpendicular bisector (equipotential plane)", () => {
    for (const y of [-0.5, 0, 0.5, 1, 5]) {
      expect(fieldAt({ charges: D, x: 0, y }).potential).toBeCloseTo(0, 12);
    }
  });

  it("at the midpoint origin, both charges push a +q test particle toward the - charge (+x)", () => {
    // +q at (-1,0): r̂ = +x ⇒ Ex contribution = +1
    // -q at (+1,0): r̂ = -x, q<0 ⇒ Ex contribution = +1
    // Net Ex = +2, Ey = 0
    const f = fieldAt({ charges: D, x: 0, y: 0 });
    expect(f.Ex).toBeCloseTo(2, 12);
    expect(Math.abs(f.Ey)).toBeLessThan(1e-12);
  });
});

describe("fieldAt — superposition", () => {
  it("two equal +q charges symmetric about origin give zero net field at origin", () => {
    const f = fieldAt({
      charges: [
        { x: -1, y: 0, q: 1 },
        { x: 1, y: 0, q: 1 },
      ],
      x: 0,
      y: 0,
    });
    expect(Math.abs(f.Ex)).toBeLessThan(1e-12);
    expect(Math.abs(f.Ey)).toBeLessThan(1e-12);
  });

  it("adding two singletons equals fieldAt of the combined system (linearity)", () => {
    const a: PointCharge = { x: -1, y: 0, q: 2 };
    const b: PointCharge = { x: 1, y: 0, q: -3 };
    const x = 0.5;
    const y = 0.5;
    const fa = fieldAt({ charges: [a], x, y });
    const fb = fieldAt({ charges: [b], x, y });
    const fab = fieldAt({ charges: [a, b], x, y });
    expect(fab.Ex).toBeCloseTo(fa.Ex + fb.Ex, 12);
    expect(fab.Ey).toBeCloseTo(fa.Ey + fb.Ey, 12);
    expect(fab.potential).toBeCloseTo(fa.potential + fb.potential, 12);
  });

  it("reverses sign for negative charges (q=-1 at origin gives -x at (1,0))", () => {
    const f = fieldAt({ charges: [{ x: 0, y: 0, q: -1 }], x: 1, y: 0 });
    expect(f.Ex).toBeCloseTo(-1, 12);
    expect(f.Ey).toBeCloseTo(0, 12);
  });
});

describe("fieldGrid", () => {
  it("returns nx*ny samples covering the rectangle inclusively", () => {
    const grid = fieldGrid({
      charges: [{ x: 0, y: 0, q: 1 }],
      xMin: -2,
      xMax: 2,
      yMin: -2,
      yMax: 2,
      nx: 5,
      ny: 5,
    });
    expect(grid).toHaveLength(25);
    expect(grid[0]!.x).toBe(-2);
    expect(grid[0]!.y).toBe(-2);
    expect(grid[24]!.x).toBe(2);
    expect(grid[24]!.y).toBe(2);
  });

  it("throws on degenerate grid bounds or sample counts", () => {
    const base = { charges: [{ x: 0, y: 0, q: 1 }], xMin: 0, xMax: 1, yMin: 0, yMax: 1 } as const;
    expect(() => fieldGrid({ ...base, nx: 1, ny: 5 })).toThrow(RangeError);
    expect(() => fieldGrid({ ...base, nx: 5, ny: 5, xMin: 1, xMax: 0 })).toThrow(RangeError);
  });
});

describe("validation", () => {
  it("throws on non-finite charge or query coordinates", () => {
    expect(() => fieldAt({ charges: [{ x: 0, y: 0, q: Number.NaN }], x: 1, y: 0 }))
      .toThrow(RangeError);
    expect(() => fieldAt({ charges: [{ x: 0, y: 0, q: 1 }], x: Number.NaN, y: 0 }))
      .toThrow(RangeError);
  });
});
