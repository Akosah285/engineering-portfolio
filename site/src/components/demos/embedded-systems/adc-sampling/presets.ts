/**
 * Named presets for the ADC sampling + aliasing visualizer (#125).
 */

export const PRESET_SLUGS = [
  "no-alias-clean",
  "nyquist-edge",
  "aliased-fold",
  "low-bit-quantization",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface AdcSamplingDemoState {
  f: number;
  fs: number;
  bits: number;
  amp: number;
}

export interface AdcSamplingPreset {
  name: string;
  slug: PresetSlug;
  state: AdcSamplingDemoState;
}

export const DEFAULT_STATE: AdcSamplingDemoState = {
  f: 10,
  fs: 100,
  bits: 8,
  amp: 1.0,
};

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "no-alias-clean": { name: "No-alias (clean)" },
  "nyquist-edge": { name: "Nyquist edge" },
  "aliased-fold": { name: "Aliased fold" },
  "low-bit-quantization": { name: "Low-bit quantization" },
};

export const PRESETS: readonly AdcSamplingPreset[] = [
  {
    slug: "no-alias-clean",
    name: PRESET_META["no-alias-clean"].name,
    state: { f: 10, fs: 200, bits: 10, amp: 1.0 },
  },
  {
    slug: "nyquist-edge",
    name: PRESET_META["nyquist-edge"].name,
    state: { f: 49, fs: 100, bits: 10, amp: 1.0 },
  },
  {
    slug: "aliased-fold",
    name: PRESET_META["aliased-fold"].name,
    state: { f: 80, fs: 100, bits: 10, amp: 1.0 },
  },
  {
    slug: "low-bit-quantization",
    name: PRESET_META["low-bit-quantization"].name,
    state: { f: 5, fs: 200, bits: 2, amp: 1.0 },
  },
] as const;
