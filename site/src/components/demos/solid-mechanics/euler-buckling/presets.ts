/**
 * Named presets for the Euler-buckling visualiser (#91).
 *
 * Each preset selects an end-condition; column geometry and material
 * stay at their defaults so users can compare K-factors side-by-side.
 */

import type { EndCondition } from "./algorithm";

export interface EulerBucklingDemoState {
  endConditionSlug: EndCondition;
  L: number;
  E_GPa: number;
  I_cm4: number;
  area_cm2: number;
  yieldStress_MPa: number;
}

export interface EulerBucklingPreset {
  name: string;
  state: EulerBucklingDemoState;
}

export const END_CONDITION_SLUGS: readonly EndCondition[] = [
  "pinned-pinned",
  "fixed-fixed",
  "fixed-pinned",
  "fixed-free",
] as const;

export const PRESET_META: Readonly<Record<EndCondition, { label: string }>> = {
  "pinned-pinned": { label: "Pinned–pinned (K = 1.0)" },
  "fixed-fixed": { label: "Fixed–fixed (K = 0.5)" },
  "fixed-pinned": { label: "Fixed–pinned (K = 0.7)" },
  "fixed-free": { label: "Fixed–free cantilever (K = 2.0)" },
};

export const DEFAULT_STATE: EulerBucklingDemoState = {
  endConditionSlug: "pinned-pinned",
  L: 2,
  E_GPa: 200,
  I_cm4: 100,
  area_cm2: 10,
  yieldStress_MPa: 250,
};

export const PRESETS: readonly EulerBucklingPreset[] = END_CONDITION_SLUGS.map(
  (slug) => ({
    name: PRESET_META[slug].label,
    state: { ...DEFAULT_STATE, endConditionSlug: slug },
  }),
);
