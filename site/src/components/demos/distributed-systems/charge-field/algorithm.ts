/**
 * chargeField — 2D electrostatic field from N point charges (#97 v7 hero).
 *
 * In 2D Coulomb's law (or equivalently 3D with translation-invariance along z):
 *
 *     E(r) = k · Σᵢ qᵢ · (r − rᵢ) / |r − rᵢ|³
 *     V(r) = k · Σᵢ qᵢ / |r − rᵢ|
 *
 * where k = 1/(4πε₀).  We expose k as a parameter so the React shell can
 * use natural "demo units" (k=1 by default) for clear field-line plotting.
 *
 * Field at the location of a charge itself is undefined; we return
 * Number.NaN for both Ex and Ey (and Infinity for V) at exact coincidence.
 */

export interface PointCharge {
  /** Position [x, y]. */
  readonly x: number;
  readonly y: number;
  /** Charge q (signed). */
  readonly q: number;
}

export interface FieldVector {
  readonly Ex: number;
  readonly Ey: number;
  /** Magnitude |E|. */
  readonly magnitude: number;
  /** Electric potential V at the same point. */
  readonly potential: number;
}

export interface FieldInput {
  readonly charges: ReadonlyArray<PointCharge>;
  readonly x: number;
  readonly y: number;
  /** Coulomb's constant. Default 1 (demo units). */
  readonly k?: number;
}

const SINGULARITY_TOL = 1e-12;

function checkCharges(charges: ReadonlyArray<PointCharge>): void {
  for (const c of charges) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.q)) {
      throw new RangeError("chargeField: charge fields must be finite.");
    }
  }
}

export function fieldAt(input: FieldInput): FieldVector {
  checkCharges(input.charges);
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) {
    throw new RangeError("chargeField: x and y must be finite.");
  }
  const k = input.k ?? 1;
  if (!Number.isFinite(k)) {
    throw new RangeError("chargeField: k must be finite.");
  }

  let Ex = 0;
  let Ey = 0;
  let V = 0;
  let onCharge = false;
  for (const c of input.charges) {
    const dx = input.x - c.x;
    const dy = input.y - c.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < SINGULARITY_TOL) {
      onCharge = true;
      // Don't accumulate this charge's contribution; we mark the result
      // as singular afterwards rather than producing infinities mid-loop.
      continue;
    }
    const r = Math.sqrt(r2);
    const r3 = r2 * r;
    const f = (k * c.q) / r3;
    Ex += f * dx;
    Ey += f * dy;
    V += (k * c.q) / r;
  }

  if (onCharge) {
    return {
      Ex: Number.NaN,
      Ey: Number.NaN,
      magnitude: Number.NaN,
      potential: Number.POSITIVE_INFINITY,
    };
  }
  return { Ex, Ey, magnitude: Math.hypot(Ex, Ey), potential: V };
}

export interface GridFieldInput {
  readonly charges: ReadonlyArray<PointCharge>;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly nx: number;
  readonly ny: number;
  readonly k?: number;
}

export interface GridSamplePoint extends FieldVector {
  readonly x: number;
  readonly y: number;
}

/**
 * Sample the field on a regular grid for vector-field rendering.
 * Returns a flat row-major array of length nx*ny.
 */
export function fieldGrid(input: GridFieldInput): GridSamplePoint[] {
  if (
    !Number.isInteger(input.nx) ||
    input.nx < 2 ||
    !Number.isInteger(input.ny) ||
    input.ny < 2
  ) {
    throw new RangeError("chargeField: nx and ny must be integers >= 2.");
  }
  if (input.xMax <= input.xMin || input.yMax <= input.yMin) {
    throw new RangeError("chargeField: grid bounds must satisfy max > min.");
  }
  const out: GridSamplePoint[] = new Array(input.nx * input.ny);
  for (let j = 0; j < input.ny; j += 1) {
    const y = input.yMin + (j / (input.ny - 1)) * (input.yMax - input.yMin);
    for (let i = 0; i < input.nx; i += 1) {
      const x = input.xMin + (i / (input.nx - 1)) * (input.xMax - input.xMin);
      const f =
        input.k === undefined
          ? fieldAt({ charges: input.charges, x, y })
          : fieldAt({ charges: input.charges, x, y, k: input.k });
      out[j * input.nx + i] = { x, y, ...f };
    }
  }
  return out;
}
