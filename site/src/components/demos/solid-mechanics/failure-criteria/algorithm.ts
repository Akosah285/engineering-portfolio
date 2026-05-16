// Failure criteria for ductile + brittle materials under 2D principal stresses.
// Inputs: principal stresses (σ1, σ2) and material yield σ_y.
//
// Implemented:
//   - Maximum Shear Stress (Tresca): yields if max(|σ1|, |σ2|, |σ1-σ2|) ≥ σ_y
//   - Distortion Energy (von Mises): yields if √(σ1² - σ1·σ2 + σ2²) ≥ σ_y
//   - Maximum Normal Stress (Rankine, brittle): yields if max(|σ1|, |σ2|) ≥ σ_y
//
// References: Hibbeler, Mechanics of Materials §10.7-10.8.

export interface PrincipalStress {
  readonly s1: number;
  readonly s2: number;
}

function validate(p: PrincipalStress, sy: number): void {
  if (!Number.isFinite(p.s1) || !Number.isFinite(p.s2)) {
    throw new RangeError("principal stresses must be finite");
  }
  if (!Number.isFinite(sy) || sy <= 0) {
    throw new RangeError("yield strength must be positive finite");
  }
}

// Maximum shear stress = max of |σ1|, |σ2|, |σ1 - σ2| (taking σ3 = 0 in 2D).
export function trescaStress(p: PrincipalStress): number {
  return Math.max(Math.abs(p.s1), Math.abs(p.s2), Math.abs(p.s1 - p.s2));
}

export function trescaSafetyFactor(p: PrincipalStress, sy: number): number {
  validate(p, sy);
  const eq = trescaStress(p);
  return eq === 0 ? Number.POSITIVE_INFINITY : sy / eq;
}

export function tresca(p: PrincipalStress, sy: number): boolean {
  return trescaSafetyFactor(p, sy) <= 1;
}

// Von Mises equivalent stress (plane stress).
export function vonMisesStress(p: PrincipalStress): number {
  return Math.sqrt(p.s1 * p.s1 - p.s1 * p.s2 + p.s2 * p.s2);
}

export function vonMisesSafetyFactor(p: PrincipalStress, sy: number): number {
  validate(p, sy);
  const eq = vonMisesStress(p);
  return eq === 0 ? Number.POSITIVE_INFINITY : sy / eq;
}

export function vonMises(p: PrincipalStress, sy: number): boolean {
  return vonMisesSafetyFactor(p, sy) <= 1;
}

// Maximum normal stress (Rankine) — brittle.
export function rankineStress(p: PrincipalStress): number {
  return Math.max(Math.abs(p.s1), Math.abs(p.s2));
}

export function rankineSafetyFactor(p: PrincipalStress, sy: number): number {
  validate(p, sy);
  const eq = rankineStress(p);
  return eq === 0 ? Number.POSITIVE_INFINITY : sy / eq;
}

export function rankine(p: PrincipalStress, sy: number): boolean {
  return rankineSafetyFactor(p, sy) <= 1;
}
