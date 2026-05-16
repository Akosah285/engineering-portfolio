/**
 * Named presets for the LU-decomposition visualiser.
 *
 * Each preset is a snapshot of share-relevant state (matrix slug + RHS b).
 * The actual 3×3 matrices are looked up via PRESET_META[slug].
 */

export const MATRIX_SLUGS = [
  "well-conditioned",
  "needs-pivot",
  "ill-conditioned",
  "diagonal-dominant",
  "singular",
] as const;

export type MatrixSlug = (typeof MATRIX_SLUGS)[number];

export interface LuDemoState {
  matrixSlug: MatrixSlug;
  b0: number;
  b1: number;
  b2: number;
}

export interface LuMatrixMeta {
  label: string;
  A: number[][];
}

export const PRESET_META: Record<MatrixSlug, LuMatrixMeta> = {
  "well-conditioned": {
    label: "Well-conditioned",
    A: [
      [4, 3, 2],
      [3, 4, 3],
      [2, 3, 4],
    ],
  },
  "needs-pivot": {
    label: "Needs pivot",
    A: [
      [0.001, 1, 1],
      [1, 1, 1],
      [1, 1, 2],
    ],
  },
  "ill-conditioned": {
    label: "Ill-conditioned",
    A: [
      [1, 1, 1],
      [1, 1.0001, 1],
      [1, 1, 1.0001],
    ],
  },
  "diagonal-dominant": {
    label: "Diagonal dominant",
    A: [
      [10, 1, 1],
      [1, 10, 1],
      [1, 1, 10],
    ],
  },
  singular: {
    label: "Singular",
    A: [
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 1],
    ],
  },
};

export const DEFAULT_STATE: LuDemoState = {
  matrixSlug: "well-conditioned",
  b0: 1,
  b1: 2,
  b2: 3,
};

export interface LuPreset {
  name: string;
  state: LuDemoState;
}

export const PRESETS: readonly LuPreset[] = [
  {
    name: "Well-conditioned",
    state: { matrixSlug: "well-conditioned", b0: 1, b1: 2, b2: 3 },
  },
  {
    name: "Needs pivot",
    state: { matrixSlug: "needs-pivot", b0: 1, b1: 2, b2: 3 },
  },
  {
    name: "Ill-conditioned",
    state: { matrixSlug: "ill-conditioned", b0: 1, b1: 1, b2: 1 },
  },
  {
    name: "Diagonal dominant",
    state: { matrixSlug: "diagonal-dominant", b0: 1, b1: 2, b2: 3 },
  },
  {
    name: "Singular",
    state: { matrixSlug: "singular", b0: 1, b1: 2, b2: 3 },
  },
] as const;
