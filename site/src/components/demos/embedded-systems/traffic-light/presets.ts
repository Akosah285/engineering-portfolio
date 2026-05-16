/**
 * Named presets for the traffic-light FSM visualiser.
 */

import type { Mode } from "./algorithm";

export interface TrafficLightDemoState {
  modeSlug: Mode;
  greenMs: number;
  yellowMs: number;
  allRedMs: number;
  totalMs: number;
}

export interface TrafficLightPreset {
  name: string;
  state: TrafficLightDemoState;
}

export const MODE_SLUGS = ["normal", "flash", "ped"] as const;

export const DEFAULT_STATE: TrafficLightDemoState = {
  modeSlug: "normal",
  greenMs: 5000,
  yellowMs: 1500,
  allRedMs: 1000,
  totalMs: 30000,
};

export const PRESET_META = {
  normal: {
    label: "Normal",
    greenMs: 5000,
    yellowMs: 1500,
    allRedMs: 1000,
    totalMs: 30000,
  },
  flash: {
    label: "Flash mode",
    greenMs: 5000,
    yellowMs: 1500,
    allRedMs: 1000,
    totalMs: 10000,
  },
  ped: {
    label: "Pedestrian phase",
    greenMs: 5000,
    yellowMs: 1500,
    allRedMs: 1000,
    totalMs: 10000,
  },
} as const;

export const PRESETS: readonly TrafficLightPreset[] = (MODE_SLUGS as readonly Mode[]).map(
  (slug) => {
    const meta = PRESET_META[slug];
    return {
      name: meta.label,
      state: {
        modeSlug: slug,
        greenMs: meta.greenMs,
        yellowMs: meta.yellowMs,
        allRedMs: meta.allRedMs,
        totalMs: meta.totalMs,
      },
    };
  },
);
