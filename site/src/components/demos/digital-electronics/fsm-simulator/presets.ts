import type { StopwatchInput } from "./algorithm";

export type SequenceSlug =
  | "start-then-pause"
  | "start-pause-resume"
  | "reset-from-running"
  | "never-started";

export interface FsmDemoState {
  step: number;
  sequence: SequenceSlug;
}

export const SEQUENCES: Record<SequenceSlug, readonly StopwatchInput[]> = {
  "start-then-pause": ["start", "tick", "tick", "pause"],
  "start-pause-resume": ["start", "tick", "pause", "tick", "resume", "tick"],
  "reset-from-running": ["start", "tick", "tick", "reset"],
  "never-started": ["tick", "tick", "reset"],
};

export const SLUGS: readonly SequenceSlug[] = [
  "start-then-pause",
  "start-pause-resume",
  "reset-from-running",
  "never-started",
];

export const DEFAULT_STATE: FsmDemoState = {
  step: 0,
  sequence: "start-then-pause",
};

export interface FsmPreset {
  name: string;
  state: FsmDemoState;
}

export const PRESETS: readonly FsmPreset[] = [
  { name: "Start then pause", state: { step: 0, sequence: "start-then-pause" } },
  { name: "Start pause resume", state: { step: 0, sequence: "start-pause-resume" } },
  { name: "Reset from running", state: { step: 0, sequence: "reset-from-running" } },
  { name: "Never started", state: { step: 0, sequence: "never-started" } },
];
