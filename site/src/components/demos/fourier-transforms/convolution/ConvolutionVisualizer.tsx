import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Sample, convolve } from "./algorithm";
import {
  type ConvolutionDemoState,
  DEFAULT_STATE,
  PAIR_SLUGS,
  PRESETS,
  getPair,
} from "./presets";
import "./ConvolutionVisualizer.css";

/**
 * <ConvolutionVisualizer> — discrete linear convolution intuition.
 *
 * Three stacked panes: f(t), the flipped-and-shifted kernel g(τ - t),
 * and the convolution output (f * g)(τ) revealed sample-by-sample as
 * the kernel slides.
 */

const STATE_SCHEMA = {
  pairSlug: {
    type: "enum",
    default: DEFAULT_STATE.pairSlug,
    values: PAIR_SLUGS,
  },
  nSamples: { type: "number", default: DEFAULT_STATE.nSamples },
  slideSpeed: { type: "number", default: DEFAULT_STATE.slideSpeed },
} as const satisfies Schema;

const PANE_COUNT = 3;
const PANE_PAD = 8;

const narrationTemplate = (state: ConvolutionDemoState): string => {
  const pair = getPair(state.pairSlug);
  return `Convolving the ${pair.name.toLowerCase()} signal pair with ${state.nSamples} samples each, sliding the kernel at ${state.slideSpeed} shifts per second to build up the output one sample at a time.`;
};

interface Extent {
  min: number;
  max: number;
}

function extentOf(samples: readonly Sample[]): Extent {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i]!.value;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi === lo) hi = lo + 1;
  return { min: lo, max: hi };
}

function extentOfNumbers(xs: readonly number[]): Extent {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const v = xs[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi === lo) hi = lo + 1;
  return { min: lo, max: hi };
}

interface PaneBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function paneFor(index: number, width: number, height: number): PaneBox {
  const h = height / PANE_COUNT;
  return { x: 0, y: index * h, w: width, h };
}

function paintAxis(ctx: CanvasRenderingContext2D, pane: PaneBox, label: string): void {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const midY = pane.y + pane.h / 2;
  ctx.moveTo(pane.x + PANE_PAD, midY);
  ctx.lineTo(pane.x + pane.w - PANE_PAD, midY);
  ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = "12px 'JetBrains Mono Variable', monospace";
  ctx.textBaseline = "top";
  ctx.fillText(label, pane.x + PANE_PAD, pane.y + PANE_PAD / 2);
}

function plotPath(
  ctx: CanvasRenderingContext2D,
  pane: PaneBox,
  xRange: Extent,
  yRange: Extent,
  points: ReadonlyArray<{ t: number; value: number }>,
  stroke: string,
  lineWidth = 2,
): void {
  if (points.length === 0) return;
  const innerX = pane.x + PANE_PAD;
  const innerW = pane.w - 2 * PANE_PAD;
  const innerY = pane.y + PANE_PAD;
  const innerH = pane.h - 2 * PANE_PAD;
  const xSpan = xRange.max - xRange.min || 1;
  const ySpan = yRange.max - yRange.min || 1;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const cx = innerX + ((p.t - xRange.min) / xSpan) * innerW;
    const cy = innerY + innerH - ((p.value - yRange.min) / ySpan) * innerH;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

function fillUnder(
  ctx: CanvasRenderingContext2D,
  pane: PaneBox,
  xRange: Extent,
  yRange: Extent,
  points: ReadonlyArray<{ t: number; value: number }>,
  fill: string,
): void {
  if (points.length === 0) return;
  const innerX = pane.x + PANE_PAD;
  const innerW = pane.w - 2 * PANE_PAD;
  const innerY = pane.y + PANE_PAD;
  const innerH = pane.h - 2 * PANE_PAD;
  const xSpan = xRange.max - xRange.min || 1;
  const ySpan = yRange.max - yRange.min || 1;
  const zeroY = innerY + innerH - ((0 - yRange.min) / ySpan) * innerH;

  ctx.fillStyle = fill;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const cx = innerX + ((p.t - xRange.min) / xSpan) * innerW;
    const cy = innerY + innerH - ((p.value - yRange.min) / ySpan) * innerH;
    if (!started) {
      ctx.moveTo(cx, zeroY);
      ctx.lineTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
    if (i === points.length - 1) {
      ctx.lineTo(cx, zeroY);
    }
  }
  ctx.closePath();
  ctx.fill();
}

export function ConvolutionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "convolution",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const pair = useMemo(() => getPair(state.pairSlug), [state.pairSlug]);
  const signals = useMemo(() => pair.build(state.nSamples), [pair, state.nSamples]);

  const conv = useMemo(
    () =>
      convolve({
        f: signals.f.map((s) => s.value),
        g: signals.g.map((s) => s.value),
        dt: signals.dt,
      }),
    [signals],
  );

  const totalShifts = conv.length;
  const outTMin = 2 * signals.tMin;
  const outTMax = 2 * signals.tMax;
  const outSamples = useMemo<Sample[]>(
    () =>
      conv.map((value, i) => ({
        t: outTMin + i * signals.dt,
        value,
      })),
    [conv, outTMin, signals.dt],
  );

  const accumulatorRef = useRef(0);
  const idxRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Reset slide whenever inputs change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps; body resets refs/state and doesn't read pairSlug/nSamples
  useEffect(() => {
    accumulatorRef.current = 0;
    idxRef.current = 0;
    setCurrentIdx(0);
  }, [state.pairSlug, state.nSamples]);

  const fExtent = useMemo(() => extentOf(signals.f), [signals.f]);
  const gExtent = useMemo(() => extentOf(signals.g), [signals.g]);
  const sigYExtent = useMemo<Extent>(
    () => ({
      min: Math.min(fExtent.min, gExtent.min),
      max: Math.max(fExtent.max, gExtent.max),
    }),
    [fExtent, gExtent],
  );
  const outExtent = useMemo(() => extentOfNumbers(conv), [conv]);

  const xRange = useMemo<Extent>(
    () => ({ min: outTMin, max: outTMax }),
    [outTMin, outTMax],
  );

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);

      // Advance current shift index based on elapsed time.
      const stepInterval = 1000 / Math.max(1, state.slideSpeed);
      accumulatorRef.current += deltaMs;
      let advanced = false;
      while (accumulatorRef.current >= stepInterval && idxRef.current < totalShifts - 1) {
        accumulatorRef.current -= stepInterval;
        idxRef.current += 1;
        advanced = true;
      }
      if (accumulatorRef.current > stepInterval) {
        // Cap accumulator so we don't fast-forward absurdly after tab focus.
        accumulatorRef.current = stepInterval;
      }
      const n = idxRef.current;
      if (advanced) setCurrentIdx(n);

      const top = paneFor(0, width, height);
      const mid = paneFor(1, width, height);
      const bot = paneFor(2, width, height);

      paintAxis(ctx, top, "f(t)");
      paintAxis(ctx, mid, "g(τ − t)");
      paintAxis(ctx, bot, "(f ⋆ g)(τ)");

      // Top: f
      plotPath(ctx, top, xRange, sigYExtent, signals.f, "#00693e", 2);

      // Middle: f light + g flipped & shifted, with product fill
      plotPath(ctx, mid, xRange, sigYExtent, signals.f, "rgba(0, 105, 62, 0.25)", 1.5);

      // g flipped + shifted onto f's time axis: at output idx n,
      // value at time t = f.t[i] is g.value[n - i] when in range.
      const shifted: Sample[] = [];
      const product: Sample[] = [];
      for (let i = 0; i < signals.f.length; i += 1) {
        const j = n - i;
        const gVal = j >= 0 && j < signals.g.length ? signals.g[j]!.value : 0;
        const t = signals.f[i]!.t;
        shifted.push({ t, value: gVal });
        product.push({ t, value: gVal * signals.f[i]!.value });
      }
      fillUnder(ctx, mid, xRange, sigYExtent, product, "rgba(207, 79, 79, 0.25)");
      plotPath(ctx, mid, xRange, sigYExtent, shifted, "#cf4f4f", 2);

      // Bottom: convolution output revealed up to index n
      const revealed = outSamples.slice(0, n + 1);
      plotPath(ctx, bot, xRange, outExtent, outSamples, "rgba(0, 0, 0, 0.1)", 1);
      plotPath(ctx, bot, xRange, outExtent, revealed, "#00693e", 2);

      // Marker dot for current sample on the output plot
      if (revealed.length > 0) {
        const last = revealed[revealed.length - 1]!;
        const innerX = bot.x + PANE_PAD;
        const innerW = bot.w - 2 * PANE_PAD;
        const innerY = bot.y + PANE_PAD;
        const innerH = bot.h - 2 * PANE_PAD;
        const xSpan = xRange.max - xRange.min || 1;
        const ySpan = outExtent.max - outExtent.min || 1;
        const cx = innerX + ((last.t - xRange.min) / xSpan) * innerW;
        const cy = innerY + innerH - ((last.value - outExtent.min) / ySpan) * innerH;
        ctx.fillStyle = "#00693e";
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [outExtent, outSamples, signals, sigYExtent, state.slideSpeed, totalShifts, xRange],
  );

  const currentT = outTMin + currentIdx * signals.dt;
  const currentValue = conv[currentIdx] ?? 0;

  const handleReset = (): void => {
    reset();
    accumulatorRef.current = 0;
    idxRef.current = 0;
    setCurrentIdx(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
    accumulatorRef.current = 0;
    idxRef.current = 0;
    setCurrentIdx(0);
  };

  return (
    <div className="cv-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Convolution presets"
      />

      <div className="cv-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Convolution of ${pair.name.toLowerCase()} signals`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\tau = ${currentT.toFixed(2)}`,
            `(f \\ast g)[${currentIdx}] = ${currentValue.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="cv-visualizer__controls">
        <SliderRow
          label="N samples"
          description="Number of samples per input signal. Higher = smoother convolution."
          min={50}
          max={300}
          step={10}
          value={state.nSamples}
          onChange={(nSamples) => setState({ ...state, nSamples })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Slide speed"
          description="Shifts per second as the kernel slides over the signal."
          min={1}
          max={30}
          step={1}
          value={state.slideSpeed}
          onChange={(slideSpeed) => setState({ ...state, slideSpeed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="cv-visualizer__actions">
        <button
          type="button"
          className="cv-visualizer__btn cv-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="cv-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="cv-visualizer__counter" aria-live="off">
          shift {currentIdx} / {totalShifts}
        </span>
      </div>
    </div>
  );
}
