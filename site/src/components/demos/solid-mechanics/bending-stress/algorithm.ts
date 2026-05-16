// Bending stress (flexure formula): σ(y) = -M·y / I
//
// Sign convention: positive M = sagging (compression on top fiber, tension below).
// y is measured from the neutral axis, positive upward.
// I is the second moment of area about the neutral axis.
//
// Standard cross-sections:
//   - Rectangle (b × h):  I = b·h³ / 12,  y_max = h/2
//   - Circle (radius R):  I = π·R⁴ / 4,   y_max = R
//   - I-beam (BH³ - bh³)/12 with B,H outer and b,h inner removed.
//
// Reference: Hibbeler, Mechanics of Materials §6.4.

export type Section =
  | { kind: "rect"; b: number; h: number }
  | { kind: "circle"; R: number }
  | { kind: "ibeam"; B: number; H: number; b: number; h: number };

export function momentOfInertia(s: Section): number {
  validateSection(s);
  if (s.kind === "rect") return (s.b * Math.pow(s.h, 3)) / 12;
  if (s.kind === "circle") return (Math.PI * Math.pow(s.R, 4)) / 4;
  // ibeam: outer minus inner (centered hole).
  return (s.B * Math.pow(s.H, 3) - s.b * Math.pow(s.h, 3)) / 12;
}

export function yMax(s: Section): number {
  validateSection(s);
  if (s.kind === "rect") return s.h / 2;
  if (s.kind === "circle") return s.R;
  return s.H / 2;
}

// Flexure formula: σ(y) = -M·y / I
export function bendingStress(M: number, y: number, I: number): number {
  if (!Number.isFinite(M) || !Number.isFinite(y) || !Number.isFinite(I)) {
    throw new RangeError("M, y, I must be finite");
  }
  if (I <= 0) throw new RangeError("I must be positive");
  return (-M * y) / I;
}

// Maximum stress magnitude in a section under moment M.
//   |σ_max| = |M| * y_max / I = |M| / S, where S = I / y_max (section modulus).
export function maxBendingStress(M: number, s: Section): number {
  validateSection(s);
  if (!Number.isFinite(M)) throw new RangeError("M must be finite");
  const I = momentOfInertia(s);
  const c = yMax(s);
  return (Math.abs(M) * c) / I;
}

export function sectionModulus(s: Section): number {
  validateSection(s);
  return momentOfInertia(s) / yMax(s);
}

function validateSection(s: Section): void {
  if (s.kind === "rect") {
    if (s.b <= 0 || s.h <= 0) throw new RangeError("rect dimensions must be positive");
    return;
  }
  if (s.kind === "circle") {
    if (s.R <= 0) throw new RangeError("circle R must be positive");
    return;
  }
  if (s.B <= 0 || s.H <= 0 || s.b < 0 || s.h < 0) {
    throw new RangeError("ibeam outer dims must be positive, inner non-negative");
  }
  if (s.b >= s.B || s.h >= s.H) {
    throw new RangeError("ibeam inner removal must be smaller than outer");
  }
}
