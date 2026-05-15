/**
 * stressStrain — synthetic stress-strain curve for ductile metals (#90 v6).
 *
 * Three-region model:
 *   1. Linear elastic:   σ = E · ε,                     ε ∈ [0, ε_y]
 *   2. Plastic plateau:  σ = σ_y,                        ε ∈ (ε_y, ε_h]
 *   3. Strain hardening: σ = σ_y + (σ_u − σ_y) · q(ε),  ε ∈ (ε_h, ε_u]
 *      where q(ε) is a smooth shape function (1 - exp(-α·(ε−ε_h)/(ε_u−ε_h)))
 *      tuned so q(ε_u) ≈ 1 — exact agreement at the ultimate point isn't
 *      required for a teaching demo; it's about the SHAPE.
 *   4. Necking / failure: σ drops linearly from σ_u at ε_u to 0 at ε_f.
 *
 * The yield strain ε_y is derived from σ_y / E.  All inputs in SI (Pa, -).
 *
 * The React shell will plot σ(ε) and overlay the proportional limit, yield
 * point (0.2% offset), ultimate strength, and fracture point.
 */

export interface StressStrainParams {
  /** Young's modulus E [Pa]. Must be > 0. */
  readonly E: number;
  /** Yield stress σ_y [Pa]. Must be > 0. */
  readonly yieldStress: number;
  /** Ultimate tensile stress σ_u [Pa]. Must be > σ_y. */
  readonly ultimateStress: number;
  /** Strain at the END of the plastic plateau (start of strain-hardening). */
  readonly plateauEndStrain: number;
  /** Strain at the ultimate stress. Must be > plateauEndStrain. */
  readonly ultimateStrain: number;
  /** Failure (fracture) strain. Must be > ultimateStrain. */
  readonly failureStrain: number;
  /** Shape sharpness for strain hardening; default 4 (small numbers ⇒ flatter). */
  readonly hardeningSharpness?: number;
}

function checkParams(p: StressStrainParams): void {
  const checks: [string, number, "positive" | "finite"][] = [
    ["E", p.E, "positive"],
    ["yieldStress", p.yieldStress, "positive"],
    ["ultimateStress", p.ultimateStress, "positive"],
    ["plateauEndStrain", p.plateauEndStrain, "positive"],
    ["ultimateStrain", p.ultimateStrain, "positive"],
    ["failureStrain", p.failureStrain, "positive"],
  ];
  for (const [name, value, kind] of checks) {
    if (!Number.isFinite(value) || (kind === "positive" && value <= 0)) {
      throw new RangeError(`stressStrain: ${name} must be > 0 and finite.`);
    }
  }
  const yieldStrain = p.yieldStress / p.E;
  if (p.plateauEndStrain < yieldStrain) {
    throw new RangeError(
      "stressStrain: plateauEndStrain must be >= yield strain (σ_y/E).",
    );
  }
  if (p.ultimateStrain <= p.plateauEndStrain) {
    throw new RangeError(
      "stressStrain: ultimateStrain must be > plateauEndStrain.",
    );
  }
  if (p.failureStrain <= p.ultimateStrain) {
    throw new RangeError(
      "stressStrain: failureStrain must be > ultimateStrain.",
    );
  }
  if (p.ultimateStress <= p.yieldStress) {
    throw new RangeError(
      "stressStrain: ultimateStress must be > yieldStress.",
    );
  }
  if (p.hardeningSharpness !== undefined) {
    if (!Number.isFinite(p.hardeningSharpness) || p.hardeningSharpness <= 0) {
      throw new RangeError("stressStrain: hardeningSharpness must be > 0.");
    }
  }
}

export function yieldStrain(p: StressStrainParams): number {
  checkParams(p);
  return p.yieldStress / p.E;
}

export function stressAt(p: StressStrainParams, strain: number): number {
  checkParams(p);
  if (!Number.isFinite(strain) || strain < 0) {
    throw new RangeError("stressStrain: strain must be >= 0 and finite.");
  }
  const ey = p.yieldStress / p.E;
  const sharpness = p.hardeningSharpness ?? 4;

  if (strain <= ey) {
    return p.E * strain;
  }
  if (strain <= p.plateauEndStrain) {
    return p.yieldStress;
  }
  if (strain <= p.ultimateStrain) {
    const u = (strain - p.plateauEndStrain) / (p.ultimateStrain - p.plateauEndStrain);
    const q = 1 - Math.exp(-sharpness * u);
    // Normalise so q(1) at u=1 lands close to 1 (won't be exact for finite α).
    const qMax = 1 - Math.exp(-sharpness);
    return p.yieldStress + (p.ultimateStress - p.yieldStress) * (q / qMax);
  }
  if (strain <= p.failureStrain) {
    // Linear drop from σ_u to 0 in the necking region
    const u = (strain - p.ultimateStrain) / (p.failureStrain - p.ultimateStrain);
    return p.ultimateStress * (1 - u);
  }
  return 0; // post-fracture
}

export function curve(p: StressStrainParams, samples: number): { strain: number; stress: number }[] {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("stressStrain: samples must be an integer >= 2.");
  }
  checkParams(p);
  const out: { strain: number; stress: number }[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const strain = (i / (samples - 1)) * p.failureStrain;
    out[i] = { strain, stress: stressAt(p, strain) };
  }
  return out;
}
