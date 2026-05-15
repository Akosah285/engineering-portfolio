/**
 * eulerBuckling — Euler's critical-load formula for slender columns (#91).
 *
 *     P_cr = (π² · E · I) / (K · L)²
 *
 * E  Young's modulus [Pa]
 * I  smallest second moment of area of the cross-section [m⁴]
 * L  unsupported column length [m]
 * K  effective-length factor (dimensionless), depends on end conditions:
 *      pinned-pinned       K = 1.0  (Euler's reference case)
 *      fixed-fixed         K = 0.5
 *      fixed-pinned        K = 0.7  (theoretical 0.6992; AISC: 0.7)
 *      fixed-free          K = 2.0  (cantilever)
 *
 * The slenderness ratio λ = L_eff / r where r = √(I/A) is the radius of
 * gyration. Euler's formula is valid only when λ exceeds the critical
 * slenderness ratio λ_c = π · √(E/σ_y); below that, short-column failure
 * (yield) governs.
 */

export type EndCondition =
  | "pinned-pinned"
  | "fixed-fixed"
  | "fixed-pinned"
  | "fixed-free";

const K_FACTORS: Readonly<Record<EndCondition, number>> = {
  "pinned-pinned": 1.0,
  "fixed-fixed": 0.5,
  "fixed-pinned": 0.7,
  "fixed-free": 2.0,
};

export interface BucklingInput {
  /** Young's modulus [Pa]. */
  readonly E: number;
  /** Smallest second moment of area of the cross-section [m^4]. */
  readonly I: number;
  /** Unsupported length of the column [m]. */
  readonly L: number;
  readonly endCondition: EndCondition;
  /** Cross-sectional area [m^2]. Required for slenderness-ratio output. */
  readonly area?: number;
  /** Yield stress [Pa]. If supplied, validIfSlenderEnough is computed. */
  readonly yieldStress?: number;
}

export interface BucklingResult {
  /** Effective-length factor used (K). */
  readonly K: number;
  /** Effective length K·L [m]. */
  readonly effectiveLength: number;
  /** Critical buckling load [N]. */
  readonly criticalLoad: number;
  /** Critical compressive stress P_cr / A [Pa] — only if `area` was given. */
  readonly criticalStress: number | null;
  /** Slenderness ratio λ = L_eff / √(I/A) — only if `area` was given. */
  readonly slendernessRatio: number | null;
  /**
   * Critical slenderness ratio λ_c = π · √(E/σ_y).
   * Euler's curve is only valid for λ > λ_c (above it, σ_cr < σ_y).
   * Null if `yieldStress` is not supplied.
   */
  readonly criticalSlenderness: number | null;
  /**
   * True iff slendernessRatio ≥ criticalSlenderness — i.e. the column is
   * actually slender enough for Euler buckling (rather than yield) to govern.
   * Null when either `area` or `yieldStress` is missing.
   */
  readonly validIfSlenderEnough: boolean | null;
}

function checkPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new RangeError(`eulerBuckling: ${name} must be > 0 and finite.`);
  }
}

export function eulerCriticalLoad(input: BucklingInput): BucklingResult {
  checkPositive("E", input.E);
  checkPositive("I", input.I);
  checkPositive("L", input.L);
  if (!(input.endCondition in K_FACTORS)) {
    throw new RangeError(`eulerBuckling: unknown endCondition '${input.endCondition}'.`);
  }
  if (input.area !== undefined) checkPositive("area", input.area);
  if (input.yieldStress !== undefined) checkPositive("yieldStress", input.yieldStress);

  const K = K_FACTORS[input.endCondition];
  const effectiveLength = K * input.L;
  const criticalLoad = (Math.PI ** 2 * input.E * input.I) / effectiveLength ** 2;

  let criticalStress: number | null = null;
  let slendernessRatio: number | null = null;
  if (input.area !== undefined) {
    criticalStress = criticalLoad / input.area;
    const r = Math.sqrt(input.I / input.area); // radius of gyration
    slendernessRatio = effectiveLength / r;
  }

  let criticalSlenderness: number | null = null;
  let validIfSlenderEnough: boolean | null = null;
  if (input.yieldStress !== undefined) {
    criticalSlenderness = Math.PI * Math.sqrt(input.E / input.yieldStress);
    if (slendernessRatio !== null) {
      validIfSlenderEnough = slendernessRatio >= criticalSlenderness;
    }
  }

  return {
    K,
    effectiveLength,
    criticalLoad,
    criticalStress,
    slendernessRatio,
    criticalSlenderness,
    validIfSlenderEnough,
  };
}
