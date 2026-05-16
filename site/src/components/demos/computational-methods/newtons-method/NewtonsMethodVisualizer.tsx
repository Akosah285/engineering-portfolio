import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { newtonsMethod } from "./algorithm";
import {
  DEFAULT_STATE,
  FUNC_SLUGS,
  type NewtonDemoState,
  PRESETS,
  getFunction,
} from "./presets";
import "./NewtonsMethodVisualizer.css";

/**
 * <NewtonsMethodVisualizer> — the v1 hero numerical-methods demo (plan #77).
 *
 * Wires the demo-kit primitives together to visualise Newton's method
 * marching along the tangent line of one of four named 1D functions.
 */

const STEP_INTERVAL_MS = 500;

const STATE_SCHEMA = {
  funcSlug: {
    type: "enum",
    default: DEFAULT_STATE.funcSlug,
    values: FUNC_SLUGS,
  },
  x0: { type: "number", default: DEFAULT_STATE.x0 },
  tolerance: { type: "number", default: DEFAULT_STATE.tolerance },
  maxIterations: { type: "number", default: DEFAULT_STATE.maxIterations },
} as const satisfies Schema;

const narrationTemplate = (state: NewtonDemoState): string => {
  const fn = getFunction(state.funcSlug);
  return `Newton's method on ${fn.name}, starting at x₀ = ${state.x0.toFixed(2)}, hunting for a root with tolerance ${state.tolerance.toExponential(0)} over up to ${state.maxIterations} iterations.`;
};

/** Project x in function coordinates → cx in canvas pixels. */
function projectX(x: number, xMin: number, xMax: number, width: number): number {
  return ((x - xMin) / (xMax - xMin)) * width;
}

/** Project y in function coordinates → cy in canvas pixels (y-flipped). */
function projectY(y: number, yMin: number, yMax: number, height: number): number {
  return height - ((y - yMin) / (yMax - yMin)) * height;
}

export function NewtonsMethodVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "newtons-method",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const fn = useMemo(() => getFunction(state.funcSlug), [state.funcSlug]);

  const result = useMemo(
    () =>
      newtonsMethod({
        f: fn.f,
        df: fn.df,
        x0: state.x0,
        tolerance: state.tolerance,
        maxIterations: state.maxIterations,
      }),
    [fn, state.x0, state.tolerance, state.maxIterations],
  );

  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    accumulatorRef.current = 0;
    setStepIndex(0);
  }, [state.funcSlug, state.x0, state.tolerance, state.maxIterations]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      const [xMin, xMax] = fn.xRange;
      const [yMin, yMax] = fn.yRange;

      // Clear
      ctx.fillStyle = "#fafaf7";
      ctx.fillRect(0, 0, width, height);

      // Advance animation
      accumulatorRef.current += deltaMs;
      if (accumulatorRef.current >= STEP_INTERVAL_MS) {
        const ticks = Math.floor(accumulatorRef.current / STEP_INTERVAL_MS);
        accumulatorRef.current -= ticks * STEP_INTERVAL_MS;
        const maxIdx = Math.max(0, result.iterates.length - 1);
        setStepIndex((s) => Math.min(s + ticks, maxIdx));
      }

      // x-axis
      const axisY = projectY(0, yMin, yMax, height);
      ctx.strokeStyle = "rgba(80, 80, 80, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(width, axisY);
      ctx.stroke();

      // y-axis (if 0 is in xRange)
      if (xMin <= 0 && xMax >= 0) {
        const axisX = projectX(0, xMin, xMax, width);
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, height);
        ctx.stroke();
      }

      // f(x) curve
      ctx.strokeStyle = "#00693e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const samples = 400;
      let started = false;
      for (let i = 0; i <= samples; i += 1) {
        const x = xMin + (i / samples) * (xMax - xMin);
        const y = fn.f(x);
        if (!Number.isFinite(y)) {
          started = false;
          continue;
        }
        const cx = projectX(x, xMin, xMax, width);
        const cy = projectY(y, yMin, yMax, height);
        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();

      // Past iterates (small grey dots)
      const upTo = Math.min(stepIndex, result.iterates.length - 1);
      for (let i = 0; i < upTo; i += 1) {
        const xi = result.iterates[i]!;
        if (xi < xMin || xi > xMax) continue;
        const cx = projectX(xi, xMin, xMax, width);
        ctx.fillStyle = "rgba(120, 120, 120, 0.7)";
        ctx.beginPath();
        ctx.arc(cx, axisY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tangent line from (x_n, f(x_n)) → (x_{n+1}, 0)
      if (upTo < result.iterates.length - 1) {
        const xn = result.iterates[upTo]!;
        const xNext = result.iterates[upTo + 1]!;
        const fxn = fn.f(xn);
        if (Number.isFinite(fxn) && Number.isFinite(xNext) && xn >= xMin && xn <= xMax) {
          const cx1 = projectX(xn, xMin, xMax, width);
          const cy1 = projectY(fxn, yMin, yMax, height);
          const cx2 = projectX(xNext, xMin, xMax, width);
          ctx.strokeStyle = "rgba(207, 79, 79, 0.85)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx2, axisY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Vertical drop from (x_n, f(x_n)) to axis
          ctx.strokeStyle = "rgba(120, 120, 120, 0.5)";
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx1, axisY);
          ctx.stroke();
        }
      }

      // Current iterate (large filled green dot on the axis)
      const xn = result.iterates[upTo];
      if (xn !== undefined && xn >= xMin && xn <= xMax) {
        const cx = projectX(xn, xMin, xMax, width);
        ctx.fillStyle = "#00693e";
        ctx.beginPath();
        ctx.arc(cx, axisY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    [fn, result, stepIndex],
  );

  const currentX =
    result.iterates[Math.min(stepIndex, result.iterates.length - 1)] ?? state.x0;
  const currentFx = fn.f(currentX);

  const handleReset = (): void => {
    reset();
    accumulatorRef.current = 0;
    setStepIndex(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const xSliderMin = fn.xRange[0];
  const xSliderMax = fn.xRange[1];

  return (
    <div className="nm-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Newton's method presets"
      />

      <div className="nm-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Newton's method iterates on ${fn.name}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `x_n = ${currentX.toFixed(6)}`,
            `|f(x_n)| = ${Math.abs(currentFx).toExponential(2)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="nm-visualizer__controls">
        <SliderRow
          label="Initial guess x₀"
          description="Where Newton's method starts. Different seeds can converge to different roots — or not at all."
          min={xSliderMin}
          max={xSliderMax}
          step={0.05}
          value={state.x0}
          onChange={(x0) => setState({ ...state, x0 })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Tolerance"
          description="Stop once |f(x_n)| drops below this. Smaller = stricter."
          min={1e-8}
          max={0.1}
          step={1e-8}
          value={state.tolerance}
          onChange={(tolerance) => setState({ ...state, tolerance })}
          format={{ precision: 8 }}
        />
        <SliderRow
          label="Max iterations"
          description="Hard cap — protects against non-convergent seeds."
          min={1}
          max={50}
          step={1}
          value={state.maxIterations}
          onChange={(maxIterations) => setState({ ...state, maxIterations })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="nm-visualizer__actions">
        <button
          type="button"
          className="nm-visualizer__btn nm-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="nm-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="nm-visualizer__counter" aria-live="off">
          step {stepIndex} / {state.maxIterations}
        </span>
      </div>
    </div>
  );
}
