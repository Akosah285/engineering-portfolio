// Laplace's equation on a rectangle: ∇²u = 0 inside, Dirichlet on the boundary.
// Solved by Gauss-Seidel iteration with successive over-relaxation (SOR).
//
// Reference: Strang, Computational Science & Engineering §3.4.

export interface LaplaceInput {
  readonly nx: number;
  readonly ny: number;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly omega?: number; // SOR factor; 1 = pure Gauss-Seidel; 1.5 typical.
  readonly maxIter?: number;
  readonly tol?: number;
}

export interface LaplaceResult {
  readonly u: number[][]; // u[i][j], i = row (y), j = col (x)
  readonly iterations: number;
  readonly converged: boolean;
  readonly finalResidual: number;
}

export function solve(input: LaplaceInput): LaplaceResult {
  const { nx, ny, top, bottom, left, right } = input;
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 3 || ny < 3) {
    throw new RangeError("nx and ny must be integers >= 3");
  }
  for (const v of [top, bottom, left, right]) {
    if (!Number.isFinite(v)) throw new RangeError("boundary values must be finite");
  }
  const omega = input.omega ?? 1.5;
  if (omega <= 0 || omega >= 2) {
    throw new RangeError("omega must be in (0, 2)");
  }
  const maxIter = input.maxIter ?? 5000;
  const tol = input.tol ?? 1e-6;

  const u: number[][] = new Array(ny);
  for (let i = 0; i < ny; i += 1) {
    u[i] = new Array<number>(nx).fill(0);
  }
  for (let j = 0; j < nx; j += 1) {
    u[0]![j] = top;
    u[ny - 1]![j] = bottom;
  }
  for (let i = 0; i < ny; i += 1) {
    u[i]![0] = left;
    u[i]![nx - 1] = right;
  }
  // Reasonable initialization to speed convergence: average of boundary.
  const avg = (top + bottom + left + right) / 4;
  for (let i = 1; i < ny - 1; i += 1) {
    for (let j = 1; j < nx - 1; j += 1) {
      u[i]![j] = avg;
    }
  }

  let iter = 0;
  let residual = Infinity;
  for (iter = 0; iter < maxIter; iter += 1) {
    let maxDelta = 0;
    for (let i = 1; i < ny - 1; i += 1) {
      for (let j = 1; j < nx - 1; j += 1) {
        const gs =
          (u[i - 1]![j]! + u[i + 1]![j]! + u[i]![j - 1]! + u[i]![j + 1]!) / 4;
        const old = u[i]![j]!;
        const next = old + omega * (gs - old);
        u[i]![j] = next;
        const delta = Math.abs(next - old);
        if (delta > maxDelta) maxDelta = delta;
      }
    }
    residual = maxDelta;
    if (residual < tol) {
      return { u, iterations: iter + 1, converged: true, finalResidual: residual };
    }
  }
  return { u, iterations: iter, converged: false, finalResidual: residual };
}
