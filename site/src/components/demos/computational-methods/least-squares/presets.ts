/**
 * Named presets + deterministic dataset generator for the Least Squares
 * visualiser (#84). Lookup-table pattern because `useDemoState` cannot
 * store arrays or objects — only the slug lives in shareable state.
 */

export const PRESET_SLUGS = [
  "linear",
  "noisy",
  "outlier",
  "constant-ish",
  "wide-spread",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export interface PresetMeta {
  readonly label: string;
  readonly trueSlope: number;
  readonly trueIntercept: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly baseNoise: number;
  readonly outliers?: ReadonlyArray<{ readonly index: number; readonly offset: number }>;
}

export const PRESET_META: Record<PresetSlug, PresetMeta> = {
  linear: {
    label: "Linear",
    trueSlope: 1.5,
    trueIntercept: 0.5,
    xMin: 0,
    xMax: 10,
    baseNoise: 0.3,
  },
  noisy: {
    label: "Noisy",
    trueSlope: 0.8,
    trueIntercept: 1.0,
    xMin: 0,
    xMax: 10,
    baseNoise: 1.2,
  },
  outlier: {
    label: "Outlier",
    trueSlope: 1.0,
    trueIntercept: 0,
    xMin: 0,
    xMax: 10,
    baseNoise: 0.25,
    outliers: [
      { index: 5, offset: 6 },
      { index: 12, offset: -5 },
      { index: 19, offset: 5.5 },
    ],
  },
  "constant-ish": {
    label: "Constant-ish",
    trueSlope: 0.05,
    trueIntercept: 3,
    xMin: 0,
    xMax: 10,
    baseNoise: 0.5,
  },
  "wide-spread": {
    label: "Wide spread",
    trueSlope: 2.0,
    trueIntercept: -1,
    xMin: -5,
    xMax: 15,
    baseNoise: 0.6,
  },
};

export interface LeastSquaresDemoState {
  presetSlug: PresetSlug;
  noise: number;
  n: number;
}

export const DEFAULT_STATE: LeastSquaresDemoState = {
  presetSlug: "linear",
  noise: 0.3,
  n: 24,
};

export interface LeastSquaresPreset {
  name: string;
  state: LeastSquaresDemoState;
}

export const PRESETS: readonly LeastSquaresPreset[] = PRESET_SLUGS.map((slug) => {
  const meta = PRESET_META[slug];
  return {
    name: meta.label,
    state: {
      presetSlug: slug,
      noise: meta.baseNoise,
      n: DEFAULT_STATE.n,
    },
  };
});

/** mulberry32 — tiny seedable PRNG, deterministic across platforms. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform — standard-normal samples from uniform RNG. */
function gaussian(rng: () => number): number {
  let u = rng();
  let v = rng();
  if (u < 1e-12) u = 1e-12;
  if (v < 1e-12) v = 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Dataset {
  readonly xs: ReadonlyArray<number>;
  readonly ys: ReadonlyArray<number>;
}

const FIXED_SEED = 42;

/**
 * Build a deterministic (xs, ys) dataset for the given preset, total noise
 * scale, and point count. Seed is fixed so identical inputs always produce
 * identical output, which is the property the visualiser depends on for
 * reproducible R² values.
 */
export function generateDataset(slug: PresetSlug, noise: number, n: number): Dataset {
  const meta = PRESET_META[slug];
  const rng = mulberry32(FIXED_SEED);
  const span = meta.xMax - meta.xMin;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n <= 1 ? 0 : i / (n - 1);
    const x = meta.xMin + t * span;
    const y = meta.trueSlope * x + meta.trueIntercept + noise * gaussian(rng);
    xs.push(x);
    ys.push(y);
  }
  if (meta.outliers) {
    for (const o of meta.outliers) {
      if (o.index >= 0 && o.index < n) {
        ys[o.index] = ys[o.index]! + o.offset;
      }
    }
  }
  return { xs, ys };
}
