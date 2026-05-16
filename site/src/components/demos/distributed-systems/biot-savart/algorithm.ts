// Biot-Savart magnetic field from straight current segments.  Used by
// the v7 Distributed Systems Biot-Savart demo.  Numerical integration
// along each segment with a uniform sample density.
//
// All units in SI (Tesla); μ0/4π = 1e-7 by definition.

const MU0_OVER_4PI = 1e-7;

export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly current: number;
}

export interface FieldPoint {
  /** B_z (perpendicular to the xy plane). */
  readonly Bz: number;
}

export interface BiotInput {
  readonly segments: readonly Segment[];
  readonly x: number;
  readonly y: number;
  readonly samples?: number;
  readonly singularityTol?: number;
}

/**
 * B_z at (x, y) from a collection of current-carrying straight segments
 * lying in the xy plane.  Carriers are 2D so the field is purely in z.
 *
 * Per segment we integrate dB = (μ0 I / 4π) * (dl × r̂) / r².
 *
 * Returns Bz = NaN if the field point lies on any segment within
 * `singularityTol` (default 1e-9) measured as Euclidean distance to the
 * segment (not just the sample points).
 */
export function fieldAt(input: BiotInput): FieldPoint {
  const samples = input.samples ?? 200;
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("fieldAt: samples must be an integer >= 2.");
  }
  const tol = input.singularityTol ?? 1e-9;
  if (!(tol >= 0)) throw new RangeError("fieldAt: singularityTol must be >= 0.");
  // Singularity check first: is (x,y) on any segment within tol?
  for (const seg of input.segments) {
    if (pointSegmentDistance(input.x, input.y, seg) <= tol) {
      return { Bz: Number.NaN };
    }
  }
  let Bz = 0;
  for (const seg of input.segments) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const stepX = dx / samples;
    const stepY = dy / samples;
    for (let i = 0; i < samples; i += 1) {
      const sx = seg.x1 + stepX * (i + 0.5);
      const sy = seg.y1 + stepY * (i + 0.5);
      const rx = input.x - sx;
      const ry = input.y - sy;
      const r2 = rx * rx + ry * ry;
      // (dl × r̂)_z = (dl_x * r_y - dl_y * r_x) / r
      const cross = stepX * ry - stepY * rx;
      Bz += (MU0_OVER_4PI * seg.current * cross) / (r2 * Math.sqrt(r2));
    }
  }
  return { Bz };
}

function pointSegmentDistance(px: number, py: number, seg: Segment): number {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - seg.x1, py - seg.y1);
  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = seg.x1 + t * dx;
  const cy = seg.y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Closed-form B_z on the axis of a circular loop of radius R carrying
 * current I, distance z above the loop center:
 *
 *   B_z = μ0 I R^2 / (2 (R^2 + z^2)^{3/2})
 */
export function loopAxisField(R: number, I: number, z: number): number {
  if (!(R > 0)) throw new RangeError("loopAxisField: R must be > 0.");
  const denom = (R * R + z * z) ** 1.5;
  return (4 * Math.PI * MU0_OVER_4PI * I * R * R) / (2 * denom);
}

/** Build N straight segments approximating a circular loop in the xy plane. */
export function circularLoop(
  R: number,
  I: number,
  nSegments: number,
  cx = 0,
  cy = 0,
): Segment[] {
  if (!(R > 0)) throw new RangeError("circularLoop: R must be > 0.");
  if (!Number.isInteger(nSegments) || nSegments < 3) {
    throw new RangeError("circularLoop: nSegments must be an integer >= 3.");
  }
  const out: Segment[] = new Array(nSegments);
  for (let i = 0; i < nSegments; i += 1) {
    const a1 = (2 * Math.PI * i) / nSegments;
    const a2 = (2 * Math.PI * (i + 1)) / nSegments;
    out[i] = {
      x1: cx + R * Math.cos(a1),
      y1: cy + R * Math.sin(a1),
      x2: cx + R * Math.cos(a2),
      y2: cy + R * Math.sin(a2),
      current: I,
    };
  }
  return out;
}

export const MU0 = 4 * Math.PI * MU0_OVER_4PI;
