/**
 * beamDeflection — closed-form deflection for the four canonical beam cases (#88).
 *
 * Cantilever (fixed at x=0, free at x=L):
 *   point load P at the free end:
 *     v(x) = -P x² (3L − x) / (6 E I)
 *     v_max = -P L³ / (3 E I)        (at x=L)
 *
 *   uniformly distributed load w over the full length:
 *     v(x) = -w x² (x² − 4 L x + 6 L²) / (24 E I)
 *     v_max = -w L⁴ / (8 E I)        (at x=L)
 *
 * Simply-supported (pin at x=0, roller at x=L):
 *   point load P at midspan:
 *     v_max = -P L³ / (48 E I)       (at x=L/2)
 *     For 0 ≤ x ≤ L/2:
 *       v(x) = -P x (3 L² − 4 x²) / (48 E I)
 *     The right half mirrors the left.
 *
 *   uniformly distributed load w over the full length:
 *     v(x) = -w x (L³ − 2 L x² + x³) / (24 E I)
 *     v_max = -5 w L⁴ / (384 E I)    (at x=L/2)
 *
 * Sign convention: deflection is positive upward, so all results are
 * NEGATIVE for downward loads (positive P / w). The shell can flip the
 * sign for display if the visual axis points down.
 */

export type BeamCase =
  | { readonly kind: "cantilever-point"; readonly P: number }
  | { readonly kind: "cantilever-udl"; readonly w: number }
  | { readonly kind: "simply-supported-point"; readonly P: number }
  | { readonly kind: "simply-supported-udl"; readonly w: number };

export interface BeamInput {
  /** Length of the beam [m]. Must be > 0. */
  readonly L: number;
  /** Young's modulus [Pa]. Must be > 0. */
  readonly E: number;
  /** Second moment of area about the bending axis [m^4]. Must be > 0. */
  readonly I: number;
  readonly load: BeamCase;
}

export interface BeamPoint {
  readonly x: number;
  readonly v: number;
}

function checkBeam(input: BeamInput): void {
  if (!Number.isFinite(input.L) || input.L <= 0) {
    throw new RangeError("beamDeflection: L must be > 0 and finite.");
  }
  if (!Number.isFinite(input.E) || input.E <= 0) {
    throw new RangeError("beamDeflection: E must be > 0 and finite.");
  }
  if (!Number.isFinite(input.I) || input.I <= 0) {
    throw new RangeError("beamDeflection: I must be > 0 and finite.");
  }
  switch (input.load.kind) {
    case "cantilever-point":
    case "simply-supported-point":
      if (!Number.isFinite(input.load.P)) {
        throw new RangeError(`beamDeflection: P must be finite for ${input.load.kind}.`);
      }
      break;
    case "cantilever-udl":
    case "simply-supported-udl":
      if (!Number.isFinite(input.load.w)) {
        throw new RangeError(`beamDeflection: w must be finite for ${input.load.kind}.`);
      }
      break;
  }
}

export function maxDeflection(input: BeamInput): { x: number; v: number } {
  checkBeam(input);
  const { L, E, I, load } = input;
  switch (load.kind) {
    case "cantilever-point":
      return { x: L, v: -(load.P * L ** 3) / (3 * E * I) };
    case "cantilever-udl":
      return { x: L, v: -(load.w * L ** 4) / (8 * E * I) };
    case "simply-supported-point":
      return { x: L / 2, v: -(load.P * L ** 3) / (48 * E * I) };
    case "simply-supported-udl":
      return { x: L / 2, v: -(5 * load.w * L ** 4) / (384 * E * I) };
  }
}

export function deflectionAt(input: BeamInput, x: number): number {
  checkBeam(input);
  const { L, E, I, load } = input;
  if (!Number.isFinite(x) || x < 0 || x > L) {
    throw new RangeError("beamDeflection: x must be in [0, L].");
  }
  switch (load.kind) {
    case "cantilever-point": {
      const P = load.P;
      return -(P * x ** 2 * (3 * L - x)) / (6 * E * I);
    }
    case "cantilever-udl": {
      const w = load.w;
      return -(w * x ** 2 * (x ** 2 - 4 * L * x + 6 * L ** 2)) / (24 * E * I);
    }
    case "simply-supported-point": {
      const P = load.P;
      // Use symmetry: for x > L/2, evaluate at the mirror point L − x.
      const xs = x <= L / 2 ? x : L - x;
      return -(P * xs * (3 * L ** 2 - 4 * xs ** 2)) / (48 * E * I);
    }
    case "simply-supported-udl": {
      const w = load.w;
      return -(w * x * (L ** 3 - 2 * L * x ** 2 + x ** 3)) / (24 * E * I);
    }
  }
}

export function deflectionCurve(input: BeamInput, samples: number): BeamPoint[] {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("beamDeflection: samples must be an integer >= 2.");
  }
  const out: BeamPoint[] = new Array(samples);
  const L = input.L;
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * L;
    out[i] = { x, v: deflectionAt(input, x) };
  }
  return out;
}
