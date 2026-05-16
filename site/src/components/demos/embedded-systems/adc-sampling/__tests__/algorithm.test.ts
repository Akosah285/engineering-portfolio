import { describe, expect, it } from "vitest";

import { aliasedFrequency, lsb, quantize, sampleSine, willAlias } from "../algorithm";

describe("sampleSine", () => {
  it("samples 0 at t=0 when phase=0", () => {
    const s = sampleSine({ amplitude: 1, frequency: 1, sampleRate: 100, nSamples: 1 });
    expect(s[0]!.value).toBeCloseTo(0, 12);
  });

  it("steps by 1/fs in t", () => {
    const s = sampleSine({ amplitude: 1, frequency: 1, sampleRate: 4, nSamples: 5 });
    expect(s[0]!.t).toBeCloseTo(0, 12);
    expect(s[1]!.t).toBeCloseTo(0.25, 12);
    expect(s[4]!.t).toBeCloseTo(1, 12);
  });

  it("amplitude scales the signal", () => {
    const s = sampleSine({
      amplitude: 5,
      frequency: 1,
      phase: Math.PI / 2,
      sampleRate: 100,
      nSamples: 1,
    });
    expect(s[0]!.value).toBeCloseTo(5, 12);
  });

  it("RangeError on bad sampleRate / nSamples / frequency / amplitude", () => {
    expect(() =>
      sampleSine({ amplitude: 1, frequency: 1, sampleRate: 0, nSamples: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      sampleSine({ amplitude: 1, frequency: 1, sampleRate: 100, nSamples: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      sampleSine({ amplitude: 1, frequency: Number.NaN, sampleRate: 100, nSamples: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      sampleSine({ amplitude: -1, frequency: 1, sampleRate: 100, nSamples: 10 }),
    ).toThrow(RangeError);
  });
});

describe("aliasedFrequency / willAlias", () => {
  it("aliasing of 110 Hz at fs=100 folds to 10 Hz", () => {
    expect(aliasedFrequency(110, 100)).toBeCloseTo(10, 12);
  });

  it("aliasing of 90 Hz at fs=100 stays at 10 Hz (below Nyquist)", () => {
    // 90 Hz is above Nyquist of 50 Hz; fold to 100-90 = 10 Hz
    expect(aliasedFrequency(90, 100)).toBeCloseTo(10, 12);
  });

  it("a signal exactly at Nyquist (fs/2) reports fs/2", () => {
    expect(aliasedFrequency(50, 100)).toBeCloseTo(50, 12);
  });

  it("DC stays at 0 for any sample rate", () => {
    expect(aliasedFrequency(0, 1000)).toBeCloseTo(0, 12);
  });

  it("willAlias returns true above Nyquist", () => {
    expect(willAlias(60, 100)).toBe(true);
    expect(willAlias(40, 100)).toBe(false);
  });

  it("RangeError on fs<=0", () => {
    expect(() => aliasedFrequency(10, 0)).toThrow(RangeError);
    expect(() => willAlias(10, 0)).toThrow(RangeError);
  });
});

describe("quantize", () => {
  it("8-bit ADC over [0, 5]V has LSB ≈ 19.53 mV", () => {
    expect(lsb(8, 5)).toBeCloseTo(5 / 256, 12);
  });

  it("quantizes within ±LSB/2 of the true value", () => {
    const v = quantize({ bits: 8, vMin: 0, vMax: 5, value: 2.5 });
    const step = 5 / 256;
    expect(Math.abs(v - 2.5)).toBeLessThanOrEqual(step / 2 + 1e-12);
  });

  it("clips below vMin to the minimum representable level", () => {
    const v = quantize({ bits: 4, vMin: 0, vMax: 1, value: -10 });
    expect(v).toBeCloseTo(0, 12);
  });

  it("clips above vMax to the maximum representable level (vMax - LSB)", () => {
    const v = quantize({ bits: 4, vMin: 0, vMax: 1, value: 10 });
    expect(v).toBeCloseTo(15 / 16, 12);
  });

  it("RangeError on bad bits / vRange / value", () => {
    expect(() => quantize({ bits: 0, vMin: 0, vMax: 1, value: 0 })).toThrow(RangeError);
    expect(() => quantize({ bits: 25, vMin: 0, vMax: 1, value: 0 })).toThrow(RangeError);
    expect(() => quantize({ bits: 8, vMin: 1, vMax: 1, value: 0 })).toThrow(RangeError);
    expect(() => quantize({ bits: 8, vMin: 0, vMax: 1, value: Number.NaN })).toThrow(
      RangeError,
    );
  });

  it("RangeError from lsb() on bad inputs", () => {
    expect(() => lsb(0, 1)).toThrow(RangeError);
    expect(() => lsb(8, 0)).toThrow(RangeError);
  });
});
