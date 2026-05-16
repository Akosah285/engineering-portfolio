// 2-link planar inverse + forward kinematics for the v8 Mechatronics
// inverse-kinematics demo.  Standard textbook formulas from Spong /
// Lynch & Park; angles in radians, all lengths in the same arbitrary unit.

export interface Pose {
  readonly theta1: number;
  readonly theta2: number;
}

export interface ArmInput extends Pose {
  readonly l1: number;
  readonly l2: number;
}

export interface IKInput {
  readonly x: number;
  readonly y: number;
  readonly l1: number;
  readonly l2: number;
  readonly elbow?: "up" | "down";
}

export interface IKResult {
  readonly poses: Pose[];
  readonly reachable: boolean;
  readonly singular: boolean;
}

/** Forward kinematics: end-effector (x, y) for given joint angles and link lengths. */
export function forwardKinematics(input: ArmInput): {
  x: number;
  y: number;
  elbow: { x: number; y: number };
} {
  if (!(input.l1 > 0) || !(input.l2 > 0)) {
    throw new RangeError("forwardKinematics: l1 and l2 must be > 0.");
  }
  const ex = input.l1 * Math.cos(input.theta1);
  const ey = input.l1 * Math.sin(input.theta1);
  const tipX = ex + input.l2 * Math.cos(input.theta1 + input.theta2);
  const tipY = ey + input.l2 * Math.sin(input.theta1 + input.theta2);
  return { x: tipX, y: tipY, elbow: { x: ex, y: ey } };
}

/**
 * 2-link planar inverse kinematics.
 *
 * Returns up to two solutions (elbow-up and elbow-down).  Sets
 * `reachable=false` when (x,y) is outside the annulus [|l1-l2|, l1+l2]
 * and `singular=true` when the target is exactly on the boundary
 * (single solution: theta2 = 0 or pi).
 */
export function inverseKinematics(input: IKInput): IKResult {
  if (!(input.l1 > 0) || !(input.l2 > 0)) {
    throw new RangeError("inverseKinematics: l1 and l2 must be > 0.");
  }
  const r2 = input.x * input.x + input.y * input.y;
  const r = Math.sqrt(r2);
  const inner = Math.abs(input.l1 - input.l2);
  const outer = input.l1 + input.l2;
  const TOL = 1e-12;
  if (r > outer + TOL || r < inner - TOL) {
    return { poses: [], reachable: false, singular: false };
  }
  const cos2 =
    (r2 - input.l1 * input.l1 - input.l2 * input.l2) / (2 * input.l1 * input.l2);
  // Clamp to [-1, 1] to absorb floating-point overshoot at the boundary.
  const cosClamped = Math.min(1, Math.max(-1, cos2));
  const singular = Math.abs(Math.abs(cosClamped) - 1) < 1e-9;
  const sinPos = Math.sqrt(Math.max(0, 1 - cosClamped * cosClamped));
  const t2up = Math.atan2(sinPos, cosClamped); // elbow up
  const t2dn = Math.atan2(-sinPos, cosClamped); // elbow down
  const phi = Math.atan2(input.y, input.x);
  const psiUp = Math.atan2(
    input.l2 * Math.sin(t2up),
    input.l1 + input.l2 * Math.cos(t2up),
  );
  const psiDn = Math.atan2(
    input.l2 * Math.sin(t2dn),
    input.l1 + input.l2 * Math.cos(t2dn),
  );
  const t1up = phi - psiUp;
  const t1dn = phi - psiDn;
  const elbowUp: Pose = { theta1: t1up, theta2: t2up };
  const elbowDown: Pose = { theta1: t1dn, theta2: t2dn };
  if (singular) {
    return { poses: [elbowUp], reachable: true, singular: true };
  }
  if (input.elbow === "up") return { poses: [elbowUp], reachable: true, singular: false };
  if (input.elbow === "down")
    return { poses: [elbowDown], reachable: true, singular: false };
  return { poses: [elbowUp, elbowDown], reachable: true, singular: false };
}

/** Helper: max workspace radius (l1 + l2). */
export function workspaceOuterRadius(l1: number, l2: number): number {
  return l1 + l2;
}

/** Helper: inner workspace radius (|l1 - l2|). */
export function workspaceInnerRadius(l1: number, l2: number): number {
  return Math.abs(l1 - l2);
}
