import { useMemo } from "react";
import { PlotPanel, type PlotSeries } from "./PlotPanel";
import { windowSlice, type RingBuffer } from "./timeSeries";

/**
 * <TimeSeriesPlot> — sliding-window specialization of <PlotPanel> (#53).
 *
 * Subscribes to one or more streaming `RingBuffer`s and renders the most
 * recent `windowSeconds` of data. Y-axis can auto-track the data
 * (`yDomain="follow"`) or stay fixed.
 *
 * The data-flow shape is intentional: the consumer owns the ring buffer
 * and feeds new samples in via `pushSample(buf, sample)` then re-renders
 * with the new buffer. The plot is purely a presentational view.
 *
 * @example
 *   const [buf, setBuf] = useState(() => createRingBuffer(2000));
 *   useDrawLoop(canvasRef, (_ctx, _dt, t) => {
 *     setBuf(b => pushSample(b, { t: t/1000, value: Math.sin(t/200) }));
 *   });
 *   <TimeSeriesPlot
 *     width={500} height={200}
 *     series={[{ id: "y", buffer: buf, color: "#00693e", label: "y(t)" }]}
 *     now={t/1000} windowSeconds={5}
 *     yDomain="follow"
 *     ariaLabel="Sine wave time series"
 *   />
 */

export interface TimeSeriesSeries {
  readonly id: string;
  readonly buffer: RingBuffer;
  readonly color: string;
  readonly label?: string;
}

export interface TimeSeriesPlotProps {
  readonly width: number;
  readonly height: number;
  readonly series: readonly TimeSeriesSeries[];
  readonly now: number;
  readonly windowSeconds: number;
  /** Either a fixed [ymin, ymax] or "follow" to auto-track. */
  readonly yDomain: readonly [number, number] | "follow";
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly ariaLabel: string;
}

const FOLLOW_PADDING = 0.1;

export function TimeSeriesPlot({
  width,
  height,
  series,
  now,
  windowSeconds,
  yDomain,
  xLabel,
  yLabel,
  ariaLabel,
}: TimeSeriesPlotProps) {
  const plotSeries: PlotSeries[] = useMemo(
    () =>
      series.map((s) => {
        const samples = windowSlice(s.buffer, now, windowSeconds);
        return {
          id: s.id,
          color: s.color,
          ...(s.label !== undefined ? { label: s.label } : {}),
          kind: "line" as const,
          points: samples.map((sample) => [sample.t, sample.value] as const),
        };
      }),
    [series, now, windowSeconds],
  );

  const computedYDomain = useMemo<readonly [number, number]>(() => {
    if (yDomain !== "follow") return yDomain;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const s of plotSeries) {
      for (const [, y] of s.points) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo === hi) return [lo - 1, hi + 1];
    const span = hi - lo;
    return [lo - span * FOLLOW_PADDING, hi + span * FOLLOW_PADDING];
  }, [yDomain, plotSeries]);

  return (
    <PlotPanel
      width={width}
      height={height}
      xDomain={[now - windowSeconds, now]}
      yDomain={computedYDomain}
      series={plotSeries}
      {...(xLabel !== undefined ? { xLabel } : {})}
      {...(yLabel !== undefined ? { yLabel } : {})}
      ariaLabel={ariaLabel}
    />
  );
}
