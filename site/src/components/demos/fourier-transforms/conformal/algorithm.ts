// Conformal mapping — apply analytic functions to point sets.
// Reference: Ablowitz & Fokas, "Complex Variables", §5 (Conformal Maps)
// and Anderson, "Fundamentals of Aerodynamics", §3 (Joukowski transform).
//
// A map f: C -> C is conformal at z0 if f is analytic and f'(z0) ≠ 0.
// At such points, infinitesimal angles between curves are preserved.

export interface Complex {
  re: number;
  im: number;
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new RangeError("cDiv: division by zero");
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
}

export function cExp(z: Complex): Complex {
  const e = Math.exp(z.re);
  return { re: e * Math.cos(z.im), im: e * Math.sin(z.im) };
}

export function cLog(z: Complex): Complex {
  const r = Math.hypot(z.re, z.im);
  if (r === 0) throw new RangeError("cLog: log(0) is undefined");
  return { re: Math.log(r), im: Math.atan2(z.im, z.re) };
}

export function cSquare(z: Complex): Complex {
  return cMul(z, z);
}

// Möbius transformation w = (az + b) / (cz + d), with ad - bc ≠ 0.
export interface MobiusCoeffs {
  a: Complex;
  b: Complex;
  c: Complex;
  d: Complex;
}

export function mobius(coeffs: MobiusCoeffs, z: Complex): Complex {
  const ad = cMul(coeffs.a, coeffs.d);
  const bc = cMul(coeffs.b, coeffs.c);
  const det = cSub(ad, bc);
  if (det.re * det.re + det.im * det.im < 1e-24) {
    throw new RangeError("mobius: degenerate transformation (ad - bc ≈ 0)");
  }
  const num = cAdd(cMul(coeffs.a, z), coeffs.b);
  const den = cAdd(cMul(coeffs.c, z), coeffs.d);
  return cDiv(num, den);
}

// Joukowski transform: w = z + b^2 / z (b > 0).
// Famous for mapping a unit circle to an airfoil shape when slightly shifted.
export function joukowski(z: Complex, b: number): Complex {
  if (b <= 0) throw new RangeError("joukowski: b must be > 0");
  const b2: Complex = { re: b * b, im: 0 };
  return cAdd(z, cDiv(b2, z));
}

// Apply a conformal map to many points.
export function applyMap(
  points: readonly Complex[],
  f: (z: Complex) => Complex,
): Complex[] {
  return points.map((p) => f(p));
}

// Sample a closed unit circle at N angles for use as a probe shape.
export function sampleUnitCircle(N: number, center?: Complex, radius = 1): Complex[] {
  if (!Number.isInteger(N) || N <= 0) {
    throw new RangeError("sampleUnitCircle: N must be a positive integer");
  }
  if (radius <= 0) {
    throw new RangeError("sampleUnitCircle: radius must be > 0");
  }
  const c = center ?? { re: 0, im: 0 };
  const out: Complex[] = new Array(N);
  for (let k = 0; k < N; k++) {
    const theta = (2 * Math.PI * k) / N;
    out[k] = {
      re: c.re + radius * Math.cos(theta),
      im: c.im + radius * Math.sin(theta),
    };
  }
  return out;
}
