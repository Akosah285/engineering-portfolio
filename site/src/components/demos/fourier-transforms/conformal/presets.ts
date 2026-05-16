/**
 * Named presets for the conformal-map visualizer.
 *
 * Each preset switches the active analytic map f: C -> C. Centre stays put
 * on the user's last value, so the chips feel like map-pickers rather than
 * full state resets.
 */

import {
  type Complex,
  cExp,
  cSquare,
  joukowski,
} from "./algorithm";

export const MAP_SLUGS = [
  "identity",
  "z-squared",
  "exp-z",
  "joukowski-1",
] as const;

export type MapSlug = (typeof MAP_SLUGS)[number];

export const DEFAULT_MAP: MapSlug = "identity";

export type ComplexFn = (z: Complex) => Complex;

export const MAP_FNS: Record<MapSlug, ComplexFn> = {
  identity: (z) => z,
  "z-squared": (z) => cSquare(z),
  "exp-z": (z) => cExp(z),
  "joukowski-1": (z) => joukowski(z, 1),
};

export const MAP_LABEL: Record<MapSlug, string> = {
  identity: "Identity",
  "z-squared": "Squared",
  "exp-z": "Exponential",
  "joukowski-1": "Joukowski",
};

export interface ConformalDemoState {
  centerRe: number;
  centerIm: number;
  map: MapSlug;
}

export const DEFAULT_STATE: ConformalDemoState = {
  centerRe: 0,
  centerIm: 0,
  map: DEFAULT_MAP,
};

export interface ConformalPreset {
  name: string;
  state: { map: MapSlug };
}

export const PRESETS: readonly ConformalPreset[] = MAP_SLUGS.map((slug) => ({
  name: MAP_LABEL[slug],
  state: { map: slug },
}));
