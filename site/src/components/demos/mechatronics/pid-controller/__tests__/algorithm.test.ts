import { describe, expect, it } from "vitest";
import { createPidState, pidStep } from "../algorithm";

describe("pidStep", () => {
  it("P-only: output = Kp * error", () => {
    const r = pidStep({
      setpoint: 10,
      measurement: 7,
      dt: 0.1,
      gains: { kp: 2, ki: 0, kd: 0 },
      state: createPidState(),
    });
    expect(r.output).toBeCloseTo(6, 10);
    expect(r.proportional).toBeCloseTo(6, 10);
  });

  it("I-only: output accumulates over time at rate Ki * error", () => {
    let s = createPidState();
    for (let i = 0; i < 5; i += 1) {
      const r = pidStep({
        setpoint: 10,
        measurement: 8,
        dt: 1,
        gains: { kp: 0, ki: 0.5, kd: 0 },
        state: s,
      });
      s = r.nextState;
    }
    // After 5 seconds with error=2 each, integral=10, output = Ki*10 = 5
    const r = pidStep({
      setpoint: 10,
      measurement: 8,
      dt: 1,
      gains: { kp: 0, ki: 0.5, kd: 0 },
      state: s,
    });
    expect(r.output).toBeCloseTo(6, 10); // 0.5 * (10 + 2*1) = 6
  });

  it("D-only: output proportional to error rate of change", () => {
    // First step has lastError=0; this gives a derivative kick that's
    // expected for D-on-error. Intentionally exercise it.
    const first = pidStep({
      setpoint: 10,
      measurement: 5,
      dt: 0.5,
      gains: { kp: 0, ki: 0, kd: 1 },
      state: createPidState(),
    });
    // d(error)/dt = (5 - 0) / 0.5 = 10
    expect(first.derivative).toBeCloseTo(10, 10);
  });

  it("classic PID combines all three terms correctly", () => {
    const r = pidStep({
      setpoint: 100,
      measurement: 80,
      dt: 0.1,
      gains: { kp: 1, ki: 0.5, kd: 2 },
      state: { integral: 0, lastError: 18 },
    });
    // error = 20; P = 20*1 = 20; I = 0.5 * (0 + 20*0.1) = 1; D = 2*(20-18)/0.1 = 40
    expect(r.output).toBeCloseTo(20 + 1 + 40, 8);
  });

  it("saturates output at outputMax", () => {
    const r = pidStep({
      setpoint: 100,
      measurement: 0,
      dt: 0.1,
      gains: { kp: 10, ki: 0, kd: 0 },
      state: createPidState(),
      outputMax: 50,
    });
    expect(r.output).toBe(50);
  });

  it("saturates output at outputMin", () => {
    const r = pidStep({
      setpoint: -100,
      measurement: 0,
      dt: 0.1,
      gains: { kp: 10, ki: 0, kd: 0 },
      state: createPidState(),
      outputMin: -25,
    });
    expect(r.output).toBe(-25);
  });

  it("anti-windup: integral does not grow while output is saturated", () => {
    let s = createPidState();
    for (let i = 0; i < 10; i += 1) {
      const r = pidStep({
        setpoint: 100,
        measurement: 0,
        dt: 1,
        gains: { kp: 1, ki: 1, kd: 0 },
        state: s,
        outputMin: -10,
        outputMax: 10,
      });
      s = r.nextState;
    }
    // Without anti-windup, integral would be 100*10 = 1000.
    // With anti-windup it should be much smaller.
    expect(s.integral).toBeLessThan(50);
  });

  it("rejects dt <= 0", () => {
    expect(() =>
      pidStep({
        setpoint: 0,
        measurement: 0,
        dt: 0,
        gains: { kp: 1, ki: 0, kd: 0 },
        state: createPidState(),
      }),
    ).toThrow(RangeError);
  });

  it("rejects outputMin > outputMax", () => {
    expect(() =>
      pidStep({
        setpoint: 0,
        measurement: 0,
        dt: 0.1,
        gains: { kp: 1, ki: 0, kd: 0 },
        state: createPidState(),
        outputMin: 10,
        outputMax: 5,
      }),
    ).toThrow(RangeError);
  });

  it("returns the same lastError as the input error (for next-step D term)", () => {
    const r = pidStep({
      setpoint: 10,
      measurement: 7,
      dt: 0.1,
      gains: { kp: 1, ki: 0, kd: 0 },
      state: createPidState(),
    });
    expect(r.nextState.lastError).toBe(3);
  });
});
