import { useMemo } from "react";
import { renderMath } from "./renderMath";
import "./MathHud.css";

/**
 * <MathHud> — KaTeX overlay for current demo parameters (plan §3.1, #15).
 *
 * Renders a small corner panel with one or more LaTeX expressions, each
 * KaTeX-rendered. Uses the same `renderMath` helper that powers the
 * <MathExpression> Astro component, so the visual styling matches.
 *
 * Position via the `corner` prop; the panel is absolutely positioned
 * inside its closest positioned ancestor (typically <DemoCanvas>).
 *
 * @example
 *   <MathHud
 *     corner="top-right"
 *     lines={[
 *       `\\eta = ${state.lr}`,
 *       `t = ${state.iter}`,
 *     ]}
 *   />
 */

export type HudCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface MathHudProps {
  /** One LaTeX string per row. */
  lines: string[];
  /** Which corner of the parent positioned box to anchor to. */
  corner?: HudCorner;
  /** Override className for custom positioning. */
  className?: string;
}

export function MathHud({ lines, corner = "top-right", className }: MathHudProps) {
  const rendered = useMemo(
    () =>
      lines.map((latex) => ({
        latex,
        html: renderMath(latex, { display: false }),
      })),
    [lines],
  );

  if (rendered.length === 0) return null;

  const cls = className ?? `math-hud math-hud--${corner}`;

  return (
    <div className={cls} role="group" aria-label="Current parameters">
      {rendered.map(({ latex, html }, index) => (
        <span
          key={`${latex}-${index}`}
          className="math-hud__line"
          // KaTeX HTML is rendered server-side from a trusted whitelist.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </div>
  );
}
