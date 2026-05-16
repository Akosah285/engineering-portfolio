/**
 * Named presets for the RPM visualiser. Each preset is a snapshot of all
 * share-relevant state — consumers can jump to any preset via
 * <PresetCarousel> and the URL fragment stays in sync via useDemoState.
 */

export interface RpmDemoState {
  /** True (ground-truth) motor speed in RPM. */
  trueRpm: number;
  /** Pulses per revolution emitted by the encoder. */
  ppr: number;
  /** Window length (s) used by the frequency method. */
  windowSec: number;
  /** Sample count for the moving-average filter. */
  N: number;
  /** Per-pulse Gaussian jitter, in percent of the nominal period. */
  noisePct: number;
}

export interface RpmPreset {
  slug: (typeof PRESET_SLUGS)[number];
  name: string;
  state: RpmDemoState;
}

export const DEFAULT_STATE: RpmDemoState = {
  trueRpm: 1800,
  ppr: 4,
  windowSec: 0.2,
  N: 5,
  noisePct: 5,
};

export const PRESET_SLUGS = [
  "low-rpm-clean",
  "high-rpm-noisy",
  "high-resolution-encoder",
  "windowed-vs-instant",
] as const;

export const PRESET_META: Record<
  (typeof PRESET_SLUGS)[number],
  { name: string; blurb: string }
> = {
  "low-rpm-clean": {
    name: "Low RPM clean",
    blurb: "Slow shaft, low jitter — period method shines.",
  },
  "high-rpm-noisy": {
    name: "High RPM noisy",
    blurb: "Fast shaft + jitter — frequency method averages noise.",
  },
  "high-resolution-encoder": {
    name: "High-resolution encoder",
    blurb: "Many pulses per rev — both methods agree.",
  },
  "windowed-vs-instant": {
    name: "Windowed vs instant",
    blurb: "Compare period vs frequency methods side-by-side.",
  },
};

export const PRESETS: readonly RpmPreset[] = [
  {
    slug: "low-rpm-clean",
    name: PRESET_META["low-rpm-clean"].name,
    state: { trueRpm: 240, ppr: 4, windowSec: 0.2, N: 3, noisePct: 1 },
  },
  {
    slug: "high-rpm-noisy",
    name: PRESET_META["high-rpm-noisy"].name,
    state: { trueRpm: 4800, ppr: 2, windowSec: 0.1, N: 8, noisePct: 15 },
  },
  {
    slug: "high-resolution-encoder",
    name: PRESET_META["high-resolution-encoder"].name,
    state: { trueRpm: 1800, ppr: 32, windowSec: 0.1, N: 5, noisePct: 2 },
  },
  {
    slug: "windowed-vs-instant",
    name: PRESET_META["windowed-vs-instant"].name,
    state: { trueRpm: 600, ppr: 1, windowSec: 0.5, N: 5, noisePct: 10 },
  },
] as const;
