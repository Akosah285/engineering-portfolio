import { describe, expect, it } from "vitest";

import {
  bit,
  load,
  makeCounter,
  reset,
  tick,
  tickDown,
  trace,
} from "../algorithm";

describe("makeCounter / load / reset", () => {
  it("makes a counter with the given width and initial 0", () => {
    const c = makeCounter(4);
    expect(c.bits).toBe(4);
    expect(c.count).toBe(0);
  });

  it("makes a counter with a non-zero initial", () => {
    const c = makeCounter(4, 7);
    expect(c.count).toBe(7);
  });

  it("RangeError on bad widths or initial values", () => {
    expect(() => makeCounter(0)).toThrow(RangeError);
    expect(() => makeCounter(33)).toThrow(RangeError);
    expect(() => makeCounter(4, 16)).toThrow(RangeError);
    expect(() => makeCounter(4, -1)).toThrow(RangeError);
  });

  it("reset returns count 0 with the same width", () => {
    expect(reset(makeCounter(4, 9))).toEqual({ count: 0, bits: 4 });
  });

  it("load sets the count, error on out-of-range", () => {
    expect(load(makeCounter(4), 9)).toEqual({ count: 9, bits: 4 });
    expect(() => load(makeCounter(4), 16)).toThrow(RangeError);
  });
});

describe("tick — up direction", () => {
  it("increments by one, no carry on normal tick", () => {
    const r = tick(makeCounter(4, 5));
    expect(r.state.count).toBe(6);
    expect(r.carry).toBe(false);
  });

  it("wraps to 0 with carry=true at 2^bits - 1", () => {
    const r = tick(makeCounter(4, 15));
    expect(r.state.count).toBe(0);
    expect(r.carry).toBe(true);
  });
});

describe("tickDown — down direction", () => {
  it("decrements by one, no borrow on normal tick", () => {
    const r = tickDown(makeCounter(4, 5));
    expect(r.state.count).toBe(4);
    expect(r.carry).toBe(false);
  });

  it("wraps to 2^bits-1 with borrow=true at 0", () => {
    const r = tickDown(makeCounter(4, 0));
    expect(r.state.count).toBe(15);
    expect(r.carry).toBe(true);
  });
});

describe("bit", () => {
  it("returns LSB at index 0 and MSB at index bits-1", () => {
    const c = makeCounter(4, 0b1010);
    expect(bit(c, 0)).toBe(0);
    expect(bit(c, 1)).toBe(1);
    expect(bit(c, 2)).toBe(0);
    expect(bit(c, 3)).toBe(1);
  });

  it("RangeError on out-of-range bit indices", () => {
    expect(() => bit(makeCounter(4), 4)).toThrow(RangeError);
    expect(() => bit(makeCounter(4), -1)).toThrow(RangeError);
  });
});

describe("trace", () => {
  it("returns nTicks+1 frames including the initial state", () => {
    const t = trace({ bits: 3, nTicks: 5 });
    expect(t.length).toBe(6);
    expect(t[0]!.count).toBe(0);
    expect(t[5]!.count).toBe(5);
  });

  it("produces a carry only when wrapping back to 0 (up direction)", () => {
    const t = trace({ bits: 3, nTicks: 16, initial: 0 });
    // At t=8 the count returns to 0 (after 8 ticks of an 8-state counter).
    expect(t[7]!.count).toBe(7);
    expect(t[8]!.count).toBe(0);
    expect(t[8]!.carry).toBe(true);
  });

  it("respects 'down' direction with borrow at 0→max", () => {
    const t = trace({ bits: 3, nTicks: 3, initial: 1, direction: "down" });
    expect(t[0]!.count).toBe(1);
    expect(t[1]!.count).toBe(0);
    expect(t[1]!.carry).toBe(false);
    expect(t[2]!.count).toBe(7);
    expect(t[2]!.carry).toBe(true);
    expect(t[3]!.count).toBe(6);
  });

  it("each frame's bits LSB toggles every tick (signature of binary counters)", () => {
    const t = trace({ bits: 4, nTicks: 8 });
    for (let i = 0; i < t.length; i += 1) {
      expect(t[i]!.bits[0]!).toBe((i % 2) as 0 | 1);
    }
  });

  it("RangeError on negative nTicks", () => {
    expect(() => trace({ bits: 3, nTicks: -1 })).toThrow(RangeError);
  });
});
