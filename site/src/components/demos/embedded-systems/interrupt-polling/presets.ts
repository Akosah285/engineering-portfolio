/**
 * Named workload presets for the interrupt-vs-polling visualiser.
 *
 * Each workload is a sequence of event arrival times (ms) within the
 * simulation window [0, 200]. Picking a chip just swaps the active
 * workload — the user's poll-period and interrupt-latency sliders are
 * preserved so they can A/B the same workload under different settings.
 */

export const WORKLOAD_SLUGS = [
  "sparse-events",
  "bursty-events",
  "steady-stream",
  "high-rate",
] as const;

export type WorkloadSlug = (typeof WORKLOAD_SLUGS)[number];

export interface Workload {
  slug: WorkloadSlug;
  name: string;
  events: readonly number[];
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let t = start; t <= end; t += step) out.push(t);
  return out;
}

export const WORKLOADS: readonly Workload[] = [
  {
    slug: "sparse-events",
    name: "Sparse",
    events: [25, 75, 130, 180],
  },
  {
    slug: "bursty-events",
    name: "Bursty",
    events: [10, 12, 15, 100, 105, 110, 180],
  },
  {
    slug: "steady-stream",
    name: "Steady stream",
    events: range(10, 190, 20),
  },
  {
    slug: "high-rate",
    name: "High rate",
    events: range(5, 195, 5),
  },
] as const;

export function getWorkload(slug: WorkloadSlug): Workload {
  const w = WORKLOADS.find((x) => x.slug === slug);
  if (!w) throw new Error(`unknown workload: ${slug}`);
  return w;
}

export interface InterruptPollingDemoState {
  pollPeriodMs: number;
  interruptLatencyMs: number;
  workload: WorkloadSlug;
}

export const DEFAULT_STATE: InterruptPollingDemoState = {
  pollPeriodMs: 10,
  interruptLatencyMs: 2,
  workload: "sparse-events",
};

/** Fixed simulation parameters (kept off the slider rail for simplicity). */
export const HANDLER_COST_MS = 2;
export const SIMULATION_DURATION_MS = 200;
export const POLL_COST_MS = 0.2;
