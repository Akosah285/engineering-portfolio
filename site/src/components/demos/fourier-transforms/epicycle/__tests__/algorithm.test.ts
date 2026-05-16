import { describe, expect, it } from "vitest";
import {
  buildEpicycles,
  cAbs,
  cAdd,
  cExp,
  cMul,
  dft,
  epicycleChain,
  samplePath,
  type Complex,
} from "../algorithm";

describe("complex primitives", () => {
  it("cAdd is commutative", () => {
    const a: Complex = { re: 1, im: 2 };
    const b: Complex = { re: 3, im: -1 };
    expect(cAdd(a, b)).toEqual(cAdd(b, a));
  });

  it("cMul matches (1+i)(1-i) = 2", () => {
    const z = cMul({ re: 1, im: 1 }, { re: 1, im: -1 });
    expect(z.re).toBeCloseTo(2, 12);
    expect(z.im).toBeCloseTo(0, 12);
  });

  it("cExp(0) = 1+0i", () => {
    const z = cExp(0);
    expect(z.re).toBeCloseTo(1, 12);
    expect(z.im).toBeCloseTo(0, 12);
  });

  it("|cExp(theta)| = 1", () => {
    for (const t of [0.1, 1, 2, -3, 7]) {
      expect(cAbs(cExp(t))).toBeCloseTo(1, 12);
    }
  });
});

describe("dft", () => {
  it("rejects empty input", () => {
    expect(() => dft([])).toThrow(RangeError);
  });

  it("DC signal maps to bin 0 only", () => {
    const N = 8;
    const samples: Complex[] = Array.from({ length: N }, () => ({ re: 1, im: 0 }));
    const coeffs = dft(samples);
    expect(coeffs[0]!.re).toBeCloseTo(1, 10);
    expect(coeffs[0]!.im).toBeCloseTo(0, 10);
    for (let k = 1; k < N; k++) {
      expect(cAbs(coeffs[k]!)).toBeCloseTo(0, 10);
    }
  });

  it("pure exp(i 2π n/N) lives in bin k=1", () => {
    const N = 16;
    const samples = samplePath((t) => cExp(2 * Math.PI * t), N);
    const coeffs = dft(samples);
    expect(cAbs(coeffs[1]!)).toBeCloseTo(1, 10);
    for (let k = 0; k < N; k++) {
      if (k !== 1) expect(cAbs(coeffs[k]!)).toBeCloseTo(0, 10);
    }
  });

  it("normalization: sum of |coeffs|^2 stays bounded for unit DC", () => {
    const N = 8;
    const samples: Complex[] = Array.from({ length: N }, () => ({ re: 1, im: 0 }));
    const coeffs = dft(samples);
    const energy = coeffs.reduce((acc, c) => acc + cAbs(c) ** 2, 0);
    expect(energy).toBeCloseTo(1, 10);
  });
});

describe("buildEpicycles", () => {
  it("rejects empty input", () => {
    expect(() => buildEpicycles([])).toThrow(RangeError);
  });

  it("maps even-length bins to symmetric frequencies", () => {
    const coeffs: Complex[] = [
      { re: 0, im: 0 },
      { re: 1, im: 0 },
      { re: 0, im: 0 },
      { re: 1, im: 0 },
    ];
    const eps = buildEpicycles(coeffs);
    const freqs = eps.map((e) => e.freq).sort((a, b) => a - b);
    expect(freqs).toEqual([-1, 0, 1, 2]);
  });

  it("sorts by descending amplitude", () => {
    const coeffs: Complex[] = [
      { re: 0.1, im: 0 },
      { re: 2, im: 0 },
      { re: 0.5, im: 0 },
      { re: 1, im: 0 },
    ];
    const eps = buildEpicycles(coeffs);
    const amps = eps.map((e) => e.amp);
    for (let i = 1; i < amps.length; i++) {
      expect(amps[i - 1]!).toBeGreaterThanOrEqual(amps[i]!);
    }
  });
});

describe("epicycleChain", () => {
  it("rejects empty epicycles", () => {
    expect(() => epicycleChain([], 0)).toThrow(RangeError);
  });

  it("rejects numTerms out of range", () => {
    const eps = buildEpicycles([{ re: 1, im: 0 }]);
    expect(() => epicycleChain(eps, 0, -1)).toThrow(RangeError);
    expect(() => epicycleChain(eps, 0, 999)).toThrow(RangeError);
  });

  it("reconstructs a unit circle from a 1-term epicycle (k=1)", () => {
    const N = 32;
    const samples = samplePath((t) => cExp(2 * Math.PI * t), N);
    const coeffs = dft(samples);
    const eps = buildEpicycles(coeffs);
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const { tip } = epicycleChain(eps, t);
      const expected = cExp(2 * Math.PI * t);
      expect(tip.re).toBeCloseTo(expected.re, 8);
      expect(tip.im).toBeCloseTo(expected.im, 8);
    }
  });

  it("chain length = numTerms + 1 (includes origin)", () => {
    const eps = buildEpicycles([
      { re: 1, im: 0 },
      { re: 0.5, im: 0 },
      { re: 0.25, im: 0 },
    ]);
    const { points } = epicycleChain(eps, 0.1, 2);
    expect(points.length).toBe(3);
  });

  it("first point is always origin", () => {
    const eps = buildEpicycles([{ re: 1, im: 2 }]);
    const { points } = epicycleChain(eps, 0.5);
    expect(points[0]!.re).toBe(0);
    expect(points[0]!.im).toBe(0);
  });
});

describe("samplePath", () => {
  it("rejects non-positive N", () => {
    expect(() => samplePath((t) => ({ re: t, im: 0 }), 0)).toThrow(RangeError);
    expect(() => samplePath((t) => ({ re: t, im: 0 }), 1.5)).toThrow(RangeError);
  });

  it("samples N points starting at t=0", () => {
    const samples = samplePath((t) => ({ re: t, im: 0 }), 4);
    expect(samples.length).toBe(4);
    expect(samples[0]!.re).toBe(0);
    expect(samples[2]!.re).toBeCloseTo(0.5, 12);
  });
});
