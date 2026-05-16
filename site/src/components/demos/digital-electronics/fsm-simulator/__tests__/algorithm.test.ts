import { describe, it, expect } from "vitest";
import { run, stopwatchFSM, type FSMSpec } from "../algorithm";

describe("run — generic FSM stepping", () => {
  it("empty input → finalState = initial, empty trace", () => {
    const r = run(stopwatchFSM, []);
    expect(r.finalState).toBe("IDLE");
    expect(r.trace.length).toBe(0);
  });

  it("walks state transitions per spec", () => {
    const r = run(stopwatchFSM, ["start", "tick", "tick", "pause", "resume", "reset"]);
    expect(r.trace[0]!.from).toBe("IDLE");
    expect(r.trace[0]!.to).toBe("RUNNING");
    expect(r.trace[3]!.from).toBe("RUNNING");
    expect(r.trace[3]!.to).toBe("PAUSED");
    expect(r.trace[4]!.to).toBe("RUNNING");
    expect(r.trace[5]!.to).toBe("IDLE");
    expect(r.finalState).toBe("IDLE");
  });

  it("Moore outputs depend on next state only", () => {
    const r = run(stopwatchFSM, ["start", "pause"]);
    expect(r.trace[0]!.output).toBe("ticking");
    expect(r.trace[1]!.output).toBe("paused");
  });

  it("invalid input throws RangeError", () => {
    expect(() => run(stopwatchFSM, ["bogus" as never])).toThrow(RangeError);
  });

  it("invalid initial throws RangeError", () => {
    const bad: FSMSpec<"A" | "B", "x", string> = {
      states: ["A", "B"],
      inputs: ["x"],
      initial: "C" as never,
      transition: () => "A",
    };
    expect(() => run(bad, ["x"])).toThrow(RangeError);
  });

  it("Mealy variant: output depends on (state, input)", () => {
    type S = "S0" | "S1";
    type I = "0" | "1";
    const detect11: FSMSpec<S, I, number> = {
      states: ["S0", "S1"],
      inputs: ["0", "1"],
      initial: "S0",
      transition: (s, i) => {
        if (s === "S0" && i === "1") return "S1";
        if (s === "S1" && i === "1") return "S1";
        return "S0";
      },
      outputs: {
        kind: "mealy",
        out: (s, i) => (s === "S1" && i === "1" ? 1 : 0),
      },
    };
    const r = run(detect11, ["1", "1", "0", "1", "1"]);
    // Sequence: S0-1->S1 (out 0), S1-1->S1 (out 1), S1-0->S0 (out 0),
    //           S0-1->S1 (out 0), S1-1->S1 (out 1)
    expect(r.trace.map((t) => t.output)).toEqual([0, 1, 0, 0, 1]);
  });
});

describe("stopwatchFSM preset", () => {
  it("can't pause from IDLE", () => {
    const r = run(stopwatchFSM, ["pause"]);
    expect(r.finalState).toBe("IDLE");
  });

  it("can't resume from IDLE", () => {
    const r = run(stopwatchFSM, ["resume"]);
    expect(r.finalState).toBe("IDLE");
  });

  it("reset works from any state", () => {
    expect(run(stopwatchFSM, ["start", "reset"]).finalState).toBe("IDLE");
    expect(run(stopwatchFSM, ["start", "pause", "reset"]).finalState).toBe("IDLE");
  });

  it("tick from IDLE stays IDLE (stopwatch only counts when RUNNING)", () => {
    expect(run(stopwatchFSM, ["tick", "tick"]).finalState).toBe("IDLE");
  });
});
