/**
 * mohrCircle — pure 2D stress-rotation math for v6 Mohr's Circle (#89).
 *
 * Inputs are the three components of a 2D stress state at a point
 * (sigmaX, sigmaY, tauXY). Outputs include centre + radius of the Mohr
 * circle, principal stresses sigma1 / sigma2, max in-plane shear, and
 * the principal-angle (in radians, measured from the x-axis to the
 * principal direction).
 *
 * Sign convention: the *Mohr circle* sign convention — positive shear
 * rotates a face clockwise on the circle. The *physical* sign convention
 * is independent of this and the React shell handles the visual mapping.
 */

export interface MohrInput {
  readonly sigmaX: number;
  readonly sigmaY: number;
  readonly tauXY: number;
}

export interface MohrResult {
  readonly centre: number;
  readonly radius: number;
  readonly sigma1: number;
  readonly sigma2: number;
  readonly tauMax: number;
  /** Principal angle in radians (rotation from x to the σ₁ direction). */
  readonly thetaP: number;
}

export function mohrCircle(input: MohrInput): MohrResult {
  for (const [name, v] of Object.entries(input)) {
    if (!Number.isFinite(v)) {
      throw new RangeError(`mohrCircle: ${name} must be finite.`);
    }
  }
  const { sigmaX, sigmaY, tauXY } = input;
  const centre = (sigmaX + sigmaY) / 2;
  const halfDelta = (sigmaX - sigmaY) / 2;
  const radius = Math.sqrt(halfDelta * halfDelta + tauXY * tauXY);
  const sigma1 = centre + radius;
  const sigma2 = centre - radius;
  const tauMax = radius;
  // tan(2 thetaP) = 2 tauXY / (sigmaX - sigmaY); use atan2 for branch
  // safety, then divide by 2.
  const thetaP = 0.5 * Math.atan2(2 * tauXY, sigmaX - sigmaY);
  return { centre, radius, sigma1, sigma2, tauMax, thetaP };
}
