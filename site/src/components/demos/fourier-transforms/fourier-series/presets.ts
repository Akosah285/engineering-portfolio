/**
 * Named presets for the Fourier-series visualiser (#59 v3).
 *
 * Each preset snapshots the share-relevant state: target waveform, max
 * harmonics to ramp up to, and the ms delay between each harmonic
 * increment during the animation.
 */

import type { WaveformKind } from "./algorithm";

export interface FourierSeriesDemoState {
  waveformKind: WaveformKind;
  maxHarmonics: number;
  stepDelay: number;
}

export interface FourierSeriesPreset {
  name: string;
  state: FourierSeriesDemoState;
}

export const WAVEFORM_KINDS = ["square", "sawtooth", "triangle"] as const;

export const DEFAULT_STATE: FourierSeriesDemoState = {
  waveformKind: "square",
  maxHarmonics: 50,
  stepDelay: 200,
};

export const PRESETS: readonly FourierSeriesPreset[] = [
  {
    name: "Square wave (Gibbs)",
    state: { waveformKind: "square", maxHarmonics: 50, stepDelay: 200 },
  },
  {
    name: "Sawtooth (slow)",
    state: { waveformKind: "sawtooth", maxHarmonics: 30, stepDelay: 300 },
  },
  {
    name: "Triangle (smooth)",
    state: { waveformKind: "triangle", maxHarmonics: 20, stepDelay: 200 },
  },
  {
    name: "Square wave (high N)",
    state: { waveformKind: "square", maxHarmonics: 200, stepDelay: 50 },
  },
] as const;
