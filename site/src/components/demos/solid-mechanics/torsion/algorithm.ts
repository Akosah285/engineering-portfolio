/**
 * torsion — circular-shaft torsion analysis (#92).
 *
 * For circular cross-sections under pure torsion:
 *
 *     τ_max = T · c / J          (max shear stress at outer radius c)
 *     φ     = T · L / (G · J)    (angle of twist over length L, radians)
 *
 * J (polar moment of area):
 *     solid:  J = π · r⁴ / 2
 *     hollow: J = π · (r_o⁴ − r_i⁴) / 2
 *
 * Inputs are SI: lengths in m, T in N·m, G in Pa.  Output τ in Pa, φ in rad.
 *
 * The closed-form formulas only apply to circular (solid or annular) shafts.
 * Non-circular cross-sections warp under torsion and require a different
 * formulation (e.g. the membrane analogy or finite-element analysis).
 */

export interface SolidShaftGeometry {
  readonly kind: "solid";
  /** Outer radius [m]. */
  readonly radius: number;
}

export interface HollowShaftGeometry {
  readonly kind: "hollow";
  /** Outer radius [m]. */
  readonly outerRadius: number;
  /** Inner radius [m]. Must be < outerRadius and >= 0. */
  readonly innerRadius: number;
}

export type ShaftGeometry = SolidShaftGeometry | HollowShaftGeometry;

export interface TorsionInput {
  /** Applied torque [N·m]. May be negative; sign is preserved in φ. */
  readonly torque: number;
  /** Length over which torque is applied [m]. Must be > 0. */
  readonly length: number;
  /** Shear modulus [Pa]. Must be > 0. */
  readonly shearModulus: number;
  readonly geometry: ShaftGeometry;
}

export interface TorsionResult {
  /** Polar moment of area J [m^4]. */
  readonly J: number;
  /** Outer radius (used for τ_max) [m]. */
  readonly outerRadius: number;
  /** Maximum shear stress τ_max [Pa] (always non-negative). */
  readonly maxShearStress: number;
  /**
   * Angle of twist [rad] over `length`. Sign matches the sign of `torque`.
   */
  readonly twistAngle: number;
  /**
   * Twist-per-unit-length φ/L [rad/m]. Convenient for plotting along
   * stepped-shaft diagrams.
   */
  readonly twistRate: number;
}

function checkPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new RangeError(`torsion: ${name} must be > 0 and finite.`);
  }
}

function checkFinite(name: string, v: number): void {
  if (!Number.isFinite(v)) {
    throw new RangeError(`torsion: ${name} must be finite.`);
  }
}

export function polarMomentOfArea(geometry: ShaftGeometry): number {
  if (geometry.kind === "solid") {
    checkPositive("radius", geometry.radius);
    return (Math.PI * geometry.radius ** 4) / 2;
  }
  checkPositive("outerRadius", geometry.outerRadius);
  if (!Number.isFinite(geometry.innerRadius) || geometry.innerRadius < 0) {
    throw new RangeError("torsion: innerRadius must be finite and >= 0.");
  }
  if (geometry.innerRadius >= geometry.outerRadius) {
    throw new RangeError("torsion: innerRadius must be < outerRadius.");
  }
  return (
    (Math.PI * (geometry.outerRadius ** 4 - geometry.innerRadius ** 4)) / 2
  );
}

function outerRadiusOf(geometry: ShaftGeometry): number {
  return geometry.kind === "solid" ? geometry.radius : geometry.outerRadius;
}

export function torsionAnalysis(input: TorsionInput): TorsionResult {
  checkFinite("torque", input.torque);
  checkPositive("length", input.length);
  checkPositive("shearModulus", input.shearModulus);

  const J = polarMomentOfArea(input.geometry);
  const c = outerRadiusOf(input.geometry);
  const maxShearStress = Math.abs(input.torque) * c / J;
  const twistAngle = (input.torque * input.length) / (input.shearModulus * J);
  const twistRate = twistAngle / input.length;
  return { J, outerRadius: c, maxShearStress, twistAngle, twistRate };
}
