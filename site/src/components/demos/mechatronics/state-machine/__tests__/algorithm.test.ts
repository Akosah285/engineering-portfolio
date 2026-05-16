import { describe, expect, it } from "vitest";
import { isTerminal, run, transition } from "../algorithm";

describe("transition — decision_making.ino", () => {
  it("SEARCHING + wall_detected_left → WALL_FOLLOWING", () => {
    expect(transition("SEARCHING", "wall_detected_left")).toBe("WALL_FOLLOWING");
  });

  it("SEARCHING + wall_detected_front → TURNING", () => {
    expect(transition("SEARCHING", "wall_detected_front")).toBe("TURNING");
  });

  it("WALL_FOLLOWING + wall_lost_left → TURNING (corner detected)", () => {
    expect(transition("WALL_FOLLOWING", "wall_lost_left")).toBe("TURNING");
  });

  it("WALL_FOLLOWING + wall_detected_front → TURNING (dead end)", () => {
    expect(transition("WALL_FOLLOWING", "wall_detected_front")).toBe("TURNING");
  });

  it("TURNING + tick → WALL_FOLLOWING (turn timer expired)", () => {
    expect(transition("TURNING", "tick")).toBe("WALL_FOLLOWING");
  });

  it("TURNING + intersection → SEARCHING", () => {
    expect(transition("TURNING", "intersection")).toBe("SEARCHING");
  });

  it("goal_reached forces DONE from any state", () => {
    expect(transition("SEARCHING", "goal_reached")).toBe("DONE");
    expect(transition("WALL_FOLLOWING", "goal_reached")).toBe("DONE");
    expect(transition("TURNING", "goal_reached")).toBe("DONE");
  });

  it("DONE is sticky — never leaves", () => {
    expect(transition("DONE", "tick")).toBe("DONE");
    expect(transition("DONE", "wall_detected_front")).toBe("DONE");
    expect(transition("DONE", "intersection")).toBe("DONE");
  });

  it("idle inputs hold state", () => {
    expect(transition("SEARCHING", "tick")).toBe("SEARCHING");
    expect(transition("WALL_FOLLOWING", "tick")).toBe("WALL_FOLLOWING");
  });
});

describe("run — trace through sequence", () => {
  it("empty input → trace just has initial state", () => {
    const r = run("SEARCHING", []);
    expect(r.states).toEqual(["SEARCHING"]);
    expect(r.finalState).toBe("SEARCHING");
  });

  it("typical maze run reaches DONE", () => {
    const r = run("SEARCHING", [
      "wall_detected_left",
      "tick",
      "tick",
      "wall_lost_left",
      "tick",
      "intersection",
      "wall_detected_left",
      "goal_reached",
    ]);
    expect(r.finalState).toBe("DONE");
  });

  it("trace length = inputs.length + 1", () => {
    const r = run("SEARCHING", ["tick", "tick", "tick"]);
    expect(r.states.length).toBe(4);
  });

  it("invalid initial throws RangeError", () => {
    expect(() => run("BOGUS" as never, [])).toThrow(RangeError);
  });
});

describe("isTerminal", () => {
  it("only DONE is terminal", () => {
    expect(isTerminal("DONE")).toBe(true);
    expect(isTerminal("SEARCHING")).toBe(false);
    expect(isTerminal("WALL_FOLLOWING")).toBe(false);
    expect(isTerminal("TURNING")).toBe(false);
  });
});
