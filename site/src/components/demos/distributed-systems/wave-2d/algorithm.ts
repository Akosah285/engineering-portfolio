// 2D wave equation on a rectangular grid with reflecting (Dirichlet u=0) BCs.
// Solves  u_tt = c² ∇² u  via leapfrog finite differences.
//
//   u^{n+1}_{i,j} = 2 u^n_{i,j} - u^{n-1}_{i,j}
//                   + r² (u^n_{i+1,j} + u^n_{i-1,j} + u^n_{i,j+1} + u^n_{i,j-1} - 4 u^n_{i,j})
//
// where r = c·dt/dx and CFL stability for 2D requires r ≤ 1/√2.
//
// Two-source mode plays through 1) source A pulse at (xA, yA), 2) source B
// pulse at (xB, yB) — yields the classic interference pattern in the
// distributed-systems-and-fields course's homework example.

export interface Wave2DInput {
  readonly nx: number;
  readonly ny: number;
  readonly c: number;
  readonly dx: number;
  readonly dt: number;
  readonly steps: number;
  readonly source: (i: number, j: number, n: number) => number;
}

export interface Wave2DResult {
  readonly u: number[][];
  readonly maxAmplitude: number;
}

export function step(input: Wave2DInput): Wave2DResult {
  const { nx, ny, c, dx, dt, steps, source } = input;
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 3 || ny < 3) {
    throw new RangeError("nx, ny must be integers >= 3");
  }
  if (!Number.isFinite(c) || c <= 0) throw new RangeError("c must be > 0");
  if (!Number.isFinite(dx) || dx <= 0) throw new RangeError("dx must be > 0");
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError("dt must be > 0");
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError("steps must be a positive integer");
  }
  const r = (c * dt) / dx;
  if (r > 1 / Math.SQRT2 + 1e-12) {
    throw new RangeError(
      `CFL violated: r = c·dt/dx = ${r.toFixed(4)} must be <= 1/√2 ≈ 0.7071`,
    );
  }
  const r2 = r * r;

  let uPrev: number[][] = new Array(ny);
  let uCur: number[][] = new Array(ny);
  let uNext: number[][] = new Array(ny);
  for (let i = 0; i < ny; i += 1) {
    uPrev[i] = new Array<number>(nx).fill(0);
    uCur[i] = new Array<number>(nx).fill(0);
    uNext[i] = new Array<number>(nx).fill(0);
  }
  let maxAmp = 0;
  for (let n = 0; n < steps; n += 1) {
    for (let i = 1; i < ny - 1; i += 1) {
      for (let j = 1; j < nx - 1; j += 1) {
        const lap =
          uCur[i + 1]![j]! +
          uCur[i - 1]![j]! +
          uCur[i]![j + 1]! +
          uCur[i]![j - 1]! -
          4 * uCur[i]![j]!;
        const forced = source(i, j, n) * dt * dt;
        uNext[i]![j] = 2 * uCur[i]![j]! - uPrev[i]![j]! + r2 * lap + forced;
        const a = Math.abs(uNext[i]![j]!);
        if (a > maxAmp) maxAmp = a;
      }
    }
    // Dirichlet BCs: keep all boundaries 0 (already zero in uNext from creation).
    const tmp = uPrev;
    uPrev = uCur;
    uCur = uNext;
    uNext = tmp;
    // Clear the recycled buffer for the next step.
    for (let i = 0; i < ny; i += 1) {
      for (let j = 0; j < nx; j += 1) {
        uNext[i]![j] = 0;
      }
    }
  }
  return { u: uCur, maxAmplitude: maxAmp };
}

// Pulse helper: Gaussian forcing at (i0, j0) lasting from n=0 to n=duration.
export function gaussianPulse(
  i0: number,
  j0: number,
  amplitude: number,
  width: number,
  duration: number,
): (i: number, j: number, n: number) => number {
  if (width <= 0) throw new RangeError("width must be > 0");
  if (duration < 0 || !Number.isInteger(duration)) {
    throw new RangeError("duration must be a non-negative integer");
  }
  return (i, j, n) => {
    if (n > duration) return 0;
    const di = i - i0;
    const dj = j - j0;
    const r2 = di * di + dj * dj;
    return amplitude * Math.exp(-r2 / (2 * width * width));
  };
}
