/**
 * Presets + named geometries for the truss-analyzer visualiser.
 *
 * Each preset wires a static geometry (joints + members + supports) to
 * a default load joint; the visualiser overrides the `loads` array based
 * on the user's `loadMag` / `loadJoint` slider state.
 *
 * Determinacy invariant for every preset: U = M + R = 2J.
 */

import type { Joint, Member, Support } from "./algorithm";

export type ShowZero = "show" | "hide";

export interface TrussAnalyzerDemoState {
  preset: PresetSlug;
  loadMag: number;
  loadJoint: string;
  showZeroMembers: ShowZero;
}

export const PRESET_SLUGS = [
  "simple-triangle",
  "warren-truss",
  "howe-truss",
  "cantilever",
] as const;
export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface TrussGeometry {
  readonly joints: readonly Joint[];
  readonly members: readonly Member[];
  readonly supports: readonly Support[];
  readonly defaultLoadJoint: string;
}

export interface PresetMeta {
  readonly slug: PresetSlug;
  readonly label: string;
  readonly narration: string;
  readonly geometry: TrussGeometry;
  readonly state: TrussAnalyzerDemoState;
}

export const TRUSS_GEOMETRIES: Record<PresetSlug, TrussGeometry> = {
  "simple-triangle": {
    joints: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 4, y: 0 },
      { id: "C", x: 2, y: 2 },
    ],
    members: [
      { i: "A", j: "B" },
      { i: "B", j: "C" },
      { i: "A", j: "C" },
    ],
    supports: [
      { joint: "A", kind: "pin" },
      { joint: "B", kind: "roller-y" },
    ],
    defaultLoadJoint: "C",
  },
  "warren-truss": {
    // 5 joints, 7 members, 3 reactions => 10 = 2*5
    joints: [
      { id: "J1", x: 0, y: 0 },
      { id: "J2", x: 2, y: 1.5 },
      { id: "J3", x: 4, y: 0 },
      { id: "J4", x: 6, y: 1.5 },
      { id: "J5", x: 8, y: 0 },
    ],
    members: [
      { i: "J1", j: "J3" },
      { i: "J3", j: "J5" },
      { i: "J1", j: "J2" },
      { i: "J2", j: "J3" },
      { i: "J3", j: "J4" },
      { i: "J4", j: "J5" },
      { i: "J2", j: "J4" },
    ],
    supports: [
      { joint: "J1", kind: "pin" },
      { joint: "J5", kind: "roller-y" },
    ],
    defaultLoadJoint: "J3",
  },
  "howe-truss": {
    // 4 joints, 5 members, 3 reactions => 8 = 2*4
    joints: [
      { id: "J1", x: 0, y: 0 },
      { id: "J2", x: 2, y: 2 },
      { id: "J3", x: 4, y: 0 },
      { id: "J4", x: 2, y: 0 },
    ],
    members: [
      { i: "J1", j: "J2" },
      { i: "J2", j: "J3" },
      { i: "J1", j: "J4" },
      { i: "J4", j: "J3" },
      { i: "J2", j: "J4" },
    ],
    supports: [
      { joint: "J1", kind: "pin" },
      { joint: "J3", kind: "roller-y" },
    ],
    defaultLoadJoint: "J2",
  },
  cantilever: {
    // 4 joints, 4 members, 2 pins => 4 reactions; 8 = 2*4
    joints: [
      { id: "J1", x: 0, y: 2 },
      { id: "J2", x: 0, y: 0 },
      { id: "J3", x: 2, y: 2 },
      { id: "J4", x: 2, y: 0 },
    ],
    members: [
      { i: "J1", j: "J3" },
      { i: "J2", j: "J4" },
      { i: "J3", j: "J4" },
      { i: "J1", j: "J4" },
    ],
    supports: [
      { joint: "J1", kind: "pin" },
      { joint: "J2", kind: "pin" },
    ],
    defaultLoadJoint: "J3",
  },
};

/** Union of every joint id used across all presets — needed for the enum schema. */
export const ALL_JOINT_IDS = ["A", "B", "C", "J1", "J2", "J3", "J4", "J5"] as const;

const DEFAULT_LOAD_MAG = 4;

function makePresetState(
  slug: PresetSlug,
  geometry: TrussGeometry,
): TrussAnalyzerDemoState {
  return {
    preset: slug,
    loadMag: DEFAULT_LOAD_MAG,
    loadJoint: geometry.defaultLoadJoint,
    showZeroMembers: "show",
  };
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  "simple-triangle": {
    slug: "simple-triangle",
    label: "Simple Triangle",
    narration: "Three-joint pin-roller triangle — the canonical determinate truss.",
    geometry: TRUSS_GEOMETRIES["simple-triangle"],
    state: makePresetState("simple-triangle", TRUSS_GEOMETRIES["simple-triangle"]),
  },
  "warren-truss": {
    slug: "warren-truss",
    label: "Warren Truss",
    narration:
      "Five-joint Warren truss with alternating diagonals — common in bridge spans.",
    geometry: TRUSS_GEOMETRIES["warren-truss"],
    state: makePresetState("warren-truss", TRUSS_GEOMETRIES["warren-truss"]),
  },
  "howe-truss": {
    slug: "howe-truss",
    label: "Howe Truss",
    narration: "Four-joint Howe-style truss with a central vertical member.",
    geometry: TRUSS_GEOMETRIES["howe-truss"],
    state: makePresetState("howe-truss", TRUSS_GEOMETRIES["howe-truss"]),
  },
  cantilever: {
    slug: "cantilever",
    label: "Cantilever",
    narration: "Two pins on the wall and a free end carrying the load.",
    geometry: TRUSS_GEOMETRIES.cantilever,
    state: makePresetState("cantilever", TRUSS_GEOMETRIES.cantilever),
  },
};

export const DEFAULT_STATE: TrussAnalyzerDemoState = PRESET_META["simple-triangle"].state;

export const PRESETS: readonly { name: string; state: TrussAnalyzerDemoState }[] =
  PRESET_SLUGS.map((slug) => ({
    name: PRESET_META[slug].label,
    state: PRESET_META[slug].state,
  }));
