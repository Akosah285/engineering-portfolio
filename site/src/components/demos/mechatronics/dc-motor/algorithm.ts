/**
 * dcMotor — first-order DC motor model with closed-form step response (#107).
 *
 * Standard small-motor armature-only model (mechanical time constant
 * dominates electrical):
 *
 *     τ_m · dω/dt + ω = K_m · V
 *
 * where τ_m is the mechanical time constant [s] and K_m is the steady-state
 * gain [(rad/s)/V]. The step response from rest (ω(0) = ω₀) to constant V is
 *
 *     ω(t) = ω_ss + (ω₀ − ω_ss) · exp(−t / τ_m),    ω_ss = K_m · V
 *
 * Position θ(t) = ∫ω(t)dt is also closed-form:
 *
 *     θ(t) = θ₀ + ω_ss·t − (ω_ss − ω₀)·τ_m·(1 − exp(−t/τ_m))
 *
 * The React shell will plot both ω(t) and θ(t) along with the rise-time
 * landmark (≈ 2.2·τ_m to reach 90% of ω_ss).
 */

export interface DcMotorParams {
  /** Steady-state gain K_m [(rad/s) / V]. Must be > 0. */
  readonly Km: number;
  /** Mechanical time constant τ_m [s]. Must be > 0. */
  readonly tauM: number;
}

export interface DcMotorStepInput {
  readonly motor: DcMotorParams;
  /** Step voltage [V]. Sign preserved (negative drives reverse). */
  readonly voltage: number;
  /** Initial angular velocity [rad/s]. Default 0. */
  readonly omega0?: number;
  /** Initial position [rad]. Default 0. */
  readonly theta0?: number;
}

export interface DcMotorState {
  readonly t: number;
  readonly omega: number;
  readonly theta: number;
}

function checkParams(motor: DcMotorParams): void {
  if (!Number.isFinite(motor.Km) || motor.Km <= 0) {
    throw new RangeError("dcMotor: Km must be > 0 and finite.");
  }
  if (!Number.isFinite(motor.tauM) || motor.tauM <= 0) {
    throw new RangeError("dcMotor: tauM must be > 0 and finite.");
  }
}

export function steadyStateOmega(motor: DcMotorParams, voltage: number): number {
  checkParams(motor);
  if (!Number.isFinite(voltage)) {
    throw new RangeError("dcMotor: voltage must be finite.");
  }
  return motor.Km * voltage;
}

export function omegaAt(input: DcMotorStepInput, t: number): number {
  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError("dcMotor: t must be >= 0 and finite.");
  }
  const omega0 = input.omega0 ?? 0;
  const omega_ss = steadyStateOmega(input.motor, input.voltage);
  return omega_ss + (omega0 - omega_ss) * Math.exp(-t / input.motor.tauM);
}

export function thetaAt(input: DcMotorStepInput, t: number): number {
  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError("dcMotor: t must be >= 0 and finite.");
  }
  const omega0 = input.omega0 ?? 0;
  const theta0 = input.theta0 ?? 0;
  const tau = input.motor.tauM;
  const omega_ss = steadyStateOmega(input.motor, input.voltage);
  return (
    theta0 +
    omega_ss * t -
    (omega_ss - omega0) * tau * (1 - Math.exp(-t / tau))
  );
}

/**
 * Settling time to within ε of steady state. Solves
 *     |ω(t_s) − ω_ss| / |ω₀ − ω_ss| = ε
 *   ⇒ t_s = −τ · ln(ε)
 *
 * Returns 0 when starting from steady state.  ε defaults to 0.02 (2%).
 */
export function settlingTime(motor: DcMotorParams, epsilon = 0.02): number {
  checkParams(motor);
  if (!(epsilon > 0) || epsilon >= 1) {
    throw new RangeError("dcMotor: epsilon must be in (0, 1).");
  }
  return -motor.tauM * Math.log(epsilon);
}

export function trajectory(input: DcMotorStepInput, tEnd: number, samples: number): DcMotorState[] {
  if (!Number.isFinite(tEnd) || tEnd < 0) {
    throw new RangeError("dcMotor: tEnd must be >= 0 and finite.");
  }
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError("dcMotor: samples must be an integer >= 2.");
  }
  const out: DcMotorState[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = (i / (samples - 1)) * tEnd;
    out[i] = { t, omega: omegaAt(input, t), theta: thetaAt(input, t) };
  }
  return out;
}
