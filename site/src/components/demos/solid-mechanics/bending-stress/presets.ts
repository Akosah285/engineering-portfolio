/**
 * Named presets for the bending-stress visualiser.
 *
 * Each preset is a snapshot of share-relevant state so the <PresetCarousel>
 * can teleport the user to a canonical configuration. Dimensions are stored
 * in millimetres; the visualiser converts to metres before invoking the
 * algorithm.
 */

export const PRESET_SLUGS = [
  "rect-shallow",
  "rect-deep",
  "solid-circle",
  "wide-flange-ibeam",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export type SectionKind = "rect" | "circle" | "ibeam";

export const SECTION_KINDS = ["rect", "circle", "ibeam"] as const;

export interface BendingStressDemoState {
  /** Applied bending moment, kN·m. */
  M: number;
  /** Cross-section kind. */
  kind: SectionKind;
  /** Primary dimension (mm). rect: b, circle: R, ibeam: B. */
  dim1: number;
  /** Secondary dimension (mm). rect: h, ibeam: H. Unused for circle. */
  dim2: number;
}

export const DEFAULT_STATE: BendingStressDemoState = {
  M: 10,
  kind: "rect",
  dim1: 100,
  dim2: 200,
};

export interface BendingStressPreset {
  slug: PresetSlug;
  name: string;
  state: BendingStressDemoState;
}

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "rect-shallow": { name: "rect-shallow" },
  "rect-deep": { name: "rect-deep" },
  "solid-circle": { name: "solid-circle" },
  "wide-flange-ibeam": { name: "wide-flange-ibeam" },
};

export const PRESETS: readonly BendingStressPreset[] = [
  {
    slug: "rect-shallow",
    name: PRESET_META["rect-shallow"].name,
    state: { M: 10, kind: "rect", dim1: 200, dim2: 60 },
  },
  {
    slug: "rect-deep",
    name: PRESET_META["rect-deep"].name,
    state: { M: 10, kind: "rect", dim1: 60, dim2: 300 },
  },
  {
    slug: "solid-circle",
    name: PRESET_META["solid-circle"].name,
    state: { M: 10, kind: "circle", dim1: 100, dim2: 100 },
  },
  {
    slug: "wide-flange-ibeam",
    name: PRESET_META["wide-flange-ibeam"].name,
    state: { M: 20, kind: "ibeam", dim1: 200, dim2: 300 },
  },
] as const;
