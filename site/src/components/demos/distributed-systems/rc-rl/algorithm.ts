// RC and RL first-order step responses + a few related quantities used
// by the v7 Distributed Systems RC/RL demo.  Pure analytical formulas;
// no integrator needed.

export interface FirstOrderInput {
  readonly Vstep: number;
  readonly tau: number;
  readonly t: number;
}

/**
 * Capacitor voltage in an RC charging circuit driven by a step Vstep:
 *   v_C(t) = Vstep (1 - e^{-t/τ}) for t >= 0; 0 for t < 0.
 */
export function rcChargingVoltage(input: FirstOrderInput): number {
  if (!(input.tau > 0 && Number.isFinite(input.tau))) {
    throw new RangeError("rcChargingVoltage: tau must be > 0.");
  }
  if (!Number.isFinite(input.t)) throw new RangeError("rcChargingVoltage: t must be finite.");
  if (input.t < 0) return 0;
  return input.Vstep * (1 - Math.exp(-input.t / input.tau));
}

/**
 * Capacitor voltage in an RC discharging circuit starting at V0:
 *   v_C(t) = V0 e^{-t/τ}.
 */
export function rcDischargingVoltage(V0: number, tau: number, t: number): number {
  if (!(tau > 0 && Number.isFinite(tau))) {
    throw new RangeError("rcDischargingVoltage: tau must be > 0.");
  }
  if (!Number.isFinite(t)) throw new RangeError("rcDischargingVoltage: t must be finite.");
  if (t < 0) return V0;
  return V0 * Math.exp(-t / tau);
}

/**
 * Inductor current in an RL circuit driven by a step Vstep through R:
 *   i_L(t) = (Vstep / R) (1 - e^{-t/τ}), τ = L/R.
 */
export function rlCurrent(Vstep: number, R: number, L: number, t: number): number {
  if (!(R > 0)) throw new RangeError("rlCurrent: R must be > 0.");
  if (!(L > 0)) throw new RangeError("rlCurrent: L must be > 0.");
  if (!Number.isFinite(t)) throw new RangeError("rlCurrent: t must be finite.");
  const tau = L / R;
  if (t < 0) return 0;
  return (Vstep / R) * (1 - Math.exp(-t / tau));
}

/** Time-constant τ for an RC circuit. */
export function rcTimeConstant(R: number, C: number): number {
  if (!(R > 0)) throw new RangeError("rcTimeConstant: R must be > 0.");
  if (!(C > 0)) throw new RangeError("rcTimeConstant: C must be > 0.");
  return R * C;
}

/** Time-constant τ for an RL circuit. */
export function rlTimeConstant(R: number, L: number): number {
  if (!(R > 0)) throw new RangeError("rlTimeConstant: R must be > 0.");
  if (!(L > 0)) throw new RangeError("rlTimeConstant: L must be > 0.");
  return L / R;
}

/**
 * Time required for the response to reach a given fraction f in (0, 1)
 * of the asymptotic value (1 - e^{-t/τ} = f  ⇒  t = -τ ln(1 - f)).
 */
export function timeToFraction(tau: number, f: number): number {
  if (!(tau > 0)) throw new RangeError("timeToFraction: tau must be > 0.");
  if (!(f > 0 && f < 1)) throw new RangeError("timeToFraction: f must be in (0, 1).");
  return -tau * Math.log(1 - f);
}
