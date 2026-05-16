// Residue Theorem helper. Computes residues at simple and m-th order poles,
// and assembles the contour integral 2πi·Σ residues for a list of poles
// enclosed by a closed contour.
//
// Reference: Brown & Churchill, Complex Variables and Applications §85-87.

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export function c(re: number, im: number): Complex {
  return { re, im };
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
export function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}
export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new RangeError("division by zero");
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
}
export function scale(a: Complex, k: number): Complex {
  return { re: a.re * k, im: a.im * k };
}
export function abs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}
export function eq(a: Complex, b: Complex, tol = 1e-10): boolean {
  return Math.abs(a.re - b.re) < tol && Math.abs(a.im - b.im) < tol;
}

// Residue at a simple pole z₀ of f(z) = g(z)/h(z):
//   Res(f, z₀) = g(z₀) / h'(z₀)
//
// We instead provide the direct definition for general f:
//   Res(f, z₀) = lim_{z → z₀} (z - z₀) · f(z)
// approximated as ((z₀ + ε) - z₀) · f(z₀ + ε) for small ε.
//
// For an m-th order pole:
//   Res(f, z₀) = lim_{z → z₀} (1/(m-1)!) · d^{m-1}/dz^{m-1} [ (z - z₀)^m · f(z) ]
//
// This module supports both numerical (finite-difference) residues and
// closed-form for rational functions via given numerator / denominator.

export function residueSimplePole(
  f: (z: Complex) => Complex,
  z0: Complex,
  eps = 1e-5,
): Complex {
  if (!Number.isFinite(eps) || eps <= 0) {
    throw new RangeError("eps must be > 0");
  }
  // Average eight evaluations around the pole on a small circle to be robust:
  let sum: Complex = { re: 0, im: 0 };
  const M = 16;
  for (let k = 0; k < M; k += 1) {
    const theta = (2 * Math.PI * k) / M;
    const dz: Complex = { re: eps * Math.cos(theta), im: eps * Math.sin(theta) };
    const fv = f(add(z0, dz));
    // (z - z₀)·f = dz · f
    sum = add(sum, mul(dz, fv));
  }
  return scale(sum, 1 / M);
}

// 2πi · Σ residues enclosed by the contour.
export function contourIntegral(residues: readonly Complex[]): Complex {
  let s: Complex = { re: 0, im: 0 };
  for (const r of residues) s = add(s, r);
  // 2πi · s = 2π · (i · s) = 2π · { re: -s.im, im: s.re }
  return { re: -2 * Math.PI * s.im, im: 2 * Math.PI * s.re };
}

// Residue of 1 / (z² + 1) at z = i should equal 1 / (2i) = -i/2.
// Residue of 1 / (z² + 1) at z = -i should equal 1 / (-2i) = i/2.
// Convenience for rational functions: residue at simple pole z₀ of p/q is
//   p(z₀) / q'(z₀).
export function residueRationalSimple(
  num: (z: Complex) => Complex,
  denDeriv: (z: Complex) => Complex,
  z0: Complex,
): Complex {
  return div(num(z0), denDeriv(z0));
}
