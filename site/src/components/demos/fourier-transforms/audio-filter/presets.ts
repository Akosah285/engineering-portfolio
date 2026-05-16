/**
 * Named presets for the biquad audio-filter visualiser.
 */

import type { BiquadType } from "./algorithm";

export interface AudioFilterDemoState {
  filterType: BiquadType;
  cutoffHz: number;
  Q: number;
}

export const SAMPLE_RATE = 44100;

export const FILTER_TYPES = [
  "lowpass",
  "highpass",
  "bandpass",
  "notch",
] as const satisfies readonly BiquadType[];

export const DEFAULT_STATE: AudioFilterDemoState = {
  filterType: "lowpass",
  cutoffHz: 1000,
  Q: 0.707,
};

export interface AudioFilterPreset {
  name: string;
  state: AudioFilterDemoState;
}

export const PRESETS: readonly AudioFilterPreset[] = [
  {
    name: "Lowpass at 1 kHz",
    state: { filterType: "lowpass", cutoffHz: 1000, Q: 0.707 },
  },
  {
    name: "Highpass at 200 Hz",
    state: { filterType: "highpass", cutoffHz: 200, Q: 0.707 },
  },
  {
    name: "Bandpass at 2 kHz",
    state: { filterType: "bandpass", cutoffHz: 2000, Q: 4 },
  },
  {
    name: "Notch at 60 Hz (mains)",
    state: { filterType: "notch", cutoffHz: 60, Q: 10 },
  },
] as const;

export const TYPE_LABELS: Record<BiquadType, string> = {
  lowpass: "Lowpass",
  highpass: "Highpass",
  bandpass: "Bandpass",
  notch: "Notch",
};

export const TYPE_COLORS: Record<BiquadType, string> = {
  lowpass: "#00693e",
  highpass: "#0b6bcb",
  bandpass: "#b8860b",
  notch: "#cf4f4f",
};

export const TYPE_DESCRIPTIONS: Record<BiquadType, string> = {
  lowpass: "passes frequencies below",
  highpass: "passes frequencies above",
  bandpass: "passes a band of frequencies around",
  notch: "rejects frequencies around",
};
