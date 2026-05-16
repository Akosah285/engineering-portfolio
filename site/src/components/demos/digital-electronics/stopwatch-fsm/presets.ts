/**
 * Named presets for the stopwatch-fsm visualiser.
 *
 * Each preset bundles an event log (StartStop / LapReset presses with timestamps)
 * plus a default scrub position so chip selection lands on a meaningful frame.
 */

import type { Event } from "./algorithm";

export type EventsSlug =
  | "start-stop-once"
  | "with-laps"
  | "reset-from-paused"
  | "never-pressed";

export const EVENTS_SLUGS: readonly EventsSlug[] = [
  "start-stop-once",
  "with-laps",
  "reset-from-paused",
  "never-pressed",
] as const;

export interface StopwatchDemoState {
  currentTime: number;
  events: EventsSlug;
}

export interface StopwatchPreset {
  name: string;
  state: StopwatchDemoState;
}

export const DEFAULT_STATE: StopwatchDemoState = {
  currentTime: 0,
  events: "start-stop-once",
};

/** Event logs keyed by slug. */
export const EVENT_LOGS: Record<EventsSlug, readonly Event[]> = {
  "start-stop-once": [
    { input: "startStop", at: 500 },
    { input: "startStop", at: 1500 },
  ],
  "with-laps": [
    { input: "startStop", at: 0 },
    { input: "lapReset", at: 500 },
    { input: "lapReset", at: 1200 },
    { input: "startStop", at: 2000 },
  ],
  "reset-from-paused": [
    { input: "startStop", at: 0 },
    { input: "startStop", at: 800 },
    { input: "lapReset", at: 1500 },
  ],
  "never-pressed": [],
};

/** Display names — each one is uniquely matchable by a regex in tests. */
export const PRESET_META: Record<EventsSlug, { name: string }> = {
  "start-stop-once": { name: "Start stop once" },
  "with-laps": { name: "With laps" },
  "reset-from-paused": { name: "Reset from paused" },
  "never-pressed": { name: "Never pressed" },
};

/** Sensible scrub default for each preset (last event time, or 0). */
export function defaultScrubFor(slug: EventsSlug): number {
  const log = EVENT_LOGS[slug];
  if (log.length === 0) return 0;
  const last = log[log.length - 1];
  return last ? last.at : 0;
}

/** Maximum slider extent for a given preset's event log. */
export function maxTimeFor(slug: EventsSlug): number {
  const log = EVENT_LOGS[slug];
  const lastAt = log.length === 0 ? 0 : (log[log.length - 1]?.at ?? 0);
  return Math.max(5000, lastAt + 1000);
}

export const PRESETS: readonly StopwatchPreset[] = EVENTS_SLUGS.map((slug) => ({
  name: PRESET_META[slug].name,
  state: { currentTime: defaultScrubFor(slug), events: slug },
}));
