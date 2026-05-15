/**
 * pidController — pure step-by-step PID computation (v8 #106).
 *
 * Stateless from the caller's perspective: each `step` returns a NEW state
 * containing the integral accumulator + last-error so callers can store it
 * in React state.  Includes integral anti-windup via a saturation clamp on
 * the output. Derivative is on error (not on measurement) — the React
 * shell can swap to derivative-on-measurement later if needed.
 *
 * Output: u(t) = Kp*e + Ki*∫e dt + Kd*de/dt, clamped to [outputMin, outputMax].
 */

export interface PidGains {
  readonly kp: number;
  readonly ki: number;
  readonly kd: number;
}

export interface PidState {
  readonly integral: number;
  readonly lastError: number;
}

export interface PidStepInput {
  readonly setpoint: number;
  readonly measurement: number;
  /** Time step in seconds. Must be > 0. */
  readonly dt: number;
  readonly gains: PidGains;
  readonly state: PidState;
  readonly outputMin?: number;
  readonly outputMax?: number;
}

export interface PidStepResult {
  readonly output: number;
  readonly nextState: PidState;
  readonly proportional: number;
  readonly integralTerm: number;
  readonly derivative: number;
}

export function createPidState(): PidState {
  return { integral: 0, lastError: 0 };
}

export function pidStep(input: PidStepInput): PidStepResult {
  if (input.dt <= 0 || !Number.isFinite(input.dt)) {
    throw new RangeError("pidStep: dt must be > 0 and finite.");
  }
  const { setpoint, measurement, dt, gains, state } = input;
  const outMin = input.outputMin ?? Number.NEGATIVE_INFINITY;
  const outMax = input.outputMax ?? Number.POSITIVE_INFINITY;
  if (outMin > outMax) {
    throw new RangeError("pidStep: outputMin must be <= outputMax.");
  }

  const error = setpoint - measurement;
  const proportional = gains.kp * error;
  const integralRaw = state.integral + error * dt;
  const integralTerm = gains.ki * integralRaw;
  const derivative = gains.kd * ((error - state.lastError) / dt);

  const unclamped = proportional + integralTerm + derivative;
  const output = Math.max(outMin, Math.min(outMax, unclamped));

  // Anti-windup: only update integral if we didn't saturate, OR if the
  // unsaturated update would un-saturate. Otherwise hold the previous
  // integral so wind-up doesn't accumulate.
  const saturated = output !== unclamped;
  const nextIntegral = saturated ? state.integral : integralRaw;

  return {
    output,
    nextState: { integral: nextIntegral, lastError: error },
    proportional,
    integralTerm,
    derivative,
  };
}
