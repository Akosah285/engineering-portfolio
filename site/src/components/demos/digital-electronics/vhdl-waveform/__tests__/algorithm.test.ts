import { describe, expect, it } from "vitest";
import {
  type Signals,
  counterTransition,
  projectSignal,
  risingEdges,
  simulate,
} from "../algorithm";

describe("simulate input validation", () => {
  it("rejects non-integer cycles", () => {
    expect(() =>
      simulate({
        clock: { cycles: 1.5 },
        initial: {},
        transition: (p) => p,
      }),
    ).toThrow(RangeError);
  });

  it("rejects negative cycles", () => {
    expect(() =>
      simulate({
        clock: { cycles: -1 },
        initial: {},
        transition: (p) => p,
      }),
    ).toThrow(RangeError);
  });

  it("produces zero frames for 0 cycles", () => {
    const frames = simulate({
      clock: { cycles: 0 },
      initial: {},
      transition: (p) => p,
    });
    expect(frames.length).toBe(0);
  });
});

describe("simulate output shape", () => {
  it("produces 2 half-cycles per cycle", () => {
    const frames = simulate({
      clock: { cycles: 4 },
      initial: { a: 0 },
      transition: (p) => p,
    });
    expect(frames.length).toBe(8);
    for (let i = 0; i < frames.length; i++) {
      expect(frames[i]!.half).toBe(i);
    }
  });

  it("clock alternates low/high (default startHigh=false)", () => {
    const frames = simulate({
      clock: { cycles: 3 },
      initial: {},
      transition: (p) => p,
    });
    expect(frames.map((f) => f.clock)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it("startHigh=true inverts initial clock half", () => {
    const frames = simulate({
      clock: { cycles: 2, startHigh: true },
      initial: {},
      transition: (p) => p,
    });
    expect(frames.map((f) => f.clock)).toEqual([1, 0, 1, 0]);
  });
});

describe("transition fires on rising edge of each cycle", () => {
  it("identity transition holds signals constant", () => {
    const frames = simulate({
      clock: { cycles: 3 },
      initial: { a: 1, b: 0 },
      transition: (p) => p,
    });
    for (const f of frames) {
      expect(f.signals.a).toBe(1);
      expect(f.signals.b).toBe(0);
    }
  });

  it("toggling transition flips signal every cycle", () => {
    const flip = (p: Signals): Signals => ({ a: (1 - (p.a ?? 0)) as 0 | 1 });
    const frames = simulate({
      clock: { cycles: 3 },
      initial: { a: 0 },
      transition: flip,
    });
    expect(frames.map((f) => f.signals.a)).toEqual([0, 1, 1, 0, 0, 1]);
  });
});

describe("counterTransition", () => {
  it("rejects invalid width", () => {
    expect(() => counterTransition(0)).toThrow(RangeError);
    expect(() => counterTransition(-1)).toThrow(RangeError);
    expect(() => counterTransition(17)).toThrow(RangeError);
    expect(() => counterTransition(1.5)).toThrow(RangeError);
  });

  it("2-bit counter cycles 0,1,2,3,0,...", () => {
    const t = counterTransition(2);
    const init: Signals = { q0: 0, q1: 0 };
    const frames = simulate({
      clock: { cycles: 5 },
      initial: init,
      transition: t,
    });
    const post = frames.filter((_, i) => i % 2 === 1);
    const values = post.map((f) => ((f.signals.q1 ?? 0) << 1) | (f.signals.q0 ?? 0));
    expect(values).toEqual([1, 2, 3, 0, 1]);
  });

  it("4-bit counter wraps at 15->0", () => {
    const t = counterTransition(4);
    const init: Signals = { q0: 1, q1: 1, q2: 1, q3: 1 };
    const frames = simulate({
      clock: { cycles: 2 },
      initial: init,
      transition: t,
    });
    const f = frames[1]!;
    const value =
      ((f.signals.q3 ?? 0) << 3) |
      ((f.signals.q2 ?? 0) << 2) |
      ((f.signals.q1 ?? 0) << 1) |
      (f.signals.q0 ?? 0);
    expect(value).toBe(0);
  });
});

describe("projectSignal + risingEdges", () => {
  it("projectSignal extracts named signal across frames", () => {
    const t = counterTransition(2);
    const frames = simulate({
      clock: { cycles: 4 },
      initial: { q0: 0, q1: 0 },
      transition: t,
    });
    expect(projectSignal(frames, "q0").length).toBe(frames.length);
  });

  it("risingEdges finds 0->1 transitions", () => {
    const t = counterTransition(1);
    const frames = simulate({
      clock: { cycles: 4 },
      initial: { q0: 0 },
      transition: t,
    });
    const edges = risingEdges(frames, "q0");
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]).toBe(1);
  });

  it("projectSignal returns 0 for missing keys", () => {
    const frames = simulate({
      clock: { cycles: 2 },
      initial: { a: 1 },
      transition: (p) => p,
    });
    expect(projectSignal(frames, "missing")).toEqual([0, 0, 0, 0]);
  });
});
