/**
 * Named integrand presets for the Monte Carlo integration visualiser.
 *
 * Each preset bundles an integrand `f`, the integration interval `[a, b]`,
 * the analytic exact value (used for the error read-out), and a short label
 * for the preset chip.
 */

export type IntegrandSlug = "x-squared" | "sine" | "exponential" | "runge";

export interface Integrand {
  readonly slug: IntegrandSlug;
  readonly label: string;
  readonly name: string;
  readonly f: (x: number) => number;
  readonly a: number;
  readonly b: number;
  readonly exact: number;
}

export const INTEGRANDS: readonly Integrand[] = [
  {
    slug: "x-squared",
    label: "∫₀¹ x^2 dx = 1/3",
    name: "x squared",
    f: (x) => x * x,
    a: 0,
    b: 1,
    exact: 1 / 3,
  },
  {
    slug: "sine",
    label: "∫₀^π sin(x) dx = 2",
    name: "sine",
    f: (x) => Math.sin(x),
    a: 0,
    b: Math.PI,
    exact: 2,
  },
  {
    slug: "exponential",
    label: "∫₀^1 e^x dx = e-1",
    name: "exponential",
    f: (x) => Math.exp(x),
    a: 0,
    b: 1,
    exact: Math.E - 1,
  },
  {
    slug: "runge",
    label: "∫₋₁^1 1/(1+25x²) dx (Runge)",
    name: "Runge",
    f: (x) => 1 / (1 + 25 * x * x),
    a: -1,
    b: 1,
    exact: (2 / 5) * Math.atan(5),
  },
] as const;

export const INTEGRAND_SLUGS: readonly IntegrandSlug[] = INTEGRANDS.map(
  (i) => i.slug,
);

export function getIntegrand(slug: IntegrandSlug): Integrand {
  const found = INTEGRANDS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown integrand slug: ${slug}`);
  return found;
}

export interface MCIntegrationDemoState {
  integrandSlug: IntegrandSlug;
  nSamples: number;
  seed: number;
}

export interface MCIntegrationPreset {
  name: string;
  state: MCIntegrationDemoState;
}

export const DEFAULT_STATE: MCIntegrationDemoState = {
  integrandSlug: "x-squared",
  nSamples: 1000,
  seed: 42,
};

export const PRESETS: readonly MCIntegrationPreset[] = INTEGRANDS.map(
  (integrand) => ({
    name: integrand.label,
    state: {
      integrandSlug: integrand.slug,
      nSamples: 1000,
      seed: 42,
    },
  }),
);
