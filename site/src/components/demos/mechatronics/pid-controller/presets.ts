/**
 * Named presets for the PID-controller visualiser.
 *
 * Each preset is a snapshot of the full share-relevant state so the
 * <PresetCarousel> can jump between behaviours (steady-state offset,
 * integral-driven oscillation, tuned response, aggressive overshoot).
 */

export interface PidDemoState {
  kp: number;
  ki: number;
  kd: number;
  setpoint: number;
  tau: number;
}

export interface PidPreset {
  name: string;
  state: PidDemoState;
}

export const DEFAULT_STATE: PidDemoState = {
  kp: 2,
  ki: 1,
  kd: 0.5,
  setpoint: 1,
  tau: 1,
};

export const PRESETS: readonly PidPreset[] = [
  {
    name: "P only (offset)",
    state: { kp: 2, ki: 0, kd: 0, setpoint: 1, tau: 1 },
  },
  {
    name: "PI (no offset, oscillates)",
    state: { kp: 1, ki: 2, kd: 0, setpoint: 1, tau: 1 },
  },
  {
    name: "Tuned PID",
    state: { kp: 2, ki: 1, kd: 0.5, setpoint: 1, tau: 1 },
  },
  {
    name: "Aggressive (overshoots)",
    state: { kp: 5, ki: 3, kd: 0, setpoint: 1, tau: 1 },
  },
] as const;
