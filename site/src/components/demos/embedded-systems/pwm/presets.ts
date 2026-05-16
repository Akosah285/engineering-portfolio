/**
 * Named presets for the PWM visualiser (#127).
 *
 * Each preset is a complete snapshot of share-relevant state, so consumers
 * can jump between common PWM use-cases via <PresetCarousel>.
 */

export const PRESET_SLUGS = [
  "motor",
  "heater",
  "servo",
  "high-freq",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface PwmDemoState {
  presetSlug: PresetSlug;
  frequency: number;
  duty: number;
  vHigh: number;
  vLow: number;
  nPeriods: number;
}

export interface PwmPreset {
  name: string;
  state: PwmDemoState;
}

export const DEFAULT_STATE: PwmDemoState = {
  presetSlug: "motor",
  frequency: 1000,
  duty: 0.5,
  vHigh: 5,
  vLow: 0,
  nPeriods: 5,
};

export const PRESETS: readonly PwmPreset[] = [
  {
    name: "Motor control (50% duty)",
    state: {
      presetSlug: "motor",
      frequency: 1000,
      duty: 0.5,
      vHigh: 5,
      vLow: 0,
      nPeriods: 5,
    },
  },
  {
    name: "Heater dimmer (20% duty)",
    state: {
      presetSlug: "heater",
      frequency: 120,
      duty: 0.2,
      vHigh: 12,
      vLow: 0,
      nPeriods: 5,
    },
  },
  {
    name: "Servo (10% duty)",
    state: {
      presetSlug: "servo",
      frequency: 50,
      duty: 0.1,
      vHigh: 5,
      vLow: 0,
      nPeriods: 5,
    },
  },
  {
    name: "High freq (95% duty)",
    state: {
      presetSlug: "high-freq",
      frequency: 10000,
      duty: 0.95,
      vHigh: 3.3,
      vLow: 0,
      nPeriods: 5,
    },
  },
] as const;

/** Plain-English use case associated with each preset, used in narration. */
export const USE_CASES: Record<PresetSlug, string> = {
  motor: "motor speed control",
  heater: "heater dimming",
  servo: "servo position control",
  "high-freq": "high-frequency switching regulation",
};
