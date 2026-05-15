/**
 * Number formatting helpers for <SliderRow> (#15).
 *
 * Extracted so we can unit-test rounding/clamping behaviour without
 * mounting a slider in JSDOM.
 */

/**
 * Round `value` to the nearest multiple of `step`, then clamp to [min, max].
 * Used by <SliderRow> when consumers feed in an arbitrary externally-set
 * value (e.g., from URL fragment state restoration). Native range inputs
 * snap automatically when the user drags, but programmatic sets do not.
 */
export function clampToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  if (!Number.isFinite(value)) return min;
  if (min > max) throw new Error("clampToStep: min must be <= max");
  if (step <= 0 || !Number.isFinite(step)) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
  const snapped = Math.round((value - min) / step) * step + min;
  if (snapped < min) return min;
  if (snapped > max) return max;
  // Guard against floating-point drift (e.g., 0.1 + 0.2)
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  if (decimals > 0 && Number.isFinite(decimals)) {
    return Number(snapped.toFixed(Math.min(decimals + 2, 20)));
  }
  return snapped;
}

export interface FormatOptions {
  precision?: number;
  unit?: string;
}

/**
 * Format `value` for display next to the slider thumb. Adds a fixed-
 * precision suffix when `precision` is provided, and appends a unit
 * (with a non-breaking space) when `unit` is provided. Falls back to a
 * sensible auto-precision based on absolute magnitude when `precision`
 * is omitted.
 */
export function formatSliderValue(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return "—";

  const { precision, unit } = options;
  let display: string;
  if (typeof precision === "number" && Number.isFinite(precision)) {
    display = value.toFixed(Math.max(0, Math.floor(precision)));
  } else {
    const abs = Math.abs(value);
    if (abs >= 100 || abs === 0) display = value.toFixed(0);
    else if (abs >= 10) display = value.toFixed(1);
    else if (abs >= 1) display = value.toFixed(2);
    else display = value.toFixed(3);
  }
  if (unit) return `${display}\u00a0${unit}`;
  return display;
}
