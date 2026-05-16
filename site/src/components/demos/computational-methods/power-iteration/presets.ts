/**
 * Named presets for the power-iteration visualiser (#85).
 *
 * Each preset is a snapshot of share-relevant state (the matrix slug) plus
 * the actual 2x2 matrix to feed `powerIteration`. The matrix itself can't
 * live in `useDemoState` (arrays aren't a supported field kind), so we look
 * it up from `PRESET_META` keyed by slug.
 */

import type { Matrix } from "./algorithm";

export const MATRIX_SLUGS = [
  "symmetric-2x2",
  "rotation-ish",
  "diagonal-2x2",
  "almost-singular",
  "negative-eigenvalue",
] as const;

export type MatrixSlug = (typeof MATRIX_SLUGS)[number];

export interface PowerIterationDemoState {
  matrixSlug: MatrixSlug;
  stepDelay: number;
  maxIterations: number;
}

export interface PresetMeta {
  readonly label: string;
  readonly A: Matrix;
  readonly blurb: string;
}

export const PRESET_META: Readonly<Record<MatrixSlug, PresetMeta>> = {
  "symmetric-2x2": {
    label: "Symmetric 2×2",
    A: [
      [2, 1],
      [1, 3],
    ],
    blurb: "well-conditioned symmetric matrix, dominant eigenvalue ≈ 3.618",
  },
  "rotation-ish": {
    label: "Rotation-ish",
    A: [
      [0.9, 0.5],
      [-0.4, 1.1],
    ],
    blurb: "near-rotation matrix with an interesting spiralling transient",
  },
  "diagonal-2x2": {
    label: "Diagonal 2×2",
    A: [
      [3, 0],
      [0, 1],
    ],
    blurb: "diagonal matrix that snaps v onto e₁ almost instantly",
  },
  "almost-singular": {
    label: "Almost singular",
    A: [
      [1, 1],
      [1, 1.01],
    ],
    blurb: "nearly-rank-1 matrix; |λ₂/λ₁| ≈ 1 so convergence is slow",
  },
  "negative-eigenvalue": {
    label: "Negative eigenvalue",
    A: [
      [-2, 0],
      [0, 1],
    ],
    blurb: "dominant eigenvalue is −2; sign-align flips on every step",
  },
};

export const DEFAULT_STATE: PowerIterationDemoState = {
  matrixSlug: "symmetric-2x2",
  stepDelay: 200,
  maxIterations: 100,
};

export interface PowerIterationPreset {
  name: string;
  state: PowerIterationDemoState;
}

export const PRESETS: readonly PowerIterationPreset[] = MATRIX_SLUGS.map((slug) => ({
  name: PRESET_META[slug].label,
  state: { ...DEFAULT_STATE, matrixSlug: slug },
}));
