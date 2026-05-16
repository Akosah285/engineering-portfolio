import { describe, expect, it } from "vitest";
import { type Sample, compare, simulateDFlipFlop, simulateDLatch } from "../algorithm";

const seq = (input: Array<[number, 0 | 1, 0 | 1]>): Sample[] =>
  input.map(([t, d, ctrl]) => ({ t, d, ctrl }));

describe("simulateDLatch", () => {
  it("empty input returns empty", () => {
    expect(simulateDLatch([])).toEqual([]);
  });

  it("rejects time-out-of-order samples", () => {
    expect(() =>
      simulateDLatch([
        { t: 5, d: 0, ctrl: 1 },
        { t: 3, d: 1, ctrl: 1 },
      ]),
    ).toThrow(RangeError);
  });

  it("when enable=1 throughout, Q follows D (transparent)", () => {
    const s = seq([
      [0, 0, 1],
      [1, 1, 1],
      [2, 0, 1],
      [3, 1, 1],
    ]);
    expect(simulateDLatch(s)).toEqual([0, 1, 0, 1]);
  });

  it("when enable goes LOW, Q holds last value", () => {
    const s = seq([
      [0, 0, 1],
      [1, 1, 1], // Q=1
      [2, 0, 0], // enable LOW: Q stays 1 even though D=0
      [3, 0, 0], // still holding
      [4, 1, 0], // still holding
    ]);
    expect(simulateDLatch(s)).toEqual([0, 1, 1, 1, 1]);
  });

  it("re-enabling makes Q follow D again", () => {
    const s = seq([
      [0, 1, 1], // Q=1
      [1, 0, 0], // hold Q=1
      [2, 0, 1], // re-enabled, Q=D=0
      [3, 1, 1], // Q=1
    ]);
    expect(simulateDLatch(s)).toEqual([1, 1, 0, 1]);
  });
});

describe("simulateDFlipFlop", () => {
  it("empty input returns empty", () => {
    expect(simulateDFlipFlop([])).toEqual([]);
  });

  it("rejects time-out-of-order samples", () => {
    expect(() =>
      simulateDFlipFlop([
        { t: 5, d: 0, ctrl: 0 },
        { t: 3, d: 1, ctrl: 1 },
      ]),
    ).toThrow(RangeError);
  });

  it("first sample Q is 0 (initial), no edge possible", () => {
    const s = seq([[0, 1, 1]]);
    expect(simulateDFlipFlop(s)).toEqual([0]);
  });

  it("Q only updates on rising edge (0->1)", () => {
    const s = seq([
      [0, 1, 0], // low
      [1, 1, 1], // rising edge -> Q=1
      [2, 0, 1], // still high, no edge: hold
      [3, 0, 0], // falling edge: hold
      [4, 0, 1], // rising edge -> Q=0
    ]);
    expect(simulateDFlipFlop(s)).toEqual([0, 1, 1, 1, 0]);
  });

  it("D changes while clk steady are ignored", () => {
    const s = seq([
      [0, 0, 0],
      [1, 0, 1], // rising edge, Q=0
      [2, 1, 1], // D changed but no edge
      [3, 0, 1],
      [4, 1, 1],
    ]);
    expect(simulateDFlipFlop(s)).toEqual([0, 0, 0, 0, 0]);
  });

  it("never goes transparent during high clk (unlike latch)", () => {
    const s = seq([
      [0, 1, 1], // first sample: Q=0
      [1, 0, 1], // still high, no edge: hold 0
      [2, 1, 1], // still high, no edge: hold 0
    ]);
    expect(simulateDFlipFlop(s)).toEqual([0, 0, 0]);
  });
});

describe("compare", () => {
  it("marks divergent samples when latch is transparent but FF holds", () => {
    const s = seq([
      [0, 1, 1], // latch: Q=1 (transparent), FF: Q=0 (no edge yet)
      [1, 0, 1], // latch: Q=0, FF: Q=0 (no edge)
    ]);
    const c = compare(s);
    expect(c[0]!.latch).toBe(1);
    expect(c[0]!.ff).toBe(0);
    expect(c[0]!.divergent).toBe(true);
  });

  it("rising-edge sample agrees (latch transparent, FF samples)", () => {
    const s = seq([
      [0, 0, 0], // both 0
      [1, 1, 1], // rising edge: latch=1 (transparent), FF=1 (sampled D=1)
    ]);
    const c = compare(s);
    expect(c[1]!.latch).toBe(1);
    expect(c[1]!.ff).toBe(1);
    expect(c[1]!.divergent).toBe(false);
  });

  it("returns same length as samples", () => {
    const s = seq([
      [0, 0, 0],
      [1, 1, 1],
      [2, 0, 0],
    ]);
    expect(compare(s).length).toBe(3);
  });
});
