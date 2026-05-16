import type { AccelSample } from "./algorithm";

export const PATTERN_SLUGS = [
  "flat-still",
  "slow-tilt",
  "two-shakes",
  "upside-down",
] as const;

export type PatternSlug = (typeof PATTERN_SLUGS)[number];

export interface AccelDemoState {
  cursor: number;
  thresholdG: number;
  pattern: PatternSlug;
}

const G = 9.81;
const N = 30;

function buildFlatStill(): AccelSample[] {
  return Array.from({ length: N }, () => ({ ax: 0, ay: 0, az: G }));
}

function buildSlowTilt(): AccelSample[] {
  const out: AccelSample[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const theta = (t * Math.PI) / 2;
    out.push({ ax: 0, ay: Math.sin(theta) * G, az: Math.cos(theta) * G });
  }
  return out;
}

function buildTwoShakes(): AccelSample[] {
  const out: AccelSample[] = Array.from({ length: N }, () => ({
    ax: 0,
    ay: 0,
    az: G,
  }));
  for (let k = 0; k < 3; k++) {
    out[10 + k] = { ax: 18, ay: 18, az: 12 };
    out[22 + k] = { ax: -20, ay: 16, az: 14 };
  }
  return out;
}

function buildUpsideDown(): AccelSample[] {
  return Array.from({ length: N }, () => ({ ax: 0, ay: 0, az: -G }));
}

export const PATTERNS: Record<PatternSlug, AccelSample[]> = {
  "flat-still": buildFlatStill(),
  "slow-tilt": buildSlowTilt(),
  "two-shakes": buildTwoShakes(),
  "upside-down": buildUpsideDown(),
};

export const PATTERN_NAMES: Record<PatternSlug, string> = {
  "flat-still": "Flat still",
  "slow-tilt": "Slow tilt",
  "two-shakes": "Two shakes",
  "upside-down": "Upside down",
};

export const DEFAULT_STATE: AccelDemoState = {
  cursor: 0,
  thresholdG: 1.5,
  pattern: "flat-still",
};

export interface AccelPreset {
  name: string;
  state: AccelDemoState;
}

export const PRESETS: AccelPreset[] = PATTERN_SLUGS.map((slug) => ({
  name: PATTERN_NAMES[slug],
  state: { cursor: 0, thresholdG: 1.5, pattern: slug },
}));
