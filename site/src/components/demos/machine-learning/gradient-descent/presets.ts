/**
 * Named presets for the gradient-descent visualiser (#24).
 *
 * Each preset is a snapshot of all share-relevant state, so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via <useDemoState>.
 */

import type { SurfaceSlug } from "./surfaces";

export interface DescentDemoState {
  surface: SurfaceSlug;
  lr: number;
  momentum: number;
  startX: number;
  startY: number;
}

export interface DescentPreset {
  name: string;
  state: DescentDemoState;
}

export const DEFAULT_STATE: DescentDemoState = {
  surface: "quadratic",
  lr: 0.05,
  momentum: 0.9,
  startX: 2,
  startY: 2,
};

export const PRESETS: readonly DescentPreset[] = [
  {
    name: "Bowl (vanilla)",
    state: {
      surface: "quadratic",
      lr: 0.05,
      momentum: 0.0,
      startX: 2.5,
      startY: 1.8,
    },
  },
  {
    name: "Bowl (momentum)",
    state: {
      surface: "quadratic",
      lr: 0.05,
      momentum: 0.9,
      startX: 2.5,
      startY: 1.8,
    },
  },
  {
    name: "Saddle escape",
    state: {
      surface: "saddle",
      lr: 0.02,
      momentum: 0.85,
      startX: 0.05,
      startY: 0.05,
    },
  },
  {
    name: "Rosenbrock valley",
    state: {
      surface: "rosenbrock",
      lr: 0.001,
      momentum: 0.95,
      startX: -1.5,
      startY: 2.0,
    },
  },
  {
    name: "Vanishing plateau",
    state: {
      surface: "plateau",
      lr: 0.5,
      momentum: 0.7,
      startX: 3.0,
      startY: 2.5,
    },
  },
] as const;
