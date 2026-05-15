/**
 * colorMap — pure brain of <ColorBar> (#55).
 *
 * Provides:
 *   - `computeColorBarTicks`: pick `n` "nice" tick values across a range
 *   - `viridis`: perceptually-uniform sequential colormap (matplotlib default)
 *   - `rdbu`: red-blue diverging colormap (good for signed quantities)
 *
 * Both colormaps clamp `t` to [0, 1] and return `[r, g, b]` integers in
 * [0, 255]. The control-point lookups use 11 anchors and linear interpolation
 * — accurate enough for legend rendering, fast enough to call per-pixel.
 */

const ZERO_WIDTH_EPSILON = 1e-9;

export interface ColorBarTick {
  readonly value: number;
  readonly normalized: number;
  readonly label: string;
}

export type ColorTuple = readonly [number, number, number];
export type ColorMap = (t: number) => ColorTuple;

export function computeColorBarTicks(
  rawMin: number,
  rawMax: number,
  count: number,
): ColorBarTick[] {
  let [min, max] = rawMin <= rawMax ? [rawMin, rawMax] : [rawMax, rawMin];
  if (max - min < ZERO_WIDTH_EPSILON) {
    const halfSpan = Math.max(Math.abs(min) * 1e-6, ZERO_WIDTH_EPSILON);
    min -= halfSpan;
    max += halfSpan;
  }

  const step = pickNiceStep(max - min, count);
  const start = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    values.push(roundToStep(v, step));
  }

  // Pin endpoints so the legend always reads min..max.
  if (values.length === 0 || Math.abs(values[0]! - min) > step * 1e-9) {
    values.unshift(min);
  }
  if (Math.abs(values[values.length - 1]! - max) > step * 1e-9) {
    values.push(max);
  }

  const span = max - min;
  return values.map((value) => ({
    value,
    normalized: span === 0 ? 0.5 : (value - min) / span,
    label: formatColorBarValue(value),
  }));
}

function pickNiceStep(span: number, count: number): number {
  if (span <= 0) return ZERO_WIDTH_EPSILON;
  const rough = span / Math.max(1, count - 1);
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const norm = rough / base;
  let multiple: number;
  if (norm < 1.5) multiple = 1;
  else if (norm < 3.5) multiple = 2;
  else if (norm < 7.5) multiple = 5;
  else multiple = 10;
  return multiple * base;
}

function roundToStep(value: number, step: number): number {
  const sig = Math.max(1, Math.ceil(-Math.log10(step)) + 1);
  return Number(value.toFixed(sig));
}

function formatColorBarValue(value: number): string {
  if (value === 0 || Object.is(value, -0)) return "0";
  if (Number.isInteger(value) && Math.abs(value) < 1e6) return String(value);
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e6) return value.toExponential(2);
  return Number(value.toPrecision(3)).toString();
}

// ─── viridis (matplotlib default, perceptually uniform) ─────────────────────

const VIRIDIS_ANCHORS: ColorTuple[] = [
  [68, 1, 84],
  [72, 35, 116],
  [64, 67, 135],
  [52, 94, 141],
  [41, 120, 142],
  [32, 144, 140],
  [34, 167, 132],
  [68, 190, 112],
  [121, 209, 81],
  [189, 222, 38],
  [253, 231, 36],
];

const RDBU_ANCHORS: ColorTuple[] = [
  [103, 0, 31],
  [178, 24, 43],
  [214, 96, 77],
  [244, 165, 130],
  [253, 219, 199],
  [247, 247, 247],
  [209, 229, 240],
  [146, 197, 222],
  [67, 147, 195],
  [33, 102, 172],
  [5, 48, 97],
];

export const viridis: ColorMap = (t) => sampleAnchors(VIRIDIS_ANCHORS, t);
export const rdbu: ColorMap = (t) => sampleAnchors(RDBU_ANCHORS, t);

function sampleAnchors(anchors: ColorTuple[], t: number): ColorTuple {
  const clamped = Math.max(0, Math.min(1, t));
  const lastIndex = anchors.length - 1;
  const scaled = clamped * lastIndex;
  const i = Math.floor(scaled);
  const f = scaled - i;
  if (i >= lastIndex) return anchors[lastIndex]!;
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}
