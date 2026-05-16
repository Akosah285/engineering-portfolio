/**
 * Named transfer-function presets for the Bode plot visualiser (#111).
 *
 * Each TF preset defines a rational transfer function in pole-zero-gain form
 * (see ./algorithm.ts).  The carousel snapshots wrap a TF slug together with
 * a sensible default decade range, so URL-shared state stays compact (only
 * the slug + slider values flow through <useDemoState>).
 */

import type { Complex, TransferFunction } from "./algorithm";

export type TfSlug =
  | "first-order-lp"
  | "second-order-underdamped"
  | "lead"
  | "lag"
  | "notch";

export const TF_SLUGS = [
  "first-order-lp",
  "second-order-underdamped",
  "lead",
  "lag",
  "notch",
] as const satisfies readonly TfSlug[];

export interface TfPreset {
  readonly slug: TfSlug;
  readonly name: string;
  readonly tf: TransferFunction;
}

const c = (re: number, im: number): Complex => ({ re, im });

export const TF_PRESETS: Readonly<Record<TfSlug, TfPreset>> = {
  "first-order-lp": {
    slug: "first-order-lp",
    name: "First-order LP (τ=1)",
    tf: { gain: 1, zeros: [], poles: [c(-1, 0)] },
  },
  "second-order-underdamped": {
    slug: "second-order-underdamped",
    name: "Second-order underdamped",
    tf: { gain: 1, zeros: [], poles: [c(-0.5, 1), c(-0.5, -1)] },
  },
  lead: {
    slug: "lead",
    name: "Lead compensator (zero<pole)",
    tf: { gain: 10, zeros: [c(-1, 0)], poles: [c(-10, 0)] },
  },
  lag: {
    slug: "lag",
    name: "Lag compensator (pole<zero)",
    tf: { gain: 1, zeros: [c(-10, 0)], poles: [c(-1, 0)] },
  },
  notch: {
    slug: "notch",
    name: "Notch filter (complex zeros on axis)",
    tf: {
      gain: 1,
      zeros: [c(0, 5), c(0, -5)],
      poles: [c(-1, 5), c(-1, -5)],
    },
  },
};

export function getTfPreset(slug: TfSlug): TfPreset {
  return TF_PRESETS[slug];
}

export interface BodeDemoState {
  tfSlug: TfSlug;
  startDecade: number;
  endDecade: number;
  pointsPerDecade: number;
}

export interface BodePreset {
  name: string;
  state: BodeDemoState;
}

export const DEFAULT_STATE: BodeDemoState = {
  tfSlug: "first-order-lp",
  startDecade: -1,
  endDecade: 3,
  pointsPerDecade: 20,
};

export const PRESETS: readonly BodePreset[] = [
  {
    name: "First-order LP (τ=1)",
    state: {
      tfSlug: "first-order-lp",
      startDecade: -1,
      endDecade: 3,
      pointsPerDecade: 20,
    },
  },
  {
    name: "Second-order underdamped",
    state: {
      tfSlug: "second-order-underdamped",
      startDecade: -1,
      endDecade: 2,
      pointsPerDecade: 30,
    },
  },
  {
    name: "Lead compensator (zero<pole)",
    state: {
      tfSlug: "lead",
      startDecade: -1,
      endDecade: 3,
      pointsPerDecade: 20,
    },
  },
  {
    name: "Lag compensator (pole<zero)",
    state: {
      tfSlug: "lag",
      startDecade: -2,
      endDecade: 2,
      pointsPerDecade: 20,
    },
  },
  {
    name: "Notch filter (complex zeros on axis)",
    state: {
      tfSlug: "notch",
      startDecade: -1,
      endDecade: 2,
      pointsPerDecade: 30,
    },
  },
] as const;
