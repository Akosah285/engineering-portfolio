// Shear and moment diagrams for a simply-supported beam carrying an
// arbitrary mix of point loads, point moments, and uniformly distributed
// loads.  Used by the v6 Solid Mechanics shear-moment demo (#96).
//
// Pure math, no React.  Reactions come from sum F = 0 and sum M_A = 0;
// V(x) and M(x) are computed by walking left-to-right and applying each
// load as it is encountered.

export interface PointLoad {
  /** Position from left support (m). */
  readonly x: number;
  /** Magnitude (N), positive = downward. */
  readonly P: number;
}

export interface PointMoment {
  readonly x: number;
  /** Magnitude (N·m), positive = CCW (right-hand rule). */
  readonly M: number;
}

export interface Udl {
  readonly xStart: number;
  readonly xEnd: number;
  /** Intensity (N/m), positive = downward. */
  readonly w: number;
}

export interface BeamInput {
  readonly L: number;
  readonly pointLoads?: readonly PointLoad[];
  readonly pointMoments?: readonly PointMoment[];
  readonly udls?: readonly Udl[];
  /** Number of evaluation points along the span (default 200). */
  readonly nSamples?: number;
}

export interface BeamResult {
  readonly RA: number;
  readonly RB: number;
  readonly samples: { readonly x: number; readonly V: number; readonly M: number }[];
}

/** Reaction at A (left) for a single point load via lever arm. */
function reactionsFromPoint(L: number, p: PointLoad): { RA: number; RB: number } {
  // Sum M_A = 0 ⇒ RB·L = P·xP  ⇒  RB = P xP / L,  RA = P - RB
  const RB = (p.P * p.x) / L;
  const RA = p.P - RB;
  return { RA, RB };
}

function reactionsFromMoment(L: number, m: PointMoment): { RA: number; RB: number } {
  // Sum M_A = 0 ⇒ RB·L = -M  ⇒  RB = -M/L; sum F = 0 ⇒ RA = -RB
  const RB = -m.M / L;
  const RA = -RB;
  return { RA, RB };
}

function reactionsFromUdl(L: number, u: Udl): { RA: number; RB: number } {
  const W = u.w * (u.xEnd - u.xStart);
  const xc = (u.xStart + u.xEnd) / 2;
  const RB = (W * xc) / L;
  const RA = W - RB;
  return { RA, RB };
}

/**
 * Compute the shear and moment diagrams for a simply-supported beam.
 * Boundary conditions: V(0) = RA, M(0) = 0 (pin), M(L) = 0 (roller).
 */
export function analyze(input: BeamInput): BeamResult {
  if (!(input.L > 0)) throw new RangeError("analyze: L must be > 0.");
  const nSamples = input.nSamples ?? 200;
  if (!Number.isInteger(nSamples) || nSamples < 3) {
    throw new RangeError("analyze: nSamples must be an integer >= 3.");
  }
  // Validate all positions are within [0, L].
  for (const p of input.pointLoads ?? []) {
    if (!(p.x >= 0 && p.x <= input.L)) throw new RangeError("analyze: point load outside [0, L].");
  }
  for (const m of input.pointMoments ?? []) {
    if (!(m.x >= 0 && m.x <= input.L)) throw new RangeError("analyze: moment outside [0, L].");
  }
  for (const u of input.udls ?? []) {
    if (!(u.xStart >= 0 && u.xEnd <= input.L && u.xEnd > u.xStart)) {
      throw new RangeError("analyze: UDL outside [0, L] or zero length.");
    }
  }
  let RA = 0;
  let RB = 0;
  for (const p of input.pointLoads ?? []) {
    const r = reactionsFromPoint(input.L, p);
    RA += r.RA;
    RB += r.RB;
  }
  for (const m of input.pointMoments ?? []) {
    const r = reactionsFromMoment(input.L, m);
    RA += r.RA;
    RB += r.RB;
  }
  for (const u of input.udls ?? []) {
    const r = reactionsFromUdl(input.L, u);
    RA += r.RA;
    RB += r.RB;
  }
  // Sample V and M.
  const samples = new Array<{ x: number; V: number; M: number }>(nSamples);
  // Pre-aggregate point-load and moment lists for fast evaluation.
  const pls = (input.pointLoads ?? []).slice().sort((a, b) => a.x - b.x);
  const pms = (input.pointMoments ?? []).slice().sort((a, b) => a.x - b.x);
  const uds = input.udls ?? [];
  for (let i = 0; i < nSamples; i += 1) {
    const x = (i / (nSamples - 1)) * input.L;
    let V = RA;
    let M = RA * x;
    for (const p of pls) {
      if (p.x <= x) {
        V -= p.P;
        M -= p.P * (x - p.x);
      } else break;
    }
    for (const m of pms) {
      if (m.x <= x) {
        // Just past a CCW moment, internal moment drops by M.
        M -= m.M;
      } else break;
    }
    for (const u of uds) {
      if (x <= u.xStart) continue;
      const xs = u.xStart;
      const xe = Math.min(x, u.xEnd);
      const Wapplied = u.w * (xe - xs);
      const xCentroid = (xs + xe) / 2;
      V -= Wapplied;
      M -= Wapplied * (x - xCentroid);
    }
    samples[i] = { x, V, M };
  }
  return { RA, RB, samples };
}
