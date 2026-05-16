/**
 * Named presets for the solar-tracker visualiser.
 *
 * Each preset maps a human-friendly sky scenario to a fixed pair of
 * (east, west) LDR readings. Picking a preset only sets the `sky`
 * field of the demo state — the user's chosen panel angle and
 * deadband are preserved.
 */

export type SkySlug =
  | "morning-east-bright"
  | "noon-balanced"
  | "evening-west-bright"
  | "slightly-east";

export interface SkyPattern {
  readonly slug: SkySlug;
  readonly name: string;
  readonly east: number;
  readonly west: number;
  /** Sun position as a fraction of the sky arc, 0=east horizon, 1=west horizon. */
  readonly sunFraction: number;
}

export const PATTERNS: readonly SkyPattern[] = [
  {
    slug: "morning-east-bright",
    name: "Morning east",
    east: 900,
    west: 200,
    sunFraction: 0.15,
  },
  {
    slug: "noon-balanced",
    name: "Noon balanced",
    east: 600,
    west: 600,
    sunFraction: 0.5,
  },
  {
    slug: "evening-west-bright",
    name: "Evening west",
    east: 150,
    west: 800,
    sunFraction: 0.85,
  },
  {
    slug: "slightly-east",
    name: "Slightly east",
    east: 505,
    west: 500,
    sunFraction: 0.45,
  },
] as const;

export const SKY_SLUGS: readonly SkySlug[] = PATTERNS.map((p) => p.slug);

export const DEFAULT_SKY: SkySlug = "morning-east-bright";

export function getPattern(slug: SkySlug): SkyPattern {
  const found = PATTERNS.find((p) => p.slug === slug);
  if (!found) {
    // Fallback to first pattern to satisfy noUncheckedIndexedAccess.
    const first = PATTERNS[0];
    if (!first) throw new Error("PATTERNS is empty");
    return first;
  }
  return found;
}

export function patternIndex(slug: SkySlug): number {
  const idx = PATTERNS.findIndex((p) => p.slug === slug);
  return idx < 0 ? 0 : idx;
}

export function patternAt(index: number): SkyPattern {
  const i = Math.max(0, Math.min(PATTERNS.length - 1, Math.round(index)));
  const p = PATTERNS[i];
  if (!p) {
    const first = PATTERNS[0];
    if (!first) throw new Error("PATTERNS is empty");
    return first;
  }
  return p;
}
