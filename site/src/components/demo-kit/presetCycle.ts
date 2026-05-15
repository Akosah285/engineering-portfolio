/**
 * Pure helpers for <PresetCarousel>.
 *
 * Cycling logic kept pure so the component itself is a thin display layer
 * over a TDD-verified core.
 */

/**
 * Compute the next preset index when the user clicks "Prev" or "Next".
 *
 * Wraps around at both ends so the carousel feels continuous (clicking
 * Next on the last preset returns to the first).
 *
 * @param current   The currently-selected index.
 * @param total     Total number of presets.
 * @param direction "prev" or "next".
 * @returns         The new index. If `total` is 0 or the current index
 *                  is out of range, returns 0.
 */
export function cyclePresetIndex(
  current: number,
  total: number,
  direction: "prev" | "next",
): number {
  if (total <= 0) return 0;
  if (!Number.isInteger(current) || current < 0 || current >= total) {
    return 0;
  }
  if (direction === "next") {
    return (current + 1) % total;
  }
  // prev: wrap to last when at 0
  return (current - 1 + total) % total;
}
