// Faraday's law of induction.
//   ε = -dΦ/dt
//
// where Φ = B · A · cos(θ) for a flat loop of area A in a uniform field B,
// with θ between B and loop normal.
//
// For a rotating coil with N turns spinning at angular frequency ω:
//   Φ(t) = N · B · A · cos(ω t)
//   ε(t) = N · B · A · ω · sin(ω t)
//
// References: Griffiths, Introduction to Electrodynamics §7.2.

export function flux(B: number, A: number, theta: number, N = 1): number {
  if (
    !Number.isFinite(B) ||
    !Number.isFinite(A) ||
    !Number.isFinite(theta) ||
    !Number.isFinite(N)
  ) {
    throw new RangeError("inputs must be finite");
  }
  if (A < 0) throw new RangeError("A must be non-negative");
  if (!Number.isInteger(N) || N < 1) throw new RangeError("N must be a positive integer");
  return N * B * A * Math.cos(theta);
}

// Time-averaged EMF magnitude for a coil rotating at ω rad/s in field B:
//   |ε(t)| = N B A ω |sin(ω t)|, peak = N B A ω.
export function peakEmf(N: number, B: number, A: number, omega: number): number {
  if (
    !Number.isFinite(B) ||
    !Number.isFinite(A) ||
    !Number.isFinite(omega) ||
    !Number.isFinite(N)
  ) {
    throw new RangeError("inputs must be finite");
  }
  if (A < 0) throw new RangeError("A must be non-negative");
  if (!Number.isInteger(N) || N < 1) throw new RangeError("N must be a positive integer");
  return Math.abs(N * B * A * omega);
}

// Instantaneous EMF for rotating coil: ε(t) = N B A ω sin(ω t).
export function emfRotating(
  N: number,
  B: number,
  A: number,
  omega: number,
  t: number,
): number {
  if (!Number.isFinite(t)) throw new RangeError("t must be finite");
  // validate via peakEmf
  peakEmf(N, B, A, omega);
  return N * B * A * omega * Math.sin(omega * t);
}

// EMF induced by a time-varying field B(t) on a fixed loop of area A:
//   ε = -A · dB/dt
// Computed via finite difference of supplied samples (uniform dt).
export interface EmfFromBSeriesInput {
  readonly N?: number;
  readonly A: number;
  readonly dt: number;
  readonly Bsamples: readonly number[];
}

export function emfFromBSeries(input: EmfFromBSeriesInput): number[] {
  const { A, dt, Bsamples } = input;
  const N = input.N ?? 1;
  if (!Number.isFinite(A) || !Number.isFinite(dt)) {
    throw new RangeError("A, dt must be finite");
  }
  if (A < 0) throw new RangeError("A must be non-negative");
  if (dt <= 0) throw new RangeError("dt must be > 0");
  if (!Number.isInteger(N) || N < 1) throw new RangeError("N must be a positive integer");
  if (Bsamples.length < 2) throw new RangeError("need at least 2 B samples");
  const out = new Array<number>(Bsamples.length);
  // Central differences in the interior; forward/backward at endpoints.
  out[0] = (-N * A * (Bsamples[1]! - Bsamples[0]!)) / dt;
  out[Bsamples.length - 1] =
    (-N * A * (Bsamples[Bsamples.length - 1]! - Bsamples[Bsamples.length - 2]!)) / dt;
  for (let i = 1; i < Bsamples.length - 1; i += 1) {
    out[i] = (-N * A * (Bsamples[i + 1]! - Bsamples[i - 1]!)) / (2 * dt);
  }
  return out;
}
