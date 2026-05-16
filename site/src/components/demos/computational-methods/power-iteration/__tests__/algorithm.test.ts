import { describe, expect, it } from "vitest";
import { powerIteration } from "../algorithm";

describe("powerIteration", () => {
  it("recovers the dominant eigenvalue of a 2×2 diagonal matrix", () => {
    const r = powerIteration({
      A: [
        [5, 0],
        [0, 2],
      ],
    });
    expect(r.converged).toBe(true);
    expect(r.eigenvalue).toBeCloseTo(5, 9);
    // Eigenvector aligns with (±1, 0)
    expect(Math.abs(r.eigenvector[0]!)).toBeCloseTo(1, 6);
    expect(Math.abs(r.eigenvector[1]!)).toBeCloseTo(0, 6);
  });

  it("recovers eigenvalue=3 for the 2×2 matrix [[2,1],[1,2]] (eigenvalues 3 and 1)", () => {
    const r = powerIteration({
      A: [
        [2, 1],
        [1, 2],
      ],
    });
    expect(r.converged).toBe(true);
    expect(r.eigenvalue).toBeCloseTo(3, 9);
    // Eigenvector aligns with (1,1)/sqrt(2)
    const sign = Math.sign(r.eigenvector[0]!) || 1;
    expect(sign * r.eigenvector[0]!).toBeCloseTo(1 / Math.sqrt(2), 6);
    expect(sign * r.eigenvector[1]!).toBeCloseTo(1 / Math.sqrt(2), 6);
  });

  it("for the identity matrix every unit vector is an eigenvector with eigenvalue 1", () => {
    const r = powerIteration({
      A: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    });
    expect(r.converged).toBe(true);
    expect(r.eigenvalue).toBeCloseTo(1, 12);
  });

  it("recovers eigenvalue=4 for a 3×3 diagonal matrix [4,3,1]", () => {
    const r = powerIteration({
      A: [
        [4, 0, 0],
        [0, 3, 0],
        [0, 0, 1],
      ],
    });
    expect(r.converged).toBe(true);
    expect(r.eigenvalue).toBeCloseTo(4, 9);
  });

  it("Av ≈ λv for the returned (λ, v) — the defining eigenvector equation", () => {
    const A: number[][] = [
      [4, -2],
      [1, 1],
    ];
    // Eigenvalues are 3 and 2.  Uniform initial = (1,1)/√2 IS the λ=2
    // eigenvector exactly, so we'd stay stuck there.  Start away from it.
    const r = powerIteration({ A, initial: [1, 0] });
    expect(r.eigenvalue).toBeCloseTo(3, 8);
    const Av = [
      A[0]![0]! * r.eigenvector[0]! + A[0]![1]! * r.eigenvector[1]!,
      A[1]![0]! * r.eigenvector[0]! + A[1]![1]! * r.eigenvector[1]!,
    ];
    expect(Av[0]).toBeCloseTo(r.eigenvalue * r.eigenvector[0]!, 6);
    expect(Av[1]).toBeCloseTo(r.eigenvalue * r.eigenvector[1]!, 6);
  });

  it("returns eigenvalue=0 when matrix maps the iterate into the null space", () => {
    // [[0,0],[0,0]] is degenerate — every starting vector immediately gives Av=0
    const r = powerIteration({
      A: [
        [0, 0],
        [0, 0],
      ],
    });
    expect(r.eigenvalue).toBe(0);
    expect(r.converged).toBe(true);
  });

  it("respects the supplied initial vector", () => {
    const r = powerIteration({
      A: [
        [5, 0],
        [0, 2],
      ],
      initial: [0.6, 0.8],
    });
    // Should still converge to the same dominant eigenvalue
    expect(r.eigenvalue).toBeCloseTo(5, 9);
  });

  it("reports converged=false when maxIterations is too small", () => {
    // Start away from the eigenvector so it actually has work to do
    const r = powerIteration({
      A: [
        [2, 1],
        [1, 2],
      ],
      initial: [1, 0],
      tol: 1e-15,
      maxIterations: 1,
    });
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(1);
  });

  it("throws on non-square matrix", () => {
    expect(() =>
      powerIteration({
        A: [
          [1, 0],
          [0, 1, 2],
        ],
      }),
    ).toThrow(RangeError);
  });

  it("throws on empty matrix", () => {
    expect(() => powerIteration({ A: [] })).toThrow(RangeError);
  });

  it("throws on non-finite matrix entries", () => {
    expect(() =>
      powerIteration({
        A: [
          [1, Number.NaN],
          [0, 1],
        ],
      }),
    ).toThrow(RangeError);
  });

  it("throws when initial vector dimension doesn't match", () => {
    expect(() =>
      powerIteration({
        A: [
          [1, 0],
          [0, 1],
        ],
        initial: [1, 0, 0],
      }),
    ).toThrow(RangeError);
  });

  it("throws when initial vector is the zero vector", () => {
    expect(() =>
      powerIteration({
        A: [
          [1, 0],
          [0, 1],
        ],
        initial: [0, 0],
      }),
    ).toThrow(RangeError);
  });
});
