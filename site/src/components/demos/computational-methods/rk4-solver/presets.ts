/**
 * Named ODE systems + presets for the RK4 visualiser (#76).
 *
 * Each `OdeSystem` bundles the derivative function with everything the
 * 2D canvas projection needs: an initial state vector, the (x, y)
 * projection from the n-dimensional state, and recommended axis ranges.
 *
 * Only `systemSlug` is persisted in URL state — the derivative function
 * itself isn't serialisable, so the shell resolves it via `getSystem()`.
 */

import type { DerivativeFn } from "./algorithm";

export type SystemSlug = "lorenz" | "vdp" | "pendulum" | "pendulum-large";

export interface OdeSystem {
  readonly slug: SystemSlug;
  readonly name: string;
  readonly f: DerivativeFn;
  readonly y0: ReadonlyArray<number>;
  /** Project an n-dim state vector down to a 2D point for the canvas. */
  readonly project: (y: ReadonlyArray<number>) => readonly [number, number];
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  readonly xLabel: string;
  readonly yLabel: string;
  readonly note: string;
}

/* --- Lorenz attractor (σ=10, ρ=28, β=8/3), project (x, z) --- */
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const lorenz: OdeSystem = {
  slug: "lorenz",
  name: "Lorenz attractor",
  f: (_t, y) => {
    const x = y[0]!;
    const yy = y[1]!;
    const z = y[2]!;
    return [SIGMA * (yy - x), x * (RHO - z) - yy, x * yy - BETA * z];
  },
  y0: [1, 1, 1],
  project: (y) => [y[0]!, y[2]!],
  xRange: [-25, 25],
  yRange: [0, 50],
  xLabel: "x",
  yLabel: "z",
  note: "The butterfly: chaotic 3D flow projected onto the xz-plane.",
};

/* --- Van der Pol (μ=2), project (y0, y1) phase plane --- */
const MU = 2;
const vdp: OdeSystem = {
  slug: "vdp",
  name: "Van der Pol oscillator",
  f: (_t, y) => {
    const a = y[0]!;
    const b = y[1]!;
    return [b, MU * (1 - a * a) * b - a];
  },
  y0: [2, 0],
  project: (y) => [y[0]!, y[1]!],
  xRange: [-3, 3],
  yRange: [-4, 4],
  xLabel: "x",
  yLabel: "ẋ",
  note: "Nonlinear oscillator converging onto its limit cycle.",
};

/* --- Damped pendulum (ω=2, b=0.3), project (θ, ω) phase plane --- */
const OMEGA = 2;
const DAMP = 0.3;
function pendulumF(_t: number, y: ReadonlyArray<number>): ReadonlyArray<number> {
  const theta = y[0]!;
  const omega = y[1]!;
  return [omega, -DAMP * omega - OMEGA * OMEGA * Math.sin(theta)];
}

const pendulum: OdeSystem = {
  slug: "pendulum",
  name: "Damped pendulum",
  f: pendulumF,
  y0: [1, 0],
  project: (y) => [y[0]!, y[1]!],
  xRange: [-Math.PI, Math.PI],
  yRange: [-4, 4],
  xLabel: "θ",
  yLabel: "ω",
  note: "Phase portrait spiralling into the stable equilibrium at θ = 0.",
};

const pendulumLarge: OdeSystem = {
  slug: "pendulum-large",
  name: "Damped pendulum (large swing)",
  f: pendulumF,
  y0: [2.5, 0],
  project: (y) => [y[0]!, y[1]!],
  xRange: [-Math.PI, Math.PI],
  yRange: [-4, 4],
  xLabel: "θ",
  yLabel: "ω",
  note: "Same pendulum kicked near the top — wider phase-plane orbits.",
};

export const SYSTEMS: Record<SystemSlug, OdeSystem> = {
  lorenz,
  vdp,
  pendulum,
  "pendulum-large": pendulumLarge,
};

export const SYSTEM_SLUGS: readonly SystemSlug[] = [
  "lorenz",
  "vdp",
  "pendulum",
  "pendulum-large",
] as const;

/** Resolve a slug to an OdeSystem, defaulting to "lorenz" on unknown input. */
export function getSystem(slug: string | undefined | null): OdeSystem {
  if (slug && slug in SYSTEMS) return SYSTEMS[slug as SystemSlug];
  return lorenz;
}

export interface Rk4DemoState {
  systemSlug: SystemSlug;
  dt: number;
  tEnd: number;
  speed: number;
}

export interface Rk4Preset {
  name: string;
  state: Rk4DemoState;
}

export const DEFAULT_STATE: Rk4DemoState = {
  systemSlug: "lorenz",
  dt: 0.01,
  tEnd: 50,
  speed: 10,
};

export const PRESETS: readonly Rk4Preset[] = [
  {
    name: "Lorenz butterfly",
    state: { systemSlug: "lorenz", dt: 0.01, tEnd: 50, speed: 10 },
  },
  {
    name: "Van der Pol limit cycle",
    state: { systemSlug: "vdp", dt: 0.01, tEnd: 20, speed: 10 },
  },
  {
    name: "Pendulum (small swing)",
    state: { systemSlug: "pendulum", dt: 0.01, tEnd: 20, speed: 20 },
  },
  {
    name: "Pendulum (chaotic-ish)",
    state: { systemSlug: "pendulum-large", dt: 0.005, tEnd: 30, speed: 20 },
  },
] as const;
