import { describe, expect, it } from "vitest";
import {
  initStopwatch,
  pressLapReset,
  pressStartStop,
  replay,
  snapshot,
} from "../algorithm";

describe("initial state", () => {
  it("is reset with 0 elapsed and no laps", () => {
    const s = initStopwatch();
    const snap = snapshot(s, 0);
    expect(snap.state).toBe("reset");
    expect(snap.elapsed).toBe(0);
    expect(snap.laps).toEqual([]);
  });
});

describe("startStop transitions", () => {
  it("reset -> running on first press", () => {
    const s = pressStartStop(initStopwatch(), 1000);
    expect(snapshot(s, 1000).state).toBe("running");
  });

  it("running -> paused freezes elapsed", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressStartStop(s, 5000);
    expect(snapshot(s, 5000).state).toBe("paused");
    expect(snapshot(s, 5000).elapsed).toBe(5000);
    expect(snapshot(s, 10000).elapsed).toBe(5000);
  });

  it("paused -> running resumes from previous elapsed", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressStartStop(s, 5000);
    s = pressStartStop(s, 8000);
    expect(snapshot(s, 10000).elapsed).toBe(5000 + 2000);
  });
});

describe("lapReset transitions", () => {
  it("from reset, lapReset is a no-op", () => {
    const s = pressLapReset(initStopwatch(), 1000);
    const snap = snapshot(s, 1000);
    expect(snap.state).toBe("reset");
    expect(snap.elapsed).toBe(0);
    expect(snap.laps).toEqual([]);
  });

  it("from running, lapReset captures lap without stopping", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressLapReset(s, 3000);
    const snap = snapshot(s, 3000);
    expect(snap.state).toBe("running");
    expect(snap.laps).toEqual([3000]);
  });

  it("from running, multiple laps accumulate in order", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressLapReset(s, 1000);
    s = pressLapReset(s, 2500);
    s = pressLapReset(s, 4000);
    expect(snapshot(s, 4000).laps).toEqual([1000, 2500, 4000]);
  });

  it("from paused, lapReset clears everything to reset state", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressLapReset(s, 1000);
    s = pressStartStop(s, 3000);
    s = pressLapReset(s, 5000);
    const snap = snapshot(s, 5000);
    expect(snap.state).toBe("reset");
    expect(snap.elapsed).toBe(0);
    expect(snap.laps).toEqual([]);
  });
});

describe("elapsed accumulation across pause/resume cycles", () => {
  it("does not lose time when pausing and resuming repeatedly", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressStartStop(s, 1000);
    s = pressStartStop(s, 5000);
    s = pressStartStop(s, 7000);
    expect(snapshot(s, 10000).elapsed).toBe(3000);
  });
});

describe("replay", () => {
  it("rejects out-of-order events", () => {
    expect(() =>
      replay([
        { input: "startStop", at: 5 },
        { input: "startStop", at: 1 },
      ]),
    ).toThrow(RangeError);
  });

  it("matches step-by-step result", () => {
    const snap = replay(
      [
        { input: "startStop", at: 0 },
        { input: "lapReset", at: 1000 },
        { input: "lapReset", at: 2500 },
        { input: "startStop", at: 3000 },
      ],
      3000,
    );
    expect(snap.state).toBe("paused");
    expect(snap.elapsed).toBe(3000);
    expect(snap.laps).toEqual([1000, 2500]);
  });

  it("uses finalAt for elapsed (post-event sampling)", () => {
    const snap = replay([{ input: "startStop", at: 0 }], 5000);
    expect(snap.state).toBe("running");
    expect(snap.elapsed).toBe(5000);
  });
});

describe("snapshot immutability", () => {
  it("returned laps is a copy (push doesn't affect internal state)", () => {
    let s = pressStartStop(initStopwatch(), 0);
    s = pressLapReset(s, 1000);
    const snap = snapshot(s, 1000);
    (snap.laps as number[]).push(9999);
    expect(snapshot(s, 1000).laps).toEqual([1000]);
  });
});
