/**
 * plotPanel — pure-function brain of the <PlotPanel> primitive (#52).
 *
 * The component itself is a thin React shell that calls into these helpers
 * to compute axis ticks + normalized positions, then strokes the canvas. By
 * keeping `computeAxisLayout` and `formatTickValue` pure, the trickiest bits
 * of the chart (linear vs log spacing, edge cases like zero-width domains)
 * stay testable in isolation without spinning up JSDOM.
 */

const ZERO_WIDTH_EPSILON = 1e-9;
const DEFAULT_TICK_COUNT = 5;

export interface AxisTick {
  /** The numeric value at this tick. */
  readonly value: number;
  /** Position along the axis in [0, 1] from min to max. */
  readonly normalized: number;
  /** Pre-formatted label string ready to paint. */
  readonly label: string;
}

export interface AxisLayout {
  readonly min: number;
  readonly max: number;
  readonly logScale: boolean;
  readonly ticks: readonly AxisTick[];
}

export interface AxisLayoutOptions {
  readonly min: number;
  readonly max: number;
  readonly logScale: boolean;
  /** Hint for tick density. Honoured loosely; nice numbers win. */
  readonly tickCount?: number;
}

/**
 * Compute axis ticks + normalized positions for a 1D axis.
 *
 * Linear mode: picks "nice" tick values (1, 2, 5 × 10^k) covering [min, max],
 * then pins the first/last ticks to the requested bounds so the visible axis
 * runs end-to-end.
 *
 * Log mode: emits powers of ten within [min, max]. Throws when min ≤ 0.
 *
 * Degenerate domains (zero-width or inverted) are auto-corrected so callers
 * don't have to special-case them.
 */
export function computeAxisLayout(opts: AxisLayoutOptions): AxisLayout {
  const { logScale } = opts;

  if (logScale) {
    if (opts.min <= 0 || opts.max <= 0) {
      throw new RangeError("computeAxisLayout: log scale requires positive min and max.");
    }
    return buildLogAxis(opts);
  }

  return buildLinearAxis(opts);
}

function buildLinearAxis(opts: AxisLayoutOptions): AxisLayout {
  let { min, max } = opts;
  if (max < min) [min, max] = [max, min];
  if (max - min < ZERO_WIDTH_EPSILON) {
    const halfSpan = Math.max(Math.abs(min) * 1e-6, ZERO_WIDTH_EPSILON);
    min -= halfSpan;
    max += halfSpan;
  }

  const tickCount = opts.tickCount ?? DEFAULT_TICK_COUNT;
  const niceStep = pickNiceStep(max - min, tickCount);
  const span = max - min;

  const niceTicks: number[] = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let v = start; v <= max + niceStep * 1e-9; v += niceStep) {
    niceTicks.push(roundToStep(v, niceStep));
  }

  const values =
    niceTicks.length === 0 ? [min, max] : pinEndpoints(niceTicks, min, max, niceStep);

  return {
    min,
    max,
    logScale: false,
    ticks: values.map((value) => ({
      value,
      normalized: span === 0 ? 0.5 : (value - min) / span,
      label: formatTickValue(value),
    })),
  };
}

function buildLogAxis(opts: AxisLayoutOptions): AxisLayout {
  const { min, max } = opts;
  const lo = Math.floor(Math.log10(min) - 1e-12);
  const hi = Math.ceil(Math.log10(max) + 1e-12);
  const logSpan = Math.log10(max) - Math.log10(min);

  const values: number[] = [];
  for (let exp = lo; exp <= hi; exp += 1) {
    const v = 10 ** exp;
    if (v < min - min * 1e-9) continue;
    if (v > max + max * 1e-9) continue;
    values.push(roundExp(v, exp));
  }

  return {
    min,
    max,
    logScale: true,
    ticks: values.map((value) => ({
      value,
      normalized: logSpan === 0 ? 0.5 : (Math.log10(value) - Math.log10(min)) / logSpan,
      label: formatTickValue(value),
    })),
  };
}

function pinEndpoints(ticks: number[], min: number, max: number, step: number): number[] {
  const out = [...ticks];
  const first = out[0];
  if (first !== undefined && Math.abs(first - min) > step * 1e-9) {
    out.unshift(min);
  }
  const last = out[out.length - 1];
  if (last !== undefined && Math.abs(last - max) > step * 1e-9) {
    out.push(max);
  }
  return out;
}

function pickNiceStep(span: number, tickCount: number): number {
  if (span <= 0) return ZERO_WIDTH_EPSILON;
  const rough = span / Math.max(1, tickCount - 1);
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
  // Avoids floating-point drift like 0.30000000000000004
  const sig = Math.max(1, Math.ceil(-Math.log10(step)) + 1);
  return Number(value.toFixed(sig));
}

function roundExp(value: number, exp: number): number {
  // 10^-2 should be exactly 0.01, not 0.010000000000000002.
  if (exp >= 0) return Math.round(value);
  return Number(value.toFixed(-exp));
}

/**
 * Format a tick value for display. Integer values stay integers; floats use
 * 3 significant figures; magnitudes outside [1e-3, 1e6) use scientific
 * notation.
 */
export function formatTickValue(value: number): string {
  if (value === 0 || Object.is(value, -0)) return "0";
  if (Number.isInteger(value) && Math.abs(value) < 1e6) {
    return String(value);
  }
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e6) {
    return value.toExponential(2);
  }
  // 3 significant figures, then strip trailing zeros.
  const formatted = value.toPrecision(3);
  return Number(formatted).toString();
}
