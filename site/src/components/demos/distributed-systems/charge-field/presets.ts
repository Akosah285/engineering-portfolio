/**
 * Named presets for the charge-field visualiser.
 *
 * Charge configurations live in PRESET_META (not in the URL-shareable demo
 * state) because PointCharge[] is not a primitive useDemoState field type.
 */

import type { PointCharge } from "./algorithm";

export type ChargeFieldPresetSlug =
  | "single-positive"
  | "dipole"
  | "quadrupole"
  | "two-positives";

export const PRESET_SLUGS = [
  "single-positive",
  "dipole",
  "quadrupole",
  "two-positives",
] as const;

export interface ChargeFieldDemoState {
  preset: ChargeFieldPresetSlug;
  nx: number;
  ny: number;
  arrowScale: number;
  showPotential: number;
}

export const DEFAULT_STATE: ChargeFieldDemoState = {
  preset: "dipole",
  nx: 20,
  ny: 20,
  arrowScale: 1.0,
  showPotential: 0,
};

export interface ChargeFieldPresetMeta {
  label: string;
  narration: string;
  state: ChargeFieldDemoState;
  charges: PointCharge[];
}

export const PRESET_META: Record<ChargeFieldPresetSlug, ChargeFieldPresetMeta> = {
  "single-positive": {
    label: "Single positive",
    narration: "A single +1 point charge at the origin radiates outward.",
    state: { ...DEFAULT_STATE, preset: "single-positive" },
    charges: [{ x: 0, y: 0, q: 1 }],
  },
  dipole: {
    label: "Dipole",
    narration: "A classic dipole: +1 on the left, -1 on the right.",
    state: { ...DEFAULT_STATE, preset: "dipole" },
    charges: [
      { x: -0.5, y: 0, q: 1 },
      { x: 0.5, y: 0, q: -1 },
    ],
  },
  quadrupole: {
    label: "Quadrupole",
    narration: "Four alternating charges at the corners of a small square.",
    state: { ...DEFAULT_STATE, preset: "quadrupole" },
    charges: [
      { x: -0.5, y: -0.5, q: 1 },
      { x: 0.5, y: -0.5, q: -1 },
      { x: -0.5, y: 0.5, q: -1 },
      { x: 0.5, y: 0.5, q: 1 },
    ],
  },
  "two-positives": {
    label: "Two positives",
    narration: "Two positive charges repel each other along the x-axis.",
    state: { ...DEFAULT_STATE, preset: "two-positives" },
    charges: [
      { x: -0.5, y: 0, q: 1 },
      { x: 0.5, y: 0, q: 1 },
    ],
  },
};

export interface ChargeFieldPreset {
  name: string;
  state: ChargeFieldDemoState;
}

export const PRESETS: readonly ChargeFieldPreset[] = PRESET_SLUGS.map((slug) => ({
  name: PRESET_META[slug].label,
  state: PRESET_META[slug].state,
}));
