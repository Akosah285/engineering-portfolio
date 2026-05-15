import { useEffect, useState } from "react";
import { renderNarration, type NarrationTemplate } from "./narrationTemplate";
import "./DemoNarration.css";

/**
 * <DemoNarration> — aria-live transcript text (plan §7.3, #15).
 *
 * Wraps a parameterised sentence template in an `aria-live="polite"` region
 * so screen-reader users hear a meaningful sentence whenever the demo state
 * changes. Visible by default for sighted users too — the same sentence
 * doubles as caption text under canvas-only visuals.
 *
 * The same `template` function is exported by every demo so it can also
 * feed:
 *   - <DemoNoScriptFallback> (build-time render with default state)
 *   - Pagefind index entry (plan §7.14)
 *
 * @example
 *   <DemoNarration
 *     state={state}
 *     template={(s) => `Learning rate η = ${s.lr}, ${s.iter} steps so far`}
 *   />
 */

export interface DemoNarrationProps<T> {
  state: T;
  template: NarrationTemplate<T>;
  /** Override the default visible className. */
  className?: string;
  /** Render visibly (default) or visually-hidden but still announced. */
  visuallyHidden?: boolean;
}

export function DemoNarration<T>({
  state,
  template,
  className,
  visuallyHidden = false,
}: DemoNarrationProps<T>) {
  const [text, setText] = useState(() => renderNarration(state, template));

  useEffect(() => {
    setText(renderNarration(state, template));
  }, [state, template]);

  const base = visuallyHidden ? "demo-narration--sr-only" : "demo-narration";
  const cls = className ?? base;

  return (
    <p
      className={cls}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </p>
  );
}
