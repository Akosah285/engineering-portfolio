/**
 * Named presets for the Gaussian elimination visualiser.
 *
 * Each preset bundles a square matrix A and right-hand-side b along with
 * a shareable system slug. The slug doubles as the share-URL discriminator
 * via <useDemoState>.
 */

export type SystemSlug = "3x3-simple" | "3x3-swap" | "4x4-dense" | "3x3-singular";

export const SYSTEM_SLUGS: readonly SystemSlug[] = [
  "3x3-simple",
  "3x3-swap",
  "4x4-dense",
  "3x3-singular",
] as const;

export interface LinearSystem {
  readonly name: string;
  readonly A: readonly (readonly number[])[];
  readonly b: readonly number[];
}

export const SYSTEMS: Readonly<Record<SystemSlug, LinearSystem>> = {
  "3x3-simple": {
    name: "3x3 simple (no swap needed)",
    A: [
      [2, 1, -1],
      [3, -1, 2],
      [-2, 1, 2],
    ],
    b: [8, -11, -3],
  },
  "3x3-swap": {
    name: "3x3 needs swap (zero pivot)",
    A: [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
    b: [2, 2, 2],
  },
  "4x4-dense": {
    name: "4x4 dense",
    A: [
      [4, 3, 2, 1],
      [3, 4, 3, 2],
      [2, 3, 4, 3],
      [1, 2, 3, 4],
    ],
    b: [10, 12, 12, 10],
  },
  "3x3-singular": {
    name: "3x3 singular (visible)",
    A: [
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 1],
    ],
    b: [6, 12, 3],
  },
};

export interface GaussianDemoState {
  systemSlug: SystemSlug;
  stepDelay: number;
}

export interface GaussianPreset {
  name: string;
  state: GaussianDemoState;
}

export const DEFAULT_STATE: GaussianDemoState = {
  systemSlug: "3x3-simple",
  stepDelay: 700,
};

export const PRESETS: readonly GaussianPreset[] = SYSTEM_SLUGS.map((slug) => ({
  name: SYSTEMS[slug].name,
  state: { systemSlug: slug, stepDelay: DEFAULT_STATE.stepDelay },
}));

export function getSystem(slug: SystemSlug): LinearSystem {
  return SYSTEMS[slug];
}
