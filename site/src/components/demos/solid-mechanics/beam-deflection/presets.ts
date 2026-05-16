/**
 * Named presets for the beam-deflection visualiser (#88 shell).
 */

export type BeamCaseSlug =
  | "cantilever-point"
  | "cantilever-udl"
  | "simply-supported-point"
  | "simply-supported-udl";

export const CASE_SLUGS = [
  "cantilever-point",
  "cantilever-udl",
  "simply-supported-point",
  "simply-supported-udl",
] as const satisfies readonly BeamCaseSlug[];

export const CASE_LABELS: Record<BeamCaseSlug, string> = {
  "cantilever-point": "Cantilever — Point load at tip",
  "cantilever-udl": "Cantilever — Distributed load (UDL)",
  "simply-supported-point": "Simply-supported — Point at midspan",
  "simply-supported-udl": "Simply-supported — Distributed load (UDL)",
};

export interface BeamDemoState {
  caseSlug: BeamCaseSlug;
  L: number;
  E_GPa: number;
  I_cm4: number;
  P_or_w: number;
}

export interface BeamPreset {
  name: string;
  state: BeamDemoState;
}

export const DEFAULT_STATE: BeamDemoState = {
  caseSlug: "cantilever-point",
  L: 2,
  E_GPa: 200,
  I_cm4: 100,
  P_or_w: 5,
};

export const PRESETS: readonly BeamPreset[] = [
  {
    name: CASE_LABELS["cantilever-point"],
    state: { caseSlug: "cantilever-point", L: 2, E_GPa: 200, I_cm4: 100, P_or_w: 5 },
  },
  {
    name: CASE_LABELS["cantilever-udl"],
    state: { caseSlug: "cantilever-udl", L: 3, E_GPa: 200, I_cm4: 200, P_or_w: 2 },
  },
  {
    name: CASE_LABELS["simply-supported-point"],
    state: {
      caseSlug: "simply-supported-point",
      L: 4,
      E_GPa: 200,
      I_cm4: 500,
      P_or_w: 10,
    },
  },
  {
    name: CASE_LABELS["simply-supported-udl"],
    state: { caseSlug: "simply-supported-udl", L: 4, E_GPa: 200, I_cm4: 500, P_or_w: 5 },
  },
] as const;
