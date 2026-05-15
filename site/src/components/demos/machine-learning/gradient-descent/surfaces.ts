/**
 * 2D loss surfaces for the gradient-descent visualiser (#24).
 *
 * Each surface defines:
 *   - `name`   — display name + slug
 *   - `loss`   — L(x, y)
 *   - `grad`   — ∇L(x, y)
 *   - `bounds` — { xMin, xMax, yMin, yMax } recommended viewport
 *   - `minimum` — known location of the global minimum (for narration)
 */

import type { GradFn, LossFn } from "./algorithm";

export interface Surface {
  name: string;
  slug: SurfaceSlug;
  loss: LossFn;
  grad: GradFn;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  minimum: { x: number; y: number };
  /** Optional human note rendered in the description / narration. */
  note?: string;
}

export type SurfaceSlug = "quadratic" | "saddle" | "rosenbrock" | "plateau";

/* --- Quadratic bowl: L(x, y) = x² + y² --- */
const quadratic: Surface = {
  name: "Quadratic",
  slug: "quadratic",
  loss: (x, y) => x * x + y * y,
  grad: (x, y) => [2 * x, 2 * y] as const,
  bounds: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
  minimum: { x: 0, y: 0 },
  note: "A simple convex bowl — the easy case.",
};

/* --- Saddle: L(x, y) = x² − y² --- */
const saddle: Surface = {
  name: "Saddle",
  slug: "saddle",
  loss: (x, y) => x * x - y * y,
  grad: (x, y) => [2 * x, -2 * y] as const,
  bounds: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
  // Note: a saddle has no global minimum; we use the saddle-point itself
  minimum: { x: 0, y: 0 },
  note: "A saddle point at the origin — descent escapes downward in y.",
};

/* --- Rosenbrock: L(x, y) = (1−x)² + 100(y−x²)² --- */
const rosenbrock: Surface = {
  name: "Rosenbrock",
  slug: "rosenbrock",
  loss: (x, y) => {
    const a = 1 - x;
    const b = y - x * x;
    return a * a + 100 * b * b;
  },
  grad: (x, y) => {
    // ∂L/∂x = -2(1 - x) - 400 x (y - x²)
    // ∂L/∂y =  200 (y - x²)
    const dx = -2 * (1 - x) - 400 * x * (y - x * x);
    const dy = 200 * (y - x * x);
    return [dx, dy] as const;
  },
  bounds: { xMin: -2, xMax: 2, yMin: -1, yMax: 3 },
  minimum: { x: 1, y: 1 },
  note: "A narrow curving valley — the classic optimisation torture test.",
};

/* --- Plateau: L(x, y) = (x² + y²) / (1 + x² + y²) --- */
const plateau: Surface = {
  name: "Plateau",
  slug: "plateau",
  loss: (x, y) => {
    const r2 = x * x + y * y;
    return r2 / (1 + r2);
  },
  grad: (x, y) => {
    // L = r² / (1 + r²), ∂L/∂x = 2x / (1 + r²)²
    const r2 = x * x + y * y;
    const denom = (1 + r2) * (1 + r2);
    return [(2 * x) / denom, (2 * y) / denom] as const;
  },
  bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
  minimum: { x: 0, y: 0 },
  note: "A flat plateau where gradients vanish far from the minimum.",
};

export const SURFACES: Record<SurfaceSlug, Surface> = {
  quadratic,
  saddle,
  rosenbrock,
  plateau,
};

export const SURFACE_SLUGS: readonly SurfaceSlug[] = [
  "quadratic",
  "saddle",
  "rosenbrock",
  "plateau",
] as const;

/** Resolve a slug to a Surface, defaulting to "quadratic" on unknown input. */
export function getSurface(slug: string | undefined | null): Surface {
  if (slug && slug in SURFACES) return SURFACES[slug as SurfaceSlug];
  return quadratic;
}
