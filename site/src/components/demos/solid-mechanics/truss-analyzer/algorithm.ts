// Method-of-joints truss analyzer for statically determinate 2D pin
// trusses.  Used by the v6 Solid Mechanics truss demo (#87 hero).  Pure
// math: no React, no event loop.
//
// Inputs:  joints (x,y), members (i,j), loads (Fx,Fy) at joints,
//          supports (pin = (Rx,Ry); roller = Ry only).
// Output:  member axial forces (positive = tension, negative = compression),
//          support reactions, and a `solvable` flag.
//
// Pulled tightly from Hibbeler Statics chapters 6.

import { decompose, solveWithLU } from "../../../demos/computational-methods/lu-decomposition/algorithm";

export interface Joint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface Member {
  readonly i: string;
  readonly j: string;
}

export interface Load {
  readonly joint: string;
  readonly Fx: number;
  readonly Fy: number;
}

export type Support =
  | { readonly joint: string; readonly kind: "pin" }
  | { readonly joint: string; readonly kind: "roller-x"; }
  | { readonly joint: string; readonly kind: "roller-y" };

export interface TrussInput {
  readonly joints: readonly Joint[];
  readonly members: readonly Member[];
  readonly loads: readonly Load[];
  readonly supports: readonly Support[];
}

export interface TrussResult {
  readonly memberForces: { readonly member: Member; readonly force: number }[];
  readonly reactions: { readonly joint: string; readonly Rx: number; readonly Ry: number }[];
  readonly solvable: boolean;
}

/**
 * Solve a 2D pin-truss with the method of joints.
 *
 * Builds the 2J × U linear system (J = joint count, U = member count + reaction count)
 * by writing equilibrium at every joint and solves via LU.  Determinate
 * trusses must satisfy U = 2J; we surface `solvable=false` for indeterminate
 * or unstable systems.
 */
export function analyze(input: TrussInput): TrussResult {
  const J = input.joints.length;
  const M = input.members.length;
  if (J === 0) throw new RangeError("analyze: at least one joint required.");
  if (M === 0) throw new RangeError("analyze: at least one member required.");
  // Index joint id → index for fast lookup.
  const jointIndex = new Map<string, number>();
  input.joints.forEach((j, idx) => jointIndex.set(j.id, idx));
  // Validate members and supports refer to existing joints.
  for (const m of input.members) {
    if (!jointIndex.has(m.i) || !jointIndex.has(m.j)) {
      throw new RangeError(`analyze: member references unknown joint (${m.i} or ${m.j}).`);
    }
  }
  for (const s of input.supports) {
    if (!jointIndex.has(s.joint)) {
      throw new RangeError(`analyze: support references unknown joint (${s.joint}).`);
    }
  }
  // Count reaction unknowns.
  let nReactions = 0;
  for (const s of input.supports) {
    nReactions += s.kind === "pin" ? 2 : 1;
  }
  const U = M + nReactions;
  // Determinacy check.
  if (U !== 2 * J) {
    return { memberForces: [], reactions: [], solvable: false };
  }
  // Build matrix A (2J x U) and rhs b (2J).
  const A: number[][] = Array.from({ length: 2 * J }, () => new Array<number>(U).fill(0));
  const b = new Array<number>(2 * J).fill(0);
  // Apply loads to the RHS.  Equilibrium: sum of forces = 0, so applied
  // load on a joint shows up as a NEGATIVE on the RHS.
  for (const ld of input.loads) {
    const k = jointIndex.get(ld.joint)!;
    b[2 * k] = b[2 * k]! - ld.Fx;
    b[2 * k + 1] = b[2 * k + 1]! - ld.Fy;
  }
  // Member contributions (axial force assumed tension; cosine + sine of
  // the angle from joint i to joint j; opposite sign at joint j).
  for (let m = 0; m < M; m += 1) {
    const mem = input.members[m]!;
    const i = jointIndex.get(mem.i)!;
    const j = jointIndex.get(mem.j)!;
    const dx = input.joints[j]!.x - input.joints[i]!.x;
    const dy = input.joints[j]!.y - input.joints[i]!.y;
    const L = Math.hypot(dx, dy);
    if (L === 0) throw new RangeError(`analyze: member ${mem.i}-${mem.j} has zero length.`);
    const cx = dx / L;
    const cy = dy / L;
    // Joint i: +cx, +cy
    A[2 * i]![m] = A[2 * i]![m]! + cx;
    A[2 * i + 1]![m] = A[2 * i + 1]![m]! + cy;
    // Joint j: -cx, -cy
    A[2 * j]![m] = A[2 * j]![m]! - cx;
    A[2 * j + 1]![m] = A[2 * j + 1]![m]! - cy;
  }
  // Reaction contributions.
  let col = M;
  const reactionMeta: { joint: string; component: "Rx" | "Ry"; col: number }[] = [];
  for (const s of input.supports) {
    const k = jointIndex.get(s.joint)!;
    if (s.kind === "pin") {
      A[2 * k]![col] = 1;
      reactionMeta.push({ joint: s.joint, component: "Rx", col });
      col += 1;
      A[2 * k + 1]![col] = 1;
      reactionMeta.push({ joint: s.joint, component: "Ry", col });
      col += 1;
    } else if (s.kind === "roller-x") {
      A[2 * k]![col] = 1;
      reactionMeta.push({ joint: s.joint, component: "Rx", col });
      col += 1;
    } else {
      A[2 * k + 1]![col] = 1;
      reactionMeta.push({ joint: s.joint, component: "Ry", col });
      col += 1;
    }
  }
  const lu = decompose(A);
  if (lu.singular) return { memberForces: [], reactions: [], solvable: false };
  const x = solveWithLU({ lu, b });
  if (x.some((v) => Number.isNaN(v))) return { memberForces: [], reactions: [], solvable: false };
  // Pack member forces.
  const memberForces = input.members.map((mem, m) => ({ member: mem, force: x[m]! }));
  // Pack reactions: aggregate Rx/Ry per supported joint.
  const reactionsMap = new Map<string, { Rx: number; Ry: number }>();
  for (const s of input.supports) {
    if (!reactionsMap.has(s.joint)) reactionsMap.set(s.joint, { Rx: 0, Ry: 0 });
  }
  for (const r of reactionMeta) {
    const entry = reactionsMap.get(r.joint)!;
    if (r.component === "Rx") entry.Rx = x[r.col]!;
    else entry.Ry = x[r.col]!;
  }
  const reactions = Array.from(reactionsMap.entries()).map(([joint, v]) => ({
    joint,
    Rx: v.Rx,
    Ry: v.Ry,
  }));
  return { memberForces, reactions, solvable: true };
}
