import { describe, expect, it } from "vitest";
import { plan } from "../algorithm";

describe("plan — step-position controller", () => {
  it("zero delta → no steps, single event at t=0", () => {
    const r = plan({ currentTicks: 100, targetTicks: 100, maxStepsPerSec: 1000 });
    expect(r.totalSteps).toBe(0);
    expect(r.direction).toBe(0);
    expect(r.events.length).toBe(1);
    expect(r.events[0]!.t).toBe(0);
    expect(r.events[0]!.position).toBe(100);
  });

  it("positive delta → direction = +1, totalSteps = |delta|", () => {
    const r = plan({ currentTicks: 0, targetTicks: 10, maxStepsPerSec: 100 });
    expect(r.direction).toBe(1);
    expect(r.totalSteps).toBe(10);
  });

  it("negative delta → direction = -1", () => {
    const r = plan({ currentTicks: 0, targetTicks: -5, maxStepsPerSec: 100 });
    expect(r.direction).toBe(-1);
    expect(r.totalSteps).toBe(5);
  });

  it("constant rate (no accel): elapsed = N / rate, events evenly spaced", () => {
    const r = plan({ currentTicks: 0, targetTicks: 100, maxStepsPerSec: 1000 });
    expect(r.elapsed).toBeCloseTo(0.1, 10);
    // Check uniform dt
    const dt = r.events[1]!.t - r.events[0]!.t;
    for (let i = 2; i < r.events.length; i += 1) {
      expect(r.events[i]!.t - r.events[i - 1]!.t).toBeCloseTo(dt, 10);
    }
  });

  it("final position equals targetTicks", () => {
    const r = plan({ currentTicks: 0, targetTicks: 50, maxStepsPerSec: 1000 });
    expect(r.events[r.events.length - 1]!.position).toBe(50);
    const r2 = plan({ currentTicks: 100, targetTicks: -25, maxStepsPerSec: 500 });
    expect(r2.events[r2.events.length - 1]!.position).toBe(-25);
  });

  it("event count = totalSteps + 1 (includes initial event at t=0)", () => {
    const r = plan({ currentTicks: 0, targetTicks: 20, maxStepsPerSec: 100 });
    expect(r.events.length).toBe(21);
  });

  it("trapezoidal profile reaches target", () => {
    const r = plan({
      currentTicks: 0,
      targetTicks: 1000,
      maxStepsPerSec: 500,
      accelStepsPerSecSq: 100,
    });
    expect(r.totalSteps).toBe(1000);
    expect(r.events[r.events.length - 1]!.position).toBe(1000);
  });

  it("RangeError on non-integer ticks", () => {
    expect(() =>
      plan({ currentTicks: 0.5, targetTicks: 10, maxStepsPerSec: 100 }),
    ).toThrow(RangeError);
  });

  it("RangeError on maxStepsPerSec <= 0", () => {
    expect(() => plan({ currentTicks: 0, targetTicks: 10, maxStepsPerSec: 0 })).toThrow(
      RangeError,
    );
  });

  it("RangeError on bad accel", () => {
    expect(() =>
      plan({
        currentTicks: 0,
        targetTicks: 10,
        maxStepsPerSec: 100,
        accelStepsPerSecSq: -1,
      }),
    ).toThrow(RangeError);
  });
});
