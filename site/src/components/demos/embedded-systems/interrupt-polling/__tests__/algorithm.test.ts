import { describe, expect, it } from "vitest";
import { simulateInterrupts, simulatePolling } from "../algorithm";

describe("input validation", () => {
  it("polling rejects pollPeriod ≤ 0", () => {
    expect(() =>
      simulatePolling([], {
        pollPeriodMs: 0,
        pollCostMs: 0.1,
        handlerCostMs: 1,
        simulationDurationMs: 100,
      }),
    ).toThrow(RangeError);
  });

  it("polling rejects negative costs", () => {
    expect(() =>
      simulatePolling([], {
        pollPeriodMs: 10,
        pollCostMs: -1,
        handlerCostMs: 1,
        simulationDurationMs: 100,
      }),
    ).toThrow(RangeError);
  });

  it("interrupts rejects negative latency", () => {
    expect(() =>
      simulateInterrupts([], {
        interruptLatencyMs: -1,
        handlerCostMs: 1,
        simulationDurationMs: 100,
      }),
    ).toThrow(RangeError);
  });

  it("rejects negative event times", () => {
    expect(() =>
      simulatePolling([-1], {
        pollPeriodMs: 10,
        pollCostMs: 0,
        handlerCostMs: 1,
        simulationDurationMs: 100,
      }),
    ).toThrow(RangeError);
  });

  it("rejects out-of-order events", () => {
    expect(() =>
      simulateInterrupts([5, 3], {
        interruptLatencyMs: 0,
        handlerCostMs: 1,
        simulationDurationMs: 100,
      }),
    ).toThrow(RangeError);
  });

  it("rejects non-positive simulation duration", () => {
    expect(() =>
      simulatePolling([], {
        pollPeriodMs: 10,
        pollCostMs: 0,
        handlerCostMs: 1,
        simulationDurationMs: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("polling behavior", () => {
  it("event between polls waits until the next poll boundary", () => {
    const m = simulatePolling([3], {
      pollPeriodMs: 10,
      pollCostMs: 0,
      handlerCostMs: 1,
      simulationDurationMs: 100,
    });
    expect(m.latencies).toEqual([7]);
    expect(m.maxLatency).toBe(7);
    expect(m.missedCount).toBe(0);
  });

  it("event aligned with poll boundary has zero latency", () => {
    const m = simulatePolling([10], {
      pollPeriodMs: 10,
      pollCostMs: 0,
      handlerCostMs: 1,
      simulationDurationMs: 100,
    });
    expect(m.latencies[0]).toBe(0);
  });

  it("max polling latency cannot exceed the polling period", () => {
    const events = [1, 2, 3, 11, 12, 13, 21];
    const m = simulatePolling(events, {
      pollPeriodMs: 10,
      pollCostMs: 0,
      handlerCostMs: 0.1,
      simulationDurationMs: 1000,
    });
    expect(m.maxLatency).toBeLessThanOrEqual(10);
  });

  it("cpuUtilization scales with poll cost even with no events", () => {
    const m = simulatePolling([], {
      pollPeriodMs: 1,
      pollCostMs: 0.5,
      handlerCostMs: 0,
      simulationDurationMs: 100,
    });
    expect(m.cpuUtilization).toBeGreaterThan(0.4);
  });
});

describe("interrupt behavior", () => {
  it("immediate dispatch (zero latency config) gives 0-latency response", () => {
    const m = simulateInterrupts([5, 50, 95], {
      interruptLatencyMs: 0,
      handlerCostMs: 1,
      simulationDurationMs: 100,
    });
    expect(m.latencies).toEqual([0, 0, 0]);
  });

  it("constant interrupt overhead adds to every response", () => {
    const m = simulateInterrupts([5, 50, 80], {
      interruptLatencyMs: 0.3,
      handlerCostMs: 1,
      simulationDurationMs: 100,
    });
    expect(m.latencies.length).toBe(3);
    for (const l of m.latencies) {
      expect(l).toBeCloseTo(0.3, 10);
    }
  });

  it("back-to-back events queue (non-preemptive)", () => {
    const m = simulateInterrupts([0, 0], {
      interruptLatencyMs: 0,
      handlerCostMs: 5,
      simulationDurationMs: 100,
    });
    expect(m.latencies[0]).toBe(0);
    expect(m.latencies[1]).toBe(5);
  });

  it("events arriving after simulation window are missed", () => {
    const m = simulateInterrupts([50, 99], {
      interruptLatencyMs: 0,
      handlerCostMs: 5,
      simulationDurationMs: 100,
    });
    expect(m.missedCount).toBe(1);
    expect(m.latencies.length).toBe(1);
  });
});

describe("interrupts beat polling for sparse events", () => {
  it("interrupts have lower mean latency than fast-polling for sparse events", () => {
    const events = [10, 100, 250, 500, 750];
    const poll = simulatePolling(events, {
      pollPeriodMs: 50,
      pollCostMs: 0.1,
      handlerCostMs: 1,
      simulationDurationMs: 1000,
    });
    const intr = simulateInterrupts(events, {
      interruptLatencyMs: 0.5,
      handlerCostMs: 1,
      simulationDurationMs: 1000,
    });
    expect(intr.meanLatency).toBeLessThan(poll.meanLatency);
  });

  it("interrupts have lower idle utilization than busy polling", () => {
    const poll = simulatePolling([100, 500], {
      pollPeriodMs: 1,
      pollCostMs: 0.05,
      handlerCostMs: 1,
      simulationDurationMs: 1000,
    });
    const intr = simulateInterrupts([100, 500], {
      interruptLatencyMs: 0.2,
      handlerCostMs: 1,
      simulationDurationMs: 1000,
    });
    expect(intr.cpuUtilization).toBeLessThan(poll.cpuUtilization);
  });
});

describe("metrics shape", () => {
  it("returns 0 mean/max with no events handled", () => {
    const m = simulateInterrupts([], {
      interruptLatencyMs: 0.5,
      handlerCostMs: 1,
      simulationDurationMs: 100,
    });
    expect(m.meanLatency).toBe(0);
    expect(m.maxLatency).toBe(0);
    expect(m.cpuUtilization).toBe(0);
  });
});
