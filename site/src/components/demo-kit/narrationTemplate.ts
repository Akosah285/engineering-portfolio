/**
 * Narration template runner for <DemoNarration> (plan §7.3).
 *
 * A demo's narration template is a pure function that turns a state object
 * into a sentence describing what the visualization currently shows. The
 * sentence feeds three places:
 *
 *   1. Live `aria-live="polite"` region for screen-reader users.
 *   2. `<DemoNoScriptFallback>` (build-time render with default state).
 *   3. Pagefind index entry (build-time render with default state).
 *
 * Extracted as a pure function so the narration logic is testable in
 * isolation without rendering React.
 */

export type NarrationTemplate<T> = (state: T) => string;

/**
 * Run a narration template against a state object, return the sentence
 * (trimmed). Returns the empty string for templates that produce
 * whitespace-only output so the live region doesn't announce nothing.
 */
export function renderNarration<T>(
  state: T,
  template: NarrationTemplate<T>,
): string {
  const raw = template(state);
  if (typeof raw !== "string") return "";
  return raw.trim();
}
