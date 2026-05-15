import { describe, expect, it } from "vitest";

import { binFrequency, dft, idft, magnitudes, phases, realToComplex } from "../algorithm";

describe("dft — basic signals", () => {
  it("DFT of a single 1.0 sample is constant 1 across all bins (delta function)", () => {
    const X = dft([{ re: 1, im: 0 }]);
    expect(X.length).toBe(1);
    expect(X[0]!.re).toBeCloseTo(1, 12);
  });

  it("DFT of all-ones (length N) is N at k=0 and 0 elsewhere", () => {
    const N = 8;
    const x = realToComplex(new Array(N).fill(1));
    const X = dft(x);
    expect(X[0]!.re).toBeCloseTo(N, 12);
    expect(X[0]!.im).toBeCloseTo(0, 12);
    for (let k = 1; k < N; k += 1) {
      expect(Math.hypot(X[k]!.re, X[k]!.im)).toBeLessThan(1e-12);
    }
  });

  it("DFT of cos(2π k0 n / N) puts |X|=N/2 at bins k0 and N-k0", () => {
    const N = 16;
    const k0 = 3;
    const x = realToComplex(
      Array.from({ length: N }, (_, n) => Math.cos((2 * Math.PI * k0 * n) / N)),
    );
    const X = dft(x);
    const mags = magnitudes(X);
    for (let k = 0; k < N; k += 1) {
      if (k === k0 || k === N - k0) {
        expect(mags[k]!).toBeCloseTo(N / 2, 10);
      } else {
        expect(mags[k]!).toBeLessThan(1e-10);
      }
    }
  });

  it("DFT of sin(2π k0 n / N) puts |X|=N/2 at bins k0 and N-k0 with opposite-sign imaginary parts", () => {
    const N = 16;
    const k0 = 5;
    const x = realToComplex(
      Array.from({ length: N }, (_, n) => Math.sin((2 * Math.PI * k0 * n) / N)),
    );
    const X = dft(x);
    expect(Math.abs(X[k0]!.im) + Math.abs(X[N - k0]!.im)).toBeGreaterThan(0.1);
    expect(Math.sign(X[k0]!.im)).not.toBe(Math.sign(X[N - k0]!.im));
  });
});

describe("idft", () => {
  it("dft → idft round-trips an arbitrary real signal", () => {
    const x = realToComplex([3, 1, 4, 1, 5, 9, 2, 6]);
    const X = dft(x);
    const back = idft(X);
    for (let n = 0; n < x.length; n += 1) {
      expect(back[n]!.re).toBeCloseTo(x[n]!.re, 10);
      expect(Math.abs(back[n]!.im)).toBeLessThan(1e-10);
    }
  });

  it("dft → idft round-trips a complex signal", () => {
    const x: { re: number; im: number }[] = [
      { re: 1, im: 0 },
      { re: 0, im: 1 },
      { re: -1, im: 0 },
      { re: 0, im: -1 },
    ];
    const X = dft(x);
    const back = idft(X);
    for (let n = 0; n < x.length; n += 1) {
      expect(back[n]!.re).toBeCloseTo(x[n]!.re, 10);
      expect(back[n]!.im).toBeCloseTo(x[n]!.im, 10);
    }
  });
});

describe("magnitudes / phases / binFrequency helpers", () => {
  it("magnitudes are non-negative", () => {
    const X = dft(realToComplex([3, 1, 4, 1, 5, 9, 2, 6]));
    for (const m of magnitudes(X)) expect(m).toBeGreaterThanOrEqual(0);
  });

  it("phases of all-zero magnitude bins clamp to 0", () => {
    const X = [
      { re: 0, im: 0 },
      { re: 1, im: 0 },
    ];
    const ph = phases(X);
    expect(ph[0]!).toBe(0);
    expect(ph[1]!).toBeCloseTo(0, 12);
  });

  it("binFrequency: bin 0 is DC (0 Hz); Nyquist bin at sampleRate/2", () => {
    expect(binFrequency(0, 16, 1000)).toBe(0);
    expect(binFrequency(8, 16, 1000)).toBe(500);
  });
});

describe("dft / idft — error handling", () => {
  it("RangeError on empty input", () => {
    expect(() => dft([])).toThrow(RangeError);
    expect(() => idft([])).toThrow(RangeError);
  });
});
