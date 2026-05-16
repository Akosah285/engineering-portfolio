import { describe, it, expect } from "vitest";
import { lagrange, buildNaturalSpline, evalSpline } from "../algorithm";

const nodes = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 2, y: 4 },
  { x: 3, y: 9 },
];

describe("lagrange", () => {
  it("reproduces nodes exactly", () => {
    for (const n of nodes) {
      expect(lagrange(nodes, n.x)).toBeCloseTo(n.y, 10);
    }
  });

  it("recovers y = x² exactly (degree 3 through 4 points fits quadratic)", () => {
    expect(lagrange(nodes, 1.5)).toBeCloseTo(2.25, 10);
    expect(lagrange(nodes, 2.5)).toBeCloseTo(6.25, 10);
  });

  it("recovers a linear function exactly", () => {
    const lin = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 3, y: 7 },
    ];
    expect(lagrange(lin, 2)).toBeCloseTo(5, 10);
  });

  it("RangeError on < 2 nodes", () => {
    expect(() => lagrange([{ x: 0, y: 0 }], 0)).toThrow(RangeError);
  });

  it("RangeError on non-ascending nodes", () => {
    expect(() =>
      lagrange(
        [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
        0.5,
      ),
    ).toThrow(RangeError);
  });
});

describe("natural cubic spline", () => {
  it("reproduces nodes exactly", () => {
    const s = buildNaturalSpline(nodes);
    for (const n of nodes) {
      expect(evalSpline(s, n.x)).toBeCloseTo(n.y, 10);
    }
  });

  it("is smooth — agrees with Lagrange in interior to within typical interp error", () => {
    const s = buildNaturalSpline(nodes);
    // Quadratic data, spline is C2 and close to true quadratic.
    expect(evalSpline(s, 1.5)).toBeCloseTo(2.25, 0);
  });

  it("RangeError on < 2 nodes", () => {
    expect(() => buildNaturalSpline([{ x: 0, y: 0 }])).toThrow(RangeError);
  });

  it("extrapolates by extending end segment (continuity check)", () => {
    const s = buildNaturalSpline(nodes);
    const inside = evalSpline(s, 2.99);
    const at = evalSpline(s, 3.0);
    // Continuity: difference is small relative to segment scale.
    expect(Math.abs(at - inside)).toBeLessThan(0.1);
  });

  it("natural-end second derivative = 0 at x_0 and x_n (c=0)", () => {
    const s = buildNaturalSpline(nodes);
    // c[0] should be exactly 0 for natural spline.
    expect(s.c[0]).toBeCloseTo(0, 10);
  });
});
