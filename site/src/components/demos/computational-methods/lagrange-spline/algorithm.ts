// Polynomial interpolation: Lagrange form vs natural cubic spline.
// Compares smoothness/oscillation behavior on the same node set.
//
// Lagrange: single global polynomial of degree n-1 through n points.
//   L_i(x) = ∏_{j≠i} (x - x_j) / (x_i - x_j)
//   p(x)   = Σ_i y_i L_i(x)
//
// Natural cubic spline: piecewise cubic with C² continuity and
// second-derivative = 0 at both endpoints (Burden & Faires §3.5).

export interface Point {
  readonly x: number;
  readonly y: number;
}

function validateNodes(nodes: readonly Point[]): void {
  if (nodes.length < 2) {
    throw new RangeError("need at least 2 nodes");
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const p = nodes[i]!;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new RangeError("nodes must be finite");
    }
  }
  for (let i = 1; i < nodes.length; i += 1) {
    if (nodes[i]!.x <= nodes[i - 1]!.x) {
      throw new RangeError("nodes must be strictly x-ascending");
    }
  }
}

export function lagrange(nodes: readonly Point[], x: number): number {
  validateNodes(nodes);
  if (!Number.isFinite(x)) throw new RangeError("x must be finite");
  const n = nodes.length;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    let term = nodes[i]!.y;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      term *= (x - nodes[j]!.x) / (nodes[i]!.x - nodes[j]!.x);
    }
    total += term;
  }
  return total;
}

export interface SplineCoeffs {
  readonly nodes: readonly Point[];
  readonly a: readonly number[];
  readonly b: readonly number[];
  readonly c: readonly number[];
  readonly d: readonly number[];
}

// Build natural cubic spline coefficients.
// On segment i (x in [x_i, x_{i+1}]):
//   S_i(x) = a_i + b_i (x - x_i) + c_i (x - x_i)² + d_i (x - x_i)³
export function buildNaturalSpline(nodes: readonly Point[]): SplineCoeffs {
  validateNodes(nodes);
  const n = nodes.length - 1; // number of segments
  const h = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    h[i] = nodes[i + 1]!.x - nodes[i]!.x;
  }
  const a = nodes.map((p) => p.y);
  const alpha = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i += 1) {
    alpha[i] =
      (3 / h[i]!) * (a[i + 1]! - a[i]!) -
      (3 / h[i - 1]!) * (a[i]! - a[i - 1]!);
  }
  const l = new Array<number>(n + 1).fill(0);
  const mu = new Array<number>(n + 1).fill(0);
  const z = new Array<number>(n + 1).fill(0);
  l[0] = 1;
  for (let i = 1; i < n; i += 1) {
    l[i] = 2 * (nodes[i + 1]!.x - nodes[i - 1]!.x) - h[i - 1]! * mu[i - 1]!;
    mu[i] = h[i]! / l[i]!;
    z[i] = (alpha[i]! - h[i - 1]! * z[i - 1]!) / l[i]!;
  }
  l[n] = 1;
  const c = new Array<number>(n + 1).fill(0);
  const b = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  for (let j = n - 1; j >= 0; j -= 1) {
    c[j] = z[j]! - mu[j]! * c[j + 1]!;
    b[j] = (a[j + 1]! - a[j]!) / h[j]! - (h[j]! * (c[j + 1]! + 2 * c[j]!)) / 3;
    d[j] = (c[j + 1]! - c[j]!) / (3 * h[j]!);
  }
  return { nodes, a: a.slice(0, n), b, c: c.slice(0, n), d };
}

export function evalSpline(s: SplineCoeffs, x: number): number {
  if (!Number.isFinite(x)) throw new RangeError("x must be finite");
  const n = s.nodes.length - 1;
  const xs = s.nodes;
  if (x <= xs[0]!.x) {
    const dx = x - xs[0]!.x;
    return s.a[0]! + s.b[0]! * dx + s.c[0]! * dx * dx + s.d[0]! * dx * dx * dx;
  }
  if (x >= xs[n]!.x) {
    const i = n - 1;
    const dx = x - xs[i]!.x;
    return s.a[i]! + s.b[i]! * dx + s.c[i]! * dx * dx + s.d[i]! * dx * dx * dx;
  }
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (xs[mid]!.x <= x) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const dx = x - xs[i]!.x;
  return s.a[i]! + s.b[i]! * dx + s.c[i]! * dx * dx + s.d[i]! * dx * dx * dx;
}
