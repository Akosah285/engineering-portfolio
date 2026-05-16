import { useEffect, useRef } from "react";
import { type AxisLayout, computeAxisLayout } from "./plotMath";
import "./PlotPanel.css";

/**
 * <PlotPanel> — axis-aware 2D plot for the demo-kit (#52).
 *
 * Renders series to a `<canvas>` (sharp lines, low memory cost) and overlays
 * tick labels in CSS so they stay crisp at any DPR. Pure axis math lives in
 * `plotPanel.ts` (Vitest-tested) — this shell is only the React glue.
 *
 * @example
 *   <PlotPanel
 *     width={520}
 *     height={300}
 *     xDomain={[0, 10]}
 *     yDomain={[0, 1]}
 *     xLabel="time"
 *     yLabel="value"
 *     series={[
 *       { id: "s1", points: [[0,0],[1,0.2],...], color: "#00693e", kind: "line" },
 *     ]}
 *   />
 */

export type PlotKind = "line" | "scatter";

export interface PlotSeries {
  readonly id: string;
  readonly points: ReadonlyArray<readonly [number, number]>;
  readonly color: string;
  readonly label?: string;
  readonly kind?: PlotKind;
}

export interface PlotPanelProps {
  readonly width: number;
  readonly height: number;
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly series: readonly PlotSeries[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly logX?: boolean;
  readonly logY?: boolean;
  readonly gridlines?: boolean;
  readonly tickCount?: number;
  /** Accessible label describing the plot for screen readers. */
  readonly ariaLabel: string;
}

const DEFAULT_GRID_COLOR = "rgba(0,0,0,0.08)";

export function PlotPanel({
  width,
  height,
  xDomain,
  yDomain,
  series,
  xLabel,
  yLabel,
  logX = false,
  logY = false,
  gridlines = true,
  tickCount,
  ariaLabel,
}: PlotPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const xAxis = computeAxisLayout({
    min: xDomain[0],
    max: xDomain[1],
    logScale: logX,
    ...(tickCount !== undefined ? { tickCount } : {}),
  });
  const yAxis = computeAxisLayout({
    min: yDomain[0],
    max: yDomain[1],
    logScale: logY,
    ...(tickCount !== undefined ? { tickCount } : {}),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: width/height are kept in the dep array intentionally so a canvas resize re-fires the draw (canvas.width/height are sampled inside, but their props identity is the trigger)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawPlot(ctx, canvas.width, canvas.height, {
      xAxis,
      yAxis,
      series,
      gridlines,
    });
  }, [xAxis, yAxis, series, gridlines, width, height]);

  return (
    <div
      className="plot-panel"
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel}
    >
      {yLabel ? <div className="plot-panel__y-label">{yLabel}</div> : <div />}
      <div className="plot-panel__y-axis" aria-hidden="true">
        {yAxis.ticks.map((tick) => (
          <span
            key={`y-${tick.value}`}
            className="plot-panel__y-tick"
            style={{ top: `${(1 - tick.normalized) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div className="plot-panel__canvas-wrap">
        <canvas ref={canvasRef} width={width} height={height} />
      </div>
      <div />
      <div className="plot-panel__x-axis" aria-hidden="true">
        {xAxis.ticks.map((tick) => (
          <span
            key={`x-${tick.value}`}
            className="plot-panel__x-tick"
            style={{ left: `${tick.normalized * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {xLabel ? <div className="plot-panel__x-label">{xLabel}</div> : null}
    </div>
  );
}

interface DrawArgs {
  readonly xAxis: AxisLayout;
  readonly yAxis: AxisLayout;
  readonly series: readonly PlotSeries[];
  readonly gridlines: boolean;
}

function drawPlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { xAxis, yAxis, series, gridlines }: DrawArgs,
): void {
  ctx.clearRect(0, 0, width, height);

  if (gridlines) {
    ctx.save();
    ctx.strokeStyle = DEFAULT_GRID_COLOR;
    ctx.lineWidth = 1;
    for (const tick of xAxis.ticks) {
      const x = Math.round(tick.normalized * width) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (const tick of yAxis.ticks) {
      const y = Math.round((1 - tick.normalized) * height) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const s of series) {
    const kind = s.kind ?? "line";
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 2;
    if (kind === "scatter") {
      for (const [px, py] of s.points) {
        const xy = projectPoint(px, py, xAxis, yAxis, width, height);
        if (xy === null) continue;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      let started = false;
      for (const [px, py] of s.points) {
        const xy = projectPoint(px, py, xAxis, yAxis, width, height);
        if (xy === null) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(xy[0], xy[1]);
          started = true;
        } else {
          ctx.lineTo(xy[0], xy[1]);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function projectPoint(
  px: number,
  py: number,
  xAxis: AxisLayout,
  yAxis: AxisLayout,
  width: number,
  height: number,
): [number, number] | null {
  const xn = normalize(px, xAxis);
  const yn = normalize(py, yAxis);
  if (xn === null || yn === null) return null;
  return [xn * width, (1 - yn) * height];
}

function normalize(value: number, axis: AxisLayout): number | null {
  if (axis.logScale) {
    if (value <= 0) return null;
    const span = Math.log10(axis.max) - Math.log10(axis.min);
    if (span === 0) return 0.5;
    return (Math.log10(value) - Math.log10(axis.min)) / span;
  }
  const span = axis.max - axis.min;
  if (span === 0) return 0.5;
  return (value - axis.min) / span;
}
