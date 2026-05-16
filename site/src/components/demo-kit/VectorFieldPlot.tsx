import { useEffect, useRef } from "react";
import { type ColorMap, viridis } from "./colorMap";
import { type Arrow, type FieldFn, computeArrows } from "./vectorField";
import "./VectorFieldPlot.css";

/**
 * <VectorFieldPlot> — arrow-grid renderer for 2D vector fields (#54).
 *
 * Pure arrow math + clipping lives in `vectorField.ts` (Vitest-tested);
 * pure colour mapping lives in `colorMap.ts` (Vitest-tested). This shell
 * is only the canvas paint loop.
 *
 * @example
 *   <VectorFieldPlot
 *     width={400}
 *     height={400}
 *     xDomain={[-2, 2]}
 *     yDomain={[-2, 2]}
 *     gridSize={16}
 *     fieldFn={(x, y) => [x, y]}
 *     colorByMagnitude
 *     ariaLabel="Radial vector field"
 *   />
 */

export interface VectorFieldPlotProps {
  readonly width: number;
  readonly height: number;
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly gridSize: number;
  readonly fieldFn: FieldFn;
  /** Cap on raw vector magnitude (handles singularities like 1/r²). */
  readonly maxMagnitude?: number;
  /** Tint each arrow by its magnitude using the supplied colour map. */
  readonly colorByMagnitude?: boolean;
  readonly colorMap?: ColorMap;
  /** Solid colour for arrows when colorByMagnitude is false. */
  readonly arrowColor?: string;
  readonly ariaLabel: string;
}

const DEFAULT_ARROW_COLOR = "#00693e";

export function VectorFieldPlot({
  width,
  height,
  xDomain,
  yDomain,
  gridSize,
  fieldFn,
  maxMagnitude,
  colorByMagnitude = false,
  colorMap = viridis,
  arrowColor = DEFAULT_ARROW_COLOR,
  ariaLabel,
}: VectorFieldPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const arrows = computeArrows({
      xDomain,
      yDomain,
      gridSize,
      fieldFn,
      ...(maxMagnitude !== undefined ? { maxMagnitude } : {}),
    });
    drawArrows(ctx, width, height, arrows, {
      xDomain,
      yDomain,
      colorByMagnitude,
      colorMap,
      arrowColor,
    });
  }, [
    width,
    height,
    xDomain,
    yDomain,
    gridSize,
    fieldFn,
    maxMagnitude,
    colorByMagnitude,
    colorMap,
    arrowColor,
  ]);

  return (
    <div
      className="vector-field-plot"
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}

interface DrawOptions {
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly colorByMagnitude: boolean;
  readonly colorMap: ColorMap;
  readonly arrowColor: string;
}

function drawArrows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  arrows: readonly Arrow[],
  opts: DrawOptions,
): void {
  ctx.clearRect(0, 0, width, height);

  let maxMagnitude = 0;
  if (opts.colorByMagnitude) {
    for (const a of arrows) {
      if (a.magnitudeClipped > maxMagnitude) maxMagnitude = a.magnitudeClipped;
    }
    if (maxMagnitude === 0) maxMagnitude = 1;
  }

  const xSpan = opts.xDomain[1] - opts.xDomain[0];
  const ySpan = opts.yDomain[1] - opts.yDomain[0];
  const xToPx = (x: number) => ((x - opts.xDomain[0]) / xSpan) * width;
  const yToPx = (y: number) => height - ((y - opts.yDomain[0]) / ySpan) * height;

  ctx.lineWidth = 1.5;

  for (const arrow of arrows) {
    const sx = xToPx(arrow.x);
    const sy = yToPx(arrow.y);
    const ex = xToPx(arrow.x + arrow.dx);
    // dy is in domain coords; the canvas y-axis is inverted, so subtract.
    const ey = yToPx(arrow.y + arrow.dy);

    if (opts.colorByMagnitude) {
      const t = arrow.magnitudeClipped / maxMagnitude;
      const [r, g, b] = opts.colorMap(t);
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillStyle = ctx.strokeStyle;
    } else {
      ctx.strokeStyle = opts.arrowColor;
      ctx.fillStyle = opts.arrowColor;
    }

    if (arrow.dx === 0 && arrow.dy === 0) {
      // Degenerate arrow → render a tiny dot so the sample point is still visible.
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    drawArrowhead(ctx, sx, sy, ex, ey);
  }
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): void {
  const angle = Math.atan2(ey - sy, ex - sx);
  const headLength = 6;
  const headAngle = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - headLength * Math.cos(angle - headAngle),
    ey - headLength * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    ex - headLength * Math.cos(angle + headAngle),
    ey - headLength * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}
