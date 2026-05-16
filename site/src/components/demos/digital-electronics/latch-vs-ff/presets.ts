import type { Sample } from "./algorithm";

export const PATTERN_SLUGS = [
  "slow-clock",
  "d-changes-mid-enable",
  "clean-edges",
  "glitchy-d",
] as const;

export type PatternSlug = (typeof PATTERN_SLUGS)[number];

export const PATTERN_NAMES: Record<PatternSlug, string> = {
  "slow-clock": "Slow clock",
  "d-changes-mid-enable": "D changes mid enable",
  "clean-edges": "Clean edges",
  "glitchy-d": "Glitchy D",
};

export interface LatchVsFfState {
  cursor: number;
  pattern: PatternSlug;
}

export const DEFAULT_STATE: LatchVsFfState = {
  cursor: 0,
  pattern: "slow-clock",
};

type Bit = 0 | 1;

function build(d: readonly Bit[], ctrl: readonly Bit[]): Sample[] {
  const n = Math.min(d.length, ctrl.length);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = { t: i, d: d[i] ?? 0, ctrl: ctrl[i] ?? 0 };
  }
  return out;
}

// 24 samples: D toggles every 4, ctrl every 8.
function slowClock(): Sample[] {
  const n = 24;
  const d: Bit[] = [];
  const ctrl: Bit[] = [];
  for (let i = 0; i < n; i += 1) {
    d.push((Math.floor(i / 4) % 2) as Bit);
    ctrl.push((Math.floor(i / 8) % 2) as Bit);
  }
  return build(d, ctrl);
}

// 24 samples: enable goes high while D is low, then D toggles high while
// enable is still high (latch becomes transparent and follows; FF holds
// the value it sampled on the rising edge) — guaranteed divergence.
function dChangesMidEnable(): Sample[] {
  const n = 24;
  const d: Bit[] = [];
  const ctrl: Bit[] = [];
  for (let i = 0; i < n; i += 1) {
    d.push((i >= 8 && i <= 15 ? 1 : 0) as Bit);
    ctrl.push((i >= 4 && i <= 15 ? 1 : 0) as Bit);
  }
  return build(d, ctrl);
}

// 24 samples: D only changes while clk is low; clk rises after D has
// settled. Latch and FF agree on every sample.
function cleanEdges(): Sample[] {
  const n = 24;
  const d: Bit[] = [];
  const ctrl: Bit[] = [];
  for (let i = 0; i < n; i += 1) {
    d.push((Math.floor(i / 8) % 2) as Bit);
    ctrl.push((Math.floor(i / 4) % 2) as Bit);
  }
  return build(d, ctrl);
}

// 24 samples: D pulses high for one sample at a time while clk is low.
// FF ignores (no rising edge while pulse is high); latch holds (enable
// is low during each pulse).
function glitchyD(): Sample[] {
  const n = 24;
  const pulseAt = new Set([2, 5, 10, 13, 18, 21]);
  const clkHigh = new Set([7, 8, 15, 16, 23]);
  const d: Bit[] = [];
  const ctrl: Bit[] = [];
  for (let i = 0; i < n; i += 1) {
    d.push((pulseAt.has(i) ? 1 : 0) as Bit);
    ctrl.push((clkHigh.has(i) ? 1 : 0) as Bit);
  }
  return build(d, ctrl);
}

export function generateSamples(pattern: PatternSlug): Sample[] {
  switch (pattern) {
    case "slow-clock":
      return slowClock();
    case "d-changes-mid-enable":
      return dChangesMidEnable();
    case "clean-edges":
      return cleanEdges();
    case "glitchy-d":
      return glitchyD();
  }
}

export interface LatchVsFfPreset {
  name: string;
  state: LatchVsFfState;
}

export const PRESETS: readonly LatchVsFfPreset[] = PATTERN_SLUGS.map((slug) => ({
  name: PATTERN_NAMES[slug],
  state: { cursor: 0, pattern: slug },
}));
