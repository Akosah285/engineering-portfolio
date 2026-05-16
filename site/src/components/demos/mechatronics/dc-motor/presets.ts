/**
 * Named presets for the DC motor step-response visualiser.
 *
 * Each preset captures the share-relevant state so consumers can pick a
 * preset via <PresetCarousel> and the URL fragment stays in sync via
 * <useDemoState>.
 */

export const MOTOR_SLUGS = [
  "small-hobby",
  "fast-servo",
  "heavy-load",
  "high-gain",
  "slow-coil",
] as const;

export type MotorSlug = (typeof MOTOR_SLUGS)[number];

export interface DcMotorDemoState {
  motorSlug: MotorSlug;
  voltage: number;
  Km: number;
  tauM: number;
  tEnd: number;
}

export interface DcMotorPreset {
  name: string;
  state: DcMotorDemoState;
}

export const DEFAULT_STATE: DcMotorDemoState = {
  motorSlug: "small-hobby",
  voltage: 6,
  Km: 2.0,
  tauM: 0.3,
  tEnd: 2.5,
};

export const PRESETS: readonly DcMotorPreset[] = [
  {
    name: "Small hobby",
    state: { motorSlug: "small-hobby", voltage: 6, Km: 2.0, tauM: 0.3, tEnd: 2.5 },
  },
  {
    name: "Fast servo",
    state: { motorSlug: "fast-servo", voltage: 6, Km: 1.5, tauM: 0.08, tEnd: 1.0 },
  },
  {
    name: "Heavy load",
    state: { motorSlug: "heavy-load", voltage: 6, Km: 1.0, tauM: 1.2, tEnd: 6 },
  },
  {
    name: "High gain",
    state: { motorSlug: "high-gain", voltage: 6, Km: 4.5, tauM: 0.4, tEnd: 3 },
  },
  {
    name: "Slow coil",
    state: { motorSlug: "slow-coil", voltage: 6, Km: 0.8, tauM: 1.8, tEnd: 10 },
  },
] as const;
