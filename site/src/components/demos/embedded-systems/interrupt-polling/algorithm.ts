// Interrupt vs Polling — latency / utilization comparison.
// Reference: Patterson & Hennessy, "Computer Organization and Design", §5.6
// (Interrupts) and Valvano, "Embedded Systems: Real-Time Interfacing", §5.
//
// Given a sequence of events (arrival times in ms), simulate two scheduling
// approaches:
//
// 1) POLLING: CPU runs a loop of fixed period `pollPeriodMs`. Each loop
//    iteration costs `pollCostMs` (cost of the poll itself). When an event
//    has arrived since the last poll, the handler runs immediately at the
//    next poll boundary.
//
// 2) INTERRUPTS: Event arrival triggers immediate handler dispatch after a
//    fixed `interruptLatencyMs` (context-save overhead). No idle CPU work.

export interface PollingConfig {
  pollPeriodMs: number;
  pollCostMs: number;
  handlerCostMs: number;
  /** Total wall time to simulate (ms). */
  simulationDurationMs: number;
}

export interface InterruptConfig {
  interruptLatencyMs: number;
  handlerCostMs: number;
  simulationDurationMs: number;
}

export interface ResponseMetrics {
  latencies: readonly number[];
  meanLatency: number;
  maxLatency: number;
  cpuUtilization: number;
  missedCount: number;
}

function validateEvents(events: readonly number[], duration: number): void {
  for (let i = 0; i < events.length; i++) {
    if (events[i]! < 0) throw new RangeError("event times must be ≥ 0");
    if (i > 0 && events[i]! < events[i - 1]!) {
      throw new RangeError("events must be in non-decreasing order");
    }
  }
  if (duration <= 0) throw new RangeError("simulationDurationMs must be > 0");
}

export function simulatePolling(
  events: readonly number[],
  cfg: PollingConfig,
): ResponseMetrics {
  if (cfg.pollPeriodMs <= 0) {
    throw new RangeError("pollPeriodMs must be > 0");
  }
  if (cfg.pollCostMs < 0 || cfg.handlerCostMs < 0) {
    throw new RangeError("costs must be ≥ 0");
  }
  validateEvents(events, cfg.simulationDurationMs);

  const latencies: number[] = [];
  let cpuBusyMs = 0;
  let missed = 0;
  let evIdx = 0;
  let pollT = 0;
  while (pollT <= cfg.simulationDurationMs) {
    cpuBusyMs += cfg.pollCostMs;
    while (evIdx < events.length && events[evIdx]! <= pollT) {
      const arrivedAt = events[evIdx]!;
      const handlerStart = pollT;
      const latency = handlerStart - arrivedAt;
      if (handlerStart + cfg.handlerCostMs <= cfg.simulationDurationMs) {
        latencies.push(latency);
        cpuBusyMs += cfg.handlerCostMs;
      } else {
        missed++;
      }
      evIdx++;
    }
    pollT += cfg.pollPeriodMs;
  }
  missed += events.length - evIdx;

  const meanLatency =
    latencies.length === 0
      ? 0
      : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency =
    latencies.length === 0 ? 0 : latencies.reduce((a, b) => Math.max(a, b), 0);

  return {
    latencies,
    meanLatency,
    maxLatency,
    cpuUtilization: Math.min(1, cpuBusyMs / cfg.simulationDurationMs),
    missedCount: missed,
  };
}

export function simulateInterrupts(
  events: readonly number[],
  cfg: InterruptConfig,
): ResponseMetrics {
  if (cfg.interruptLatencyMs < 0 || cfg.handlerCostMs < 0) {
    throw new RangeError("interruptLatencyMs and handlerCostMs must be ≥ 0");
  }
  validateEvents(events, cfg.simulationDurationMs);

  const latencies: number[] = [];
  let cpuBusyMs = 0;
  let missed = 0;
  let nextFreeAt = 0;

  for (const ev of events) {
    const dispatch = Math.max(ev, nextFreeAt) + cfg.interruptLatencyMs;
    const finish = dispatch + cfg.handlerCostMs;
    if (finish <= cfg.simulationDurationMs) {
      latencies.push(dispatch - ev);
      cpuBusyMs += cfg.interruptLatencyMs + cfg.handlerCostMs;
      nextFreeAt = finish;
    } else {
      missed++;
    }
  }

  const meanLatency =
    latencies.length === 0
      ? 0
      : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency =
    latencies.length === 0 ? 0 : latencies.reduce((a, b) => Math.max(a, b), 0);

  return {
    latencies,
    meanLatency,
    maxLatency,
    cpuUtilization: Math.min(1, cpuBusyMs / cfg.simulationDurationMs),
    missedCount: missed,
  };
}
