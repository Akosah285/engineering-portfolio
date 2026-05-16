// 3D stress state. Given the symmetric stress tensor:
//
//   σ = [ σx  τxy τxz ]
//       [ τxy σy  τyz ]
//       [ τxz τyz σz  ]
//
// computes the three principal stresses (eigenvalues), maximum shear stress,
// hydrostatic mean, and von Mises equivalent stress.
//
// Principal stresses are the roots of the characteristic polynomial:
//   λ³ - I₁ λ² + I₂ λ - I₃ = 0
//
// where I₁ = trace, I₂ = sum of 2×2 principal minors, I₃ = det.
// Closed-form (Cardano) via the trig solution for three real roots.
//
// References: Hibbeler §9.5; Boresi & Schmidt §4.

export interface StressTensor {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly txy: number;
  readonly txz: number;
  readonly tyz: number;
}

function validate(s: StressTensor): void {
  for (const v of [s.sx, s.sy, s.sz, s.txy, s.txz, s.tyz]) {
    if (!Number.isFinite(v)) throw new RangeError("stress components must be finite");
  }
}

export function invariants(
  s: StressTensor,
): { I1: number; I2: number; I3: number } {
  validate(s);
  const I1 = s.sx + s.sy + s.sz;
  const I2 =
    s.sx * s.sy +
    s.sy * s.sz +
    s.sz * s.sx -
    (s.txy * s.txy + s.tyz * s.tyz + s.txz * s.txz);
  const I3 =
    s.sx * (s.sy * s.sz - s.tyz * s.tyz) -
    s.txy * (s.txy * s.sz - s.tyz * s.txz) +
    s.txz * (s.txy * s.tyz - s.sy * s.txz);
  return { I1, I2, I3 };
}

// Principal stresses (sorted descending).
export function principalStresses(s: StressTensor): [number, number, number] {
  const { I1, I2, I3 } = invariants(s);
  // Depressed cubic: substitute λ = y + I1/3 ⇒  y³ + p y + q = 0.
  const a = I1 / 3;
  const p = I2 - (I1 * I1) / 3;
  const q = -((2 * Math.pow(I1, 3)) / 27) + (I1 * I2) / 3 - I3;
  // The cubic always has three real roots for a symmetric tensor (real symm matrix).
  // Use trigonometric solution: y_k = 2 √(-p/3) cos((1/3) acos(3q/(2p) √(-3/p)) - 2πk/3).
  let r1: number;
  let r2: number;
  let r3: number;
  if (Math.abs(p) < 1e-14) {
    // Triple root case: y³ + q = 0 ⇒ y = ∛(-q). For a symm tensor, only valid
    // if q is also tiny ⇒ all three roots equal.
    const y = Math.cbrt(-q);
    r1 = a + y;
    r2 = r1;
    r3 = r1;
  } else {
    const m = 2 * Math.sqrt(-p / 3);
    const inner = ((3 * q) / (p * m)) * 1;
    // Clamp to [-1, 1] to absorb rounding error.
    const clamped = Math.max(-1, Math.min(1, inner));
    const theta = Math.acos(clamped) / 3;
    r1 = a + m * Math.cos(theta);
    r2 = a + m * Math.cos(theta - (2 * Math.PI) / 3);
    r3 = a + m * Math.cos(theta - (4 * Math.PI) / 3);
  }
  const sorted = [r1, r2, r3].sort((x, y) => y - x) as [number, number, number];
  return sorted;
}

// Maximum shear stress in 3D = (σ_max - σ_min) / 2.
export function maxShear(s: StressTensor): number {
  const [s1, , s3] = principalStresses(s);
  return (s1 - s3) / 2;
}

// Hydrostatic (mean) stress = I1 / 3.
export function hydrostatic(s: StressTensor): number {
  return invariants(s).I1 / 3;
}

// von Mises equivalent stress in 3D:
//   σ_vm = √(½ [(σ1-σ2)² + (σ2-σ3)² + (σ3-σ1)²])
export function vonMises(s: StressTensor): number {
  const [s1, s2, s3] = principalStresses(s);
  return Math.sqrt(
    0.5 *
      ((s1 - s2) * (s1 - s2) +
        (s2 - s3) * (s2 - s3) +
        (s3 - s1) * (s3 - s1)),
  );
}
