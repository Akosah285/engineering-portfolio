/**
 * Touch-gesture helpers for the <FavoritePage> lightbox.
 *
 * Swipe-down dismissal is a mobile UX convention (Twitter, Instagram, etc.):
 * a quick downward drag closes the modal. We accept a swipe as "downward
 * dismiss" only when it has enough distance, was fast enough, and had enough
 * velocity — to avoid accidental dismissals from slow scroll-like drags.
 */

export interface TouchPoint {
  /** Y coordinate in pixels (typically pageY or clientY). */
  y: number;
  /** Timestamp in ms (typically Date.now() or performance.now()). */
  t: number;
}

export interface SwipeDismissOptions {
  /** Minimum vertical distance in pixels. Default: 80. */
  minDistance?: number;
  /** Maximum total duration in ms (faster swipes feel more decisive). Default: 600. */
  maxDuration?: number;
  /** Minimum velocity in px/ms. Default: 0.2. */
  minVelocity?: number;
}

/**
 * Should we dismiss the lightbox based on this touch swipe?
 *
 * Returns true only when the gesture is a deliberate downward flick:
 *   - travelled at least `minDistance` pixels DOWN
 *   - completed within `maxDuration` ms
 *   - average velocity at least `minVelocity` px/ms
 *
 * Sideways swipes, upward swipes, and slow drags all return false.
 */
export function shouldDismissOnSwipeDown(
  start: TouchPoint,
  end: TouchPoint,
  options: SwipeDismissOptions = {},
): boolean {
  const minDistance = options.minDistance ?? 80;
  const maxDuration = options.maxDuration ?? 600;
  const minVelocity = options.minVelocity ?? 0.2;

  const dy = end.y - start.y;
  const dt = end.t - start.t;

  if (dt <= 0) return false;
  if (dy < minDistance) return false;
  if (dt > maxDuration) return false;
  if (dy / dt < minVelocity) return false;

  return true;
}
