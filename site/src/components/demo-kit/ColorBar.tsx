import { useEffect, useRef } from "react";
import {
  computeColorBarTicks,
  type ColorMap,
} from "./colorMap";
import "./ColorBar.css";

/**
 * <ColorBar> — heatmap legend (#55).
 *
 * Renders a colour gradient via canvas + tick labels via CSS for sharpness.
 * Pure colour-map and tick math lives in `colorMap.ts` (Vitest-tested) — this
 * shell is only the React glue.
 */

export type Orientation = "vertical" | "horizontal";

export interface ColorBarProps {
  readonly min: number;
  readonly max: number;
  readonly colorMap: ColorMap;
  readonly orientation?: Orientation;
  readonly label?: string;
  readonly tickCount?: number;
  /** Pixel size of the gradient strip (long axis). */
  readonly length?: number;
  /** Pixel thickness of the gradient strip (short axis). */
  readonly thickness?: number;
  /** Accessible label describing what the colour bar represents. */
  readonly ariaLabel: string;
}

const DEFAULT_LENGTH = 200;
const DEFAULT_THICKNESS = 20;
const DEFAULT_TICK_COUNT = 5;

export function ColorBar({
  min,
  max,
  colorMap,
  orientation = "vertical",
  label,
  tickCount = DEFAULT_TICK_COUNT,
  length = DEFAULT_LENGTH,
  thickness = DEFAULT_THICKNESS,
  ariaLabel,
}: ColorBarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ticks = computeColorBarTicks(min, max, tickCount);

  const isVertical = orientation === "vertical";
  const width = isVertical ? thickness : length;
  const height = isVertical ? length : thickness;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGradient(ctx, width, height, colorMap, isVertical);
  }, [width, height, colorMap, isVertical]);

  return (
    <div
      className={`color-bar color-bar--${orientation}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="color-bar__canvas-wrap"
        style={{ width, height }}
      >
        <canvas ref={canvasRef} width={width} height={height} />
      </div>
      <div
        className="color-bar__ticks"
        style={isVertical ? { height } : { width }}
        aria-hidden="true"
      >
        {ticks.map((tick) => (
          <span
            key={tick.value}
            className="color-bar__tick"
            style={
              isVertical
                ? { top: `${(1 - tick.normalized) * 100}%` }
                : { left: `${tick.normalized * 100}%` }
            }
          >
            {tick.label}
          </span>
        ))}
      </div>
      {label ? (
        <div className="color-bar__label">{label}</div>
      ) : null}
    </div>
  );
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorMap: ColorMap,
  isVertical: boolean,
): void {
  ctx.clearRect(0, 0, width, height);
  const length = isVertical ? height : width;
  for (let i = 0; i < length; i += 1) {
    // Vertical bars run min at bottom, max at top (chart convention).
    const t = isVertical ? 1 - i / Math.max(1, length - 1) : i / Math.max(1, length - 1);
    const [r, g, b] = colorMap(t);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    if (isVertical) {
      ctx.fillRect(0, i, width, 1);
    } else {
      ctx.fillRect(i, 0, 1, height);
    }
  }
}
