/**
 * Named presets + parametric target paths for the two-link IK visualiser.
 *
 * Each path function maps a normalised parameter t in [0, 1] to a target
 * (x, y) in world units. The visualiser advances t over time and asks
 * the IK solver to chase the moving target.
 */

export type PathSlug = "circle" | "square" | "fig8" | "line";
export type ElbowChoice = "up" | "down";

export const PATH_SLUGS: readonly PathSlug[] = [
  "circle",
  "square",
  "fig8",
  "line",
] as const;

export const ELBOW_CHOICES: readonly ElbowChoice[] = ["up", "down"] as const;

export interface TwoLinkIkDemoState {
  pathSlug: PathSlug;
  l1: number;
  l2: number;
  elbow: ElbowChoice;
  cycleSpeed: number;
}

export interface TwoLinkIkPreset {
  name: string;
  state: TwoLinkIkDemoState;
}

export const DEFAULT_STATE: TwoLinkIkDemoState = {
  pathSlug: "circle",
  l1: 1,
  l2: 1,
  elbow: "up",
  cycleSpeed: 0.5,
};

export const PRESETS: readonly TwoLinkIkPreset[] = [
  {
    name: "Circle (reachable)",
    state: { pathSlug: "circle", l1: 1, l2: 1, elbow: "up", cycleSpeed: 0.5 },
  },
  {
    name: "Square (some unreachable)",
    state: { pathSlug: "square", l1: 1, l2: 1, elbow: "up", cycleSpeed: 0.5 },
  },
  {
    name: "Figure-8",
    state: { pathSlug: "fig8", l1: 1, l2: 0.7, elbow: "up", cycleSpeed: 0.7 },
  },
  {
    name: "Line scan (workspace edge)",
    state: { pathSlug: "line", l1: 1, l2: 1, elbow: "up", cycleSpeed: 0.4 },
  },
] as const;

export interface TargetPoint {
  readonly x: number;
  readonly y: number;
}

export type PathFn = (t: number) => TargetPoint;

/** Circle of radius 0.6 centred at (1, 0.5). */
const circle: PathFn = (t) => ({
  x: 1 + 0.6 * Math.cos(2 * Math.PI * t),
  y: 0.5 + 0.6 * Math.sin(2 * Math.PI * t),
});

/** Axis-aligned square (side 1.2) centred at (1, 0). */
const square: PathFn = (t) => {
  const cx = 1;
  const cy = 0;
  const half = 0.6;
  const u = ((t % 1) + 1) % 1; // wrap into [0, 1)
  const side = Math.floor(u * 4);
  const local = u * 4 - side;
  switch (side) {
    case 0:
      return { x: cx - half + local * (2 * half), y: cy - half };
    case 1:
      return { x: cx + half, y: cy - half + local * (2 * half) };
    case 2:
      return { x: cx + half - local * (2 * half), y: cy + half };
    default:
      return { x: cx - half, y: cy + half - local * (2 * half) };
  }
};

/** Lemniscate-ish figure-8: x = sin(2πt), y = 0.5 sin(4πt). */
const fig8: PathFn = (t) => ({
  x: Math.sin(2 * Math.PI * t),
  y: 0.5 * Math.sin(4 * Math.PI * t),
});

/** Horizontal line scan x ∈ [0, 2] at y = 0.5, ping-ponging across t. */
const line: PathFn = (t) => {
  const u = ((t % 1) + 1) % 1;
  const sweep = u < 0.5 ? u * 2 : 2 - u * 2; // 0 → 1 → 0
  return { x: sweep * 2, y: 0.5 };
};

const PATH_LOOKUP: Record<PathSlug, PathFn> = {
  circle,
  square,
  fig8,
  line,
};

export const PATH_LABELS: Record<PathSlug, string> = {
  circle: "circle",
  square: "square",
  fig8: "figure-8",
  line: "horizontal line scan",
};

export function getPath(slug: PathSlug): PathFn {
  return PATH_LOOKUP[slug];
}
