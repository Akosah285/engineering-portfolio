/**
 * Named signal presets for the DFT visualiser.
 *
 * Each preset describes how to synthesise a real-valued signal of length N.
 * The signal generator is kept out of useDemoState — only the preset slug
 * (and N, sampleRate) participate in shareable URL fragment state.
 */

export const SIGNAL_SLUGS = [
  "sinusoid",
  "sum-of-sinusoids",
  "square",
  "noisy-sinusoid",
  "decaying-exp",
] as const;

export type SignalSlug = (typeof SIGNAL_SLUGS)[number];

export interface DftDemoState {
  signalSlug: SignalSlug;
  N: number;
  sampleRate: number;
}

export const DEFAULT_STATE: DftDemoState = {
  signalSlug: "sinusoid",
  N: 64,
  sampleRate: 64,
};

export interface DftPreset {
  name: string;
  state: DftDemoState;
}

export const PRESETS: readonly DftPreset[] = [
  {
    name: "Single sinusoid (k=4)",
    state: { signalSlug: "sinusoid", N: 64, sampleRate: 64 },
  },
  {
    name: "Sum of sinusoids (k=2,8,16)",
    state: { signalSlug: "sum-of-sinusoids", N: 128, sampleRate: 128 },
  },
  {
    name: "Square wave",
    state: { signalSlug: "square", N: 64, sampleRate: 64 },
  },
  {
    name: "Noisy sinusoid (k=5 + noise)",
    state: { signalSlug: "noisy-sinusoid", N: 128, sampleRate: 128 },
  },
  {
    name: "Decaying exponential",
    state: { signalSlug: "decaying-exp", N: 128, sampleRate: 128 },
  },
] as const;

export const SIGNAL_LABELS: Record<SignalSlug, string> = {
  sinusoid: "Single sinusoid (k=4)",
  "sum-of-sinusoids": "Sum of sinusoids (k=2, 8, 16)",
  square: "Square wave",
  "noisy-sinusoid": "Noisy sinusoid (k=5 + noise)",
  "decaying-exp": "Decaying exponential",
};

/** Mulberry32 — small deterministic PRNG for the noisy preset. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve a preset slug to a pure generator (N) => number[]. */
export function getSignalGenerator(slug: SignalSlug): (N: number) => number[] {
  switch (slug) {
    case "sinusoid":
      return (N) => {
        const out = new Array<number>(N);
        for (let n = 0; n < N; n += 1) {
          out[n] = Math.cos((2 * Math.PI * 4 * n) / N);
        }
        return out;
      };
    case "sum-of-sinusoids":
      return (N) => {
        const out = new Array<number>(N);
        for (let n = 0; n < N; n += 1) {
          out[n] =
            Math.cos((2 * Math.PI * 2 * n) / N) +
            0.5 * Math.cos((2 * Math.PI * 8 * n) / N) +
            0.3 * Math.cos((2 * Math.PI * 16 * n) / N);
        }
        return out;
      };
    case "square":
      return (N) => {
        const period = Math.max(2, Math.round(N / 8));
        const out = new Array<number>(N);
        for (let n = 0; n < N; n += 1) {
          out[n] = Math.floor(n / (period / 2)) % 2 === 0 ? 1 : -1;
        }
        return out;
      };
    case "noisy-sinusoid":
      return (N) => {
        const rng = makeRng(42);
        const out = new Array<number>(N);
        for (let n = 0; n < N; n += 1) {
          out[n] = Math.cos((2 * Math.PI * 5 * n) / N) + 0.5 * (2 * rng() - 1);
        }
        return out;
      };
    case "decaying-exp":
      return (N) => {
        const tau = N / 4;
        const out = new Array<number>(N);
        for (let n = 0; n < N; n += 1) {
          out[n] = Math.exp(-n / tau) * Math.cos((2 * Math.PI * 3 * n) / N);
        }
        return out;
      };
  }
}
