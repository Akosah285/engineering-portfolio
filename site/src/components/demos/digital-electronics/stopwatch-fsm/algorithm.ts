// Stopwatch FSM — Lab 3 datapath behavior.
// Reference: Brown & Vranesic, "Fundamentals of Digital Logic", §8 (Datapath +
// control state machines).
//
// States:
//   - "reset"   — elapsed = 0, not running
//   - "running" — counting up; pressing start/stop pauses
//   - "paused"  — frozen elapsed; start/stop resumes; lap/reset returns to "reset"
//
// Inputs (button presses):
//   - "startStop" — toggles between running and paused (from reset, starts)
//   - "lapReset"  — in running: capture lap; in paused: full reset; in reset: noop

export type StopwatchState = "reset" | "running" | "paused";

export interface StopwatchSnapshot {
  state: StopwatchState;
  elapsed: number;
  laps: readonly number[];
}

interface InternalState {
  state: StopwatchState;
  base: number;
  startedAt: number;
  laps: number[];
}

export function initStopwatch(): InternalState {
  return { state: "reset", base: 0, startedAt: 0, laps: [] };
}

function elapsedAt(s: InternalState, now: number): number {
  if (s.state === "running") {
    return s.base + Math.max(0, now - s.startedAt);
  }
  return s.base;
}

export function snapshot(s: InternalState, now: number): StopwatchSnapshot {
  return {
    state: s.state,
    elapsed: elapsedAt(s, now),
    laps: s.laps.slice(),
  };
}

export function pressStartStop(s: InternalState, now: number): InternalState {
  switch (s.state) {
    case "reset":
      return { state: "running", base: 0, startedAt: now, laps: [] };
    case "running": {
      const next = elapsedAt(s, now);
      return { state: "paused", base: next, startedAt: 0, laps: s.laps.slice() };
    }
    case "paused":
      return { state: "running", base: s.base, startedAt: now, laps: s.laps.slice() };
  }
}

export function pressLapReset(s: InternalState, now: number): InternalState {
  switch (s.state) {
    case "reset":
      return s;
    case "running": {
      const lap = elapsedAt(s, now);
      const laps = s.laps.slice();
      laps.push(lap);
      return { state: "running", base: s.base, startedAt: s.startedAt, laps };
    }
    case "paused":
      return initStopwatch();
  }
}

export interface Event {
  input: "startStop" | "lapReset";
  at: number;
}

export function replay(events: Event[], finalAt?: number): StopwatchSnapshot {
  let s = initStopwatch();
  let lastAt = 0;
  for (const e of events) {
    if (e.at < lastAt) {
      throw new RangeError("replay: events must be in non-decreasing time order");
    }
    lastAt = e.at;
    if (e.input === "startStop") s = pressStartStop(s, e.at);
    else s = pressLapReset(s, e.at);
  }
  return snapshot(s, finalAt ?? lastAt);
}
