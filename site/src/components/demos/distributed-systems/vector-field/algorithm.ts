// Generic 2D vector field sampling primitive. Used by:
//   - Charge field plotter (#97) — already shipped its own algorithm.
//   - Vector field visualizer (#101) — this generic version.
//
// Given f: (x, y) → (Fx, Fy), sample on a regular grid spanning [xmin, xmax]×
// [ymin, ymax] with (nx × ny) points. Returns flat arrays of x, y, Fx, Fy +
// per-point magnitudes for arrow scaling.
//
// Also computes:
//   - maxMagnitude (for normalization),
//   - divergence (numerical, central differences),
//   - curl-z (∂Fy/∂x - ∂Fx/∂y),
// at the same grid points (boundary uses forward/backward diff).

export interface FieldSample {
  readonly x: number;
  readonly y: number;
  readonly fx: number;
  readonly fy: number;
  readonly magnitude: number;
}

export interface FieldGridInput {
  readonly f: (x: number, y: number) => { fx: number; fy: number };
  readonly xmin: number;
  readonly xmax: number;
  readonly ymin: number;
  readonly ymax: number;
  readonly nx: number;
  readonly ny: number;
}

export interface FieldGrid {
  readonly samples: readonly FieldSample[];
  readonly maxMagnitude: number;
  readonly nx: number;
  readonly ny: number;
}

function validate(input: FieldGridInput): void {
  if (!Number.isInteger(input.nx) || !Number.isInteger(input.ny)) {
    throw new RangeError("nx, ny must be integers");
  }
  if (input.nx < 2 || input.ny < 2) throw new RangeError("nx, ny must be >= 2");
  if (input.xmin >= input.xmax) throw new RangeError("xmin must be < xmax");
  if (input.ymin >= input.ymax) throw new RangeError("ymin must be < ymax");
  for (const v of [input.xmin, input.xmax, input.ymin, input.ymax]) {
    if (!Number.isFinite(v)) throw new RangeError("bounds must be finite");
  }
}

export function sampleGrid(input: FieldGridInput): FieldGrid {
  validate(input);
  const { f, xmin, xmax, ymin, ymax, nx, ny } = input;
  const dx = (xmax - xmin) / (nx - 1);
  const dy = (ymax - ymin) / (ny - 1);
  const samples: FieldSample[] = [];
  let maxMag = 0;
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const x = xmin + ix * dx;
      const y = ymin + iy * dy;
      const v = f(x, y);
      if (!Number.isFinite(v.fx) || !Number.isFinite(v.fy)) {
        throw new RangeError(`field produced non-finite at (${x}, ${y})`);
      }
      const m = Math.hypot(v.fx, v.fy);
      if (m > maxMag) maxMag = m;
      samples.push({ x, y, fx: v.fx, fy: v.fy, magnitude: m });
    }
  }
  return { samples, maxMagnitude: maxMag, nx, ny };
}

// Compute divergence at each grid point (central differences interior, forward/backward boundary).
export function divergence(
  grid: FieldGrid,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
): number[] {
  const { samples, nx, ny } = grid;
  const dx = (xmax - xmin) / (nx - 1);
  const dy = (ymax - ymin) / (ny - 1);
  const out = new Array<number>(samples.length).fill(0);
  const at = (ix: number, iy: number) => samples[iy * nx + ix]!;
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      let dfx: number;
      let dfy: number;
      if (ix === 0) dfx = (at(1, iy).fx - at(0, iy).fx) / dx;
      else if (ix === nx - 1) dfx = (at(nx - 1, iy).fx - at(nx - 2, iy).fx) / dx;
      else dfx = (at(ix + 1, iy).fx - at(ix - 1, iy).fx) / (2 * dx);
      if (iy === 0) dfy = (at(ix, 1).fy - at(ix, 0).fy) / dy;
      else if (iy === ny - 1) dfy = (at(ix, ny - 1).fy - at(ix, ny - 2).fy) / dy;
      else dfy = (at(ix, iy + 1).fy - at(ix, iy - 1).fy) / (2 * dy);
      out[iy * nx + ix] = dfx + dfy;
    }
  }
  return out;
}

// Curl-z = ∂Fy/∂x - ∂Fx/∂y
export function curlZ(
  grid: FieldGrid,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
): number[] {
  const { samples, nx, ny } = grid;
  const dx = (xmax - xmin) / (nx - 1);
  const dy = (ymax - ymin) / (ny - 1);
  const out = new Array<number>(samples.length).fill(0);
  const at = (ix: number, iy: number) => samples[iy * nx + ix]!;
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      let dfyx: number;
      let dfxy: number;
      if (ix === 0) dfyx = (at(1, iy).fy - at(0, iy).fy) / dx;
      else if (ix === nx - 1) dfyx = (at(nx - 1, iy).fy - at(nx - 2, iy).fy) / dx;
      else dfyx = (at(ix + 1, iy).fy - at(ix - 1, iy).fy) / (2 * dx);
      if (iy === 0) dfxy = (at(ix, 1).fx - at(ix, 0).fx) / dy;
      else if (iy === ny - 1) dfxy = (at(ix, ny - 1).fx - at(ix, ny - 2).fx) / dy;
      else dfxy = (at(ix, iy + 1).fx - at(ix, iy - 1).fx) / (2 * dy);
      out[iy * nx + ix] = dfyx - dfxy;
    }
  }
  return out;
}
