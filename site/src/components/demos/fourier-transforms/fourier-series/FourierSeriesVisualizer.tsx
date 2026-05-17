import { useCallback, useEffect, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type WaveformKind, exactValue, partialSum, partialSumTrace } from "./algorithm";
import {
  DEFAULT_STATE,
  type FourierSeriesDemoState,
  PRESETS,
  WAVEFORM_KINDS,
} from "./presets";
import "./FourierSeriesVisualizer.css";

/**
 * <FourierSeriesVisualizer> — animate partial Fourier sums converging
 * to a target waveform (#59 v3). Demonstrates Gibbs phenomenon at the
 * discontinuities of the square/sawtooth waves.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const X_MIN = 0;
const X_MAX = 2 * Math.PI;
const Y_MIN = -1.5;
const Y_MAX = 1.5;
const TRACE_SAMPLES = 400;
const ERROR_SAMPLES = 100;

const STATE_SCHEMA = {
  waveformKind: {
    type: "enum",
    default: DEFAULT_STATE.waveformKind,
    values: WAVEFORM_KINDS,
  },
  maxHarmonics: { type: "number", default: DEFAULT_STATE.maxHarmonics },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
} as const satisfies Schema;

const narrationTemplate = (
  state: FourierSeriesDemoState & { currentN: number },
): string => {
  const gibbs =
    state.waveformKind === "square" || state.waveformKind === "sawtooth"
      ? " Gibbs phenomenon: overshoot near the jump never vanishes as N grows."
      : "";
  return `Fourier partial sum approximating a ${state.waveformKind} wave with ${state.currentN} of ${state.maxHarmonics} harmonics.${gibbs}`;
};

function toCanvasX(x: number): number {
  return ((x - X_MIN) / (X_MAX - X_MIN)) * CANVAS_W;
}

function toCanvasY(y: number): number {
  return CANVAS_H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * CANVAS_H;
}

function paintAxes(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = "#d4d4d4";
  ctx.lineWidth = 1;
  // x-axis (y = 0)
  ctx.beginPath();
  const y0 = toCanvasY(0);
  ctx.moveTo(0, y0);
  ctx.lineTo(CANVAS_W, y0);
  ctx.stroke();
  // gridlines at ±1
  ctx.strokeStyle = "#ececec";
  ctx.beginPath();
  ctx.moveTo(0, toCanvasY(1));
  ctx.lineTo(CANVAS_W, toCanvasY(1));
  ctx.moveTo(0, toCanvasY(-1));
  ctx.lineTo(CANVAS_W, toCanvasY(-1));
  ctx.stroke();
  // x ticks at 0, π/2, π, 3π/2, 2π
  ctx.strokeStyle = "#ececec";
  ctx.beginPath();
  for (let k = 0; k <= 4; k += 1) {
    const xc = toCanvasX((k * Math.PI) / 2);
    ctx.moveTo(xc, 0);
    ctx.lineTo(xc, CANVAS_H);
  }
  ctx.stroke();
}

function paintExact(ctx: CanvasRenderingContext2D, kind: WaveformKind): void {
  ctx.strokeStyle = "#9a9a9a";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= TRACE_SAMPLES; i += 1) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / TRACE_SAMPLES;
    // For square wave, break the line at the discontinuities so we
    // don't draw vertical jump segments.
    if (kind === "square") {
      const t = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (t === 0 || Math.abs(t - Math.PI) < 1e-9 || Math.abs(t - 2 * Math.PI) < 1e-9) {
        started = false;
        continue;
      }
    }
    const y = exactValue(kind, x);
    const cx = toCanvasX(x);
    const cy = toCanvasY(y);
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintPartialSum(
  ctx: CanvasRenderingContext2D,
  kind: WaveformKind,
  n: number,
): void {
  const trace = partialSumTrace(kind, n, TRACE_SAMPLES);
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  trace.forEach((p, i) => {
    const cx = toCanvasX(p.x);
    const cy = toCanvasY(p.y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();
}

function maxAbsError(kind: WaveformKind, n: number): number {
  let m = 0;
  for (let i = 1; i < ERROR_SAMPLES; i += 1) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / ERROR_SAMPLES;
    const e = Math.abs(partialSum({ kind, x, nHarmonics: n }) - exactValue(kind, x));
    if (e > m) m = e;
  }
  return m;
}

export function FourierSeriesVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "fourier-series",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const [currentN, setCurrentN] = useState(1);
  const [paused, setPaused] = useState(false);
  const accumulatorRef = useRef(0);
  const currentNRef = useRef(1);

  // Reset N whenever waveform or maxHarmonics changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps; body resets refs/state and doesn't read waveformKind/maxHarmonics
  useEffect(() => {
    currentNRef.current = 1;
    accumulatorRef.current = 0;
    setCurrentN(1);
  }, [state.waveformKind, state.maxHarmonics]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      // Advance N based on accumulated time.
      accumulatorRef.current += deltaMs;
      let advanced = false;
      while (
        accumulatorRef.current >= state.stepDelay &&
        currentNRef.current < state.maxHarmonics
      ) {
        accumulatorRef.current -= state.stepDelay;
        currentNRef.current += 1;
        advanced = true;
      }
      if (advanced) setCurrentN(currentNRef.current);

      paintAxes(ctx);
      paintExact(ctx, state.waveformKind);
      paintPartialSum(ctx, state.waveformKind, currentNRef.current);
    },
    [state.waveformKind, state.maxHarmonics, state.stepDelay],
  );

  const err = maxAbsError(state.waveformKind, currentN);

  const handleReset = (): void => {
    reset();
    currentNRef.current = 1;
    accumulatorRef.current = 0;
    setCurrentN(1);
  };

  const handlePresetSelect = (next: FourierSeriesDemoState): void => {
    setState(next);
  };

  return (
    <div className="fs-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: FourierSeriesDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Fourier series presets"
      />

      <div className="fs-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Fourier partial sum approximating a ${state.waveformKind} wave`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `N = ${currentN} / ${state.maxHarmonics}`,
            `\\max |\\text{error}| = ${err.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={{ ...state, currentN }} template={narrationTemplate} />

      <div className="fs-visualizer__kind" role="group" aria-label="Waveform kind">
        <span className="fs-visualizer__kind-label">Waveform:</span>
        {WAVEFORM_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="fs-visualizer__kind-btn"
            aria-pressed={state.waveformKind === kind}
            onClick={() => setState({ ...state, waveformKind: kind })}
          >
            {kind}
          </button>
        ))}
      </div>

      <div className="fs-visualizer__controls">
        <SliderRow
          label="Max harmonics"
          description="Upper bound on N. Larger N → sharper edges but Gibbs overshoot persists."
          min={1}
          max={200}
          step={1}
          value={state.maxHarmonics}
          onChange={(maxHarmonics) => setState({ ...state, maxHarmonics })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Step delay (ms)"
          description="Milliseconds between adding successive harmonics."
          min={50}
          max={1000}
          step={50}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="fs-visualizer__actions">
        <button
          type="button"
          className="fs-visualizer__btn fs-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="fs-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="fs-visualizer__counter" aria-live="off">
          N = {currentN}
        </span>
      </div>
    </div>
  );
}
