// Closed-form Fourier transforms of common analog signals.
// Returns (Re, Im) of F(ω) = ∫ f(t) e^{-iωt} dt for sample points ω.
//
// Conventions match Oppenheim & Willsky:
//   - rect(t/T):           F(ω) = T · sinc(ω T / 2π) = T · sinc'(ωT/2) [sin(ωT/2)/(ωT/2)]
//   - triangle(t/T):       F(ω) = (T/2) · sinc²(ωT/4)
//   - cos(ω₀ t):           F(ω) = π[δ(ω-ω₀) + δ(ω+ω₀)]  (return analytical "magnitude" δ presence)
//   - exp(-a|t|), a>0:     F(ω) = 2a / (a² + ω²)
//   - exp(-at)·u(t), a>0:  F(ω) = 1 / (a + iω)
//   - Gaussian exp(-at²):  F(ω) = √(π/a) · exp(-ω²/(4a))

export interface Complex {
  readonly re: number;
  readonly im: number;
}

function sincRad(x: number): number {
  if (x === 0) return 1;
  return Math.sin(x) / x;
}

export function rectFT(T: number, omega: number): Complex {
  if (!Number.isFinite(T) || T <= 0) throw new RangeError("T must be > 0");
  if (!Number.isFinite(omega)) throw new RangeError("omega must be finite");
  // F(ω) = T · sinc(ωT/2) where sinc(x) = sin(x)/x (unnormalized).
  return { re: T * sincRad((omega * T) / 2), im: 0 };
}

export function triangleFT(T: number, omega: number): Complex {
  if (!Number.isFinite(T) || T <= 0) throw new RangeError("T must be > 0");
  if (!Number.isFinite(omega)) throw new RangeError("omega must be finite");
  const x = (omega * T) / 4;
  const s = sincRad(x);
  return { re: (T / 2) * s * s, im: 0 };
}

// Two-sided exponential e^{-a|t|}: real, even.
export function expTwoSidedFT(a: number, omega: number): Complex {
  if (!Number.isFinite(a) || a <= 0) throw new RangeError("a must be > 0");
  if (!Number.isFinite(omega)) throw new RangeError("omega must be finite");
  return { re: (2 * a) / (a * a + omega * omega), im: 0 };
}

// Causal exponential e^{-at} u(t): complex.
export function expCausalFT(a: number, omega: number): Complex {
  if (!Number.isFinite(a) || a <= 0) throw new RangeError("a must be > 0");
  if (!Number.isFinite(omega)) throw new RangeError("omega must be finite");
  // 1 / (a + iω) = (a - iω) / (a² + ω²)
  const denom = a * a + omega * omega;
  return { re: a / denom, im: -omega / denom };
}

// Gaussian e^{-a t²}.
export function gaussianFT(a: number, omega: number): Complex {
  if (!Number.isFinite(a) || a <= 0) throw new RangeError("a must be > 0");
  if (!Number.isFinite(omega)) throw new RangeError("omega must be finite");
  return { re: Math.sqrt(Math.PI / a) * Math.exp(-(omega * omega) / (4 * a)), im: 0 };
}

// Magnitude convenience.
export function magnitude(c: Complex): number {
  return Math.hypot(c.re, c.im);
}

export type SignalKind =
  | "rect"
  | "triangle"
  | "exp-two-sided"
  | "exp-causal"
  | "gaussian";

// Sample a signal's FT over an array of ω values.
export function sampleFT(
  kind: SignalKind,
  param: number,
  omegas: readonly number[],
): Complex[] {
  return omegas.map((w) => {
    if (kind === "rect") return rectFT(param, w);
    if (kind === "triangle") return triangleFT(param, w);
    if (kind === "exp-two-sided") return expTwoSidedFT(param, w);
    if (kind === "exp-causal") return expCausalFT(param, w);
    return gaussianFT(param, w);
  });
}
