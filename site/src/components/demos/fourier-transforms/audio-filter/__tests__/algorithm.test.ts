import { describe, expect, it } from "vitest";
import {
  initState,
  magnitudeResponse,
  makeBiquad,
  processBuffer,
  processSample,
} from "../algorithm";

describe("makeBiquad input validation", () => {
  it("rejects non-positive sample rate", () => {
    expect(() => makeBiquad("lowpass", 100, 0, 0.707)).toThrow(RangeError);
    expect(() => makeBiquad("lowpass", 100, -1, 0.707)).toThrow(RangeError);
  });

  it("rejects cutoff at or above Nyquist", () => {
    expect(() => makeBiquad("lowpass", 24000, 48000, 0.707)).toThrow(RangeError);
    expect(() => makeBiquad("lowpass", 30000, 48000, 0.707)).toThrow(RangeError);
  });

  it("rejects cutoff at or below 0", () => {
    expect(() => makeBiquad("lowpass", 0, 48000, 0.707)).toThrow(RangeError);
    expect(() => makeBiquad("lowpass", -100, 48000, 0.707)).toThrow(RangeError);
  });

  it("rejects non-positive Q", () => {
    expect(() => makeBiquad("lowpass", 1000, 48000, 0)).toThrow(RangeError);
    expect(() => makeBiquad("lowpass", 1000, 48000, -1)).toThrow(RangeError);
  });
});

describe("lowpass magnitude response", () => {
  const sr = 48000;
  const fc = 1000;
  const Q = 1 / Math.sqrt(2); // Butterworth
  const c = makeBiquad("lowpass", fc, sr, Q);

  it("is ≈1 at DC", () => {
    expect(magnitudeResponse(c, 0, sr)).toBeCloseTo(1, 3);
  });

  it("is ≈0.707 (-3 dB) at cutoff for Butterworth Q", () => {
    expect(magnitudeResponse(c, fc, sr)).toBeCloseTo(1 / Math.sqrt(2), 2);
  });

  it("is ≪1 well above cutoff", () => {
    expect(magnitudeResponse(c, 10000, sr)).toBeLessThan(0.05);
  });
});

describe("highpass magnitude response", () => {
  const sr = 48000;
  const fc = 1000;
  const Q = 1 / Math.sqrt(2);
  const c = makeBiquad("highpass", fc, sr, Q);

  it("is ≈0 at DC", () => {
    expect(magnitudeResponse(c, 0, sr)).toBeLessThan(0.01);
  });

  it("is ≈1 at Nyquist/2 (well above cutoff)", () => {
    expect(magnitudeResponse(c, sr / 4, sr)).toBeGreaterThan(0.95);
  });
});

describe("notch", () => {
  const sr = 48000;
  const fc = 1000;
  const c = makeBiquad("notch", fc, sr, 10);

  it("kills the notch frequency", () => {
    expect(magnitudeResponse(c, fc, sr)).toBeLessThan(0.01);
  });

  it("passes far-away frequencies", () => {
    expect(magnitudeResponse(c, 10000, sr)).toBeGreaterThan(0.9);
  });
});

describe("bandpass", () => {
  const sr = 48000;
  const fc = 1000;
  const c = makeBiquad("bandpass", fc, sr, 5);

  it("peaks at the center frequency", () => {
    const center = magnitudeResponse(c, fc, sr);
    const above = magnitudeResponse(c, fc * 3, sr);
    const below = magnitudeResponse(c, fc / 5, sr);
    expect(center).toBeGreaterThan(above);
    expect(center).toBeGreaterThan(below);
  });
});

describe("processBuffer", () => {
  it("preserves length", () => {
    const c = makeBiquad("lowpass", 1000, 48000, 0.707);
    const out = processBuffer(c, [0, 1, 0, -1, 0, 1, 0, -1]);
    expect(out.length).toBe(8);
  });

  it("lowpasses an impulse to a bounded, eventually-decaying response", () => {
    const c = makeBiquad("lowpass", 1000, 48000, 0.707);
    const impulse = new Array<number>(2048).fill(0);
    impulse[0] = 1;
    const h = processBuffer(c, impulse);
    expect(h[0]!).toBeGreaterThanOrEqual(0);
    // Find peak magnitude; tail magnitude should be much smaller (stable IIR).
    let peak = 0;
    for (let i = 0; i < h.length; i++) peak = Math.max(peak, Math.abs(h[i]!));
    expect(peak).toBeLessThan(1);
    expect(Math.abs(h[h.length - 1]!)).toBeLessThan(peak * 0.01);
  });

  it("lowpass attenuates a 10 kHz tone below DC", () => {
    const sr = 48000;
    const c = makeBiquad("lowpass", 500, sr, 0.707);
    const N = 2048;
    const f = 10000;
    const x = new Array<number>(N);
    for (let n = 0; n < N; n++) x[n] = Math.sin((2 * Math.PI * f * n) / sr);
    const y = processBuffer(c, x);
    let rmsIn = 0;
    let rmsOut = 0;
    for (let n = 1024; n < N; n++) {
      rmsIn += x[n]! * x[n]!;
      rmsOut += y[n]! * y[n]!;
    }
    rmsIn = Math.sqrt(rmsIn / 1024);
    rmsOut = Math.sqrt(rmsOut / 1024);
    expect(rmsOut / rmsIn).toBeLessThan(0.05);
  });
});

describe("processSample state update", () => {
  it("initState returns zeros", () => {
    const s = initState();
    expect(s).toEqual({ x1: 0, x2: 0, y1: 0, y2: 0 });
  });

  it("processSample updates state slots", () => {
    const c = makeBiquad("lowpass", 1000, 48000, 0.707);
    const s = initState();
    processSample(c, s, 1);
    expect(s.x1).toBe(1);
    expect(s.x2).toBe(0);
    processSample(c, s, 0.5);
    expect(s.x1).toBe(0.5);
    expect(s.x2).toBe(1);
  });
});

describe("magnitudeResponse validation", () => {
  it("rejects negative freq", () => {
    const c = makeBiquad("lowpass", 1000, 48000, 0.707);
    expect(() => magnitudeResponse(c, -1, 48000)).toThrow(RangeError);
  });

  it("rejects freq above Nyquist", () => {
    const c = makeBiquad("lowpass", 1000, 48000, 0.707);
    expect(() => magnitudeResponse(c, 30000, 48000)).toThrow(RangeError);
  });
});
