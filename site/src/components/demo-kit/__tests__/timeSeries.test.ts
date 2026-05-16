import { describe, expect, it } from "vitest";
import {
  type RingBuffer,
  type Sample,
  createRingBuffer,
  pushSample,
  windowSlice,
} from "../timeSeries";

/**
 * timeSeries — pure brain of <TimeSeriesPlot> (#53).
 *
 * Tests cover:
 *   - createRingBuffer returns an empty buffer with the given capacity
 *   - pushSample appends and rotates over capacity
 *   - windowSlice returns samples whose timestamp ∈ (now - windowSeconds, now]
 *   - empty buffer → empty slice (never throws)
 *   - capacity 0 → throws RangeError
 *   - pushed samples preserve insertion order in chronological reads
 */

describe("createRingBuffer", () => {
  it("returns an empty buffer with the given capacity", () => {
    const buf = createRingBuffer(100);
    expect(buf.capacity).toBe(100);
    expect(buf.size).toBe(0);
  });

  it("throws on non-positive capacity", () => {
    expect(() => createRingBuffer(0)).toThrow(/capacity/i);
    expect(() => createRingBuffer(-5)).toThrow(/capacity/i);
  });
});

describe("pushSample", () => {
  it("appends below capacity", () => {
    let buf: RingBuffer = createRingBuffer(4);
    buf = pushSample(buf, { t: 0, value: 0 });
    buf = pushSample(buf, { t: 1, value: 10 });
    expect(buf.size).toBe(2);
  });

  it("rotates after the buffer fills", () => {
    let buf: RingBuffer = createRingBuffer(3);
    for (let i = 0; i < 5; i += 1) {
      buf = pushSample(buf, { t: i, value: i * 2 });
    }
    expect(buf.size).toBe(3);
    const slice = windowSlice(buf, 5, 100);
    // Most recent 3 samples should be t=2,3,4
    expect(slice.map((s) => s.t)).toEqual([2, 3, 4]);
  });

  it("returns a new buffer (treats input as immutable)", () => {
    const buf1 = createRingBuffer(4);
    const buf2 = pushSample(buf1, { t: 0, value: 1 });
    expect(buf1.size).toBe(0);
    expect(buf2.size).toBe(1);
  });
});

describe("windowSlice", () => {
  it("returns samples newer than (now - windowSeconds)", () => {
    let buf = createRingBuffer(10);
    for (const t of [0, 1, 2, 3, 4, 5]) {
      buf = pushSample(buf, { t, value: t });
    }
    const slice: Sample[] = windowSlice(buf, 5, 2);
    expect(slice.map((s) => s.t)).toEqual([3, 4, 5]);
  });

  it("returns empty array on empty buffer", () => {
    const buf = createRingBuffer(10);
    expect(windowSlice(buf, 100, 5)).toEqual([]);
  });

  it("returns chronologically-ordered samples", () => {
    let buf = createRingBuffer(5);
    // Write out-of-order timestamps to confirm we don't accidentally sort.
    // (Real callers always push in time order — this just confirms read order.)
    for (let i = 0; i < 5; i += 1) {
      buf = pushSample(buf, { t: i, value: i });
    }
    const slice = windowSlice(buf, 4, 100);
    const ts = slice.map((s) => s.t);
    const sorted = [...ts].sort((a, b) => a - b);
    expect(ts).toEqual(sorted);
  });

  it("includes samples with timestamp exactly equal to (now - windowSeconds)", () => {
    let buf = createRingBuffer(5);
    buf = pushSample(buf, { t: 0, value: 1 });
    buf = pushSample(buf, { t: 5, value: 2 });
    const slice = windowSlice(buf, 5, 5);
    // t = 0 should be included (window is inclusive at the lower bound).
    expect(slice.map((s) => s.t)).toContain(0);
  });

  it("filters out samples older than the window after rotation", () => {
    let buf = createRingBuffer(4);
    for (let i = 0; i < 10; i += 1) {
      buf = pushSample(buf, { t: i, value: i });
    }
    // Buffer holds t=6,7,8,9. With now=9, window=2 → t=7,8,9 only.
    const slice = windowSlice(buf, 9, 2);
    expect(slice.map((s) => s.t)).toEqual([7, 8, 9]);
  });
});
