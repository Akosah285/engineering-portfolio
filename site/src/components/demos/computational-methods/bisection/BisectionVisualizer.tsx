import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Bracket, bisection } from "./algorithm";
import {
  type BisectionDemoState,
  DEFAULT_STATE,
  FUNCTIONS,
  FUNC_SLUGS,
  PRESETS,
} from "./presets";
import "./BisectionVisualizer.css";

/**
 * <BisectionVisualizer> — 1D bisection root-finder demo (#78).
 *
 * Renders f(x) over a fixed viewport, shades the current bracket [a, b]
 * in translucent green, and animates the bracket halving once per
 * ~500 ms. Gates input so the pure algorithm never throws.
 */

const STEP_INTERVAL_MS = 500;

const STATE_SCHEMA = {
  funcSlug: {
    type: "enum",
    default: DEFAULT_STATE.funcSlug,
    values: FUNC_SLUGS,
  },
  a: { type: "number", default: DEFAULT_STATE.a },
  b: { type: "number", default: DEFAULT_STATE.b },
  tolerance: { type: "number", default: DEFAULT_STATE.tolerance },
  maxIterations: { type: "number", default: DEFAULT_STATE.maxIterations },
} as const satisfies Schema;

const narrationTemplate = (state: BisectionDemoState): string => {
  const fn = FUNCTIONS[state.funcSlug];
  return `Bisection root finder on f(x) = ${fn.name}, bracketed by [${state.a.toFixed(3)}, ${state.b.toFixed(3)}], with tolerance ${state.tolerance.toExponential(0)} and up to ${state.maxIterations} iterations.`;
};

interface Projector {
  toX: (x: number) => number;
  toY: (y: number) => number;
}

function makeProjector(
  width: number,
  height: number,
  xRange: readonly [number, number],
  yRange: readonly [number, number],
): Projector {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const sx = width / (xMax - xMin);
  const sy = height / (yMax - yMin);
  return {
    toX: (x) => (x - xMin) * sx,
    toY: (y) => height - (y - yMin) * sy,
  };
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  proj: Projector,
  width: number,
): void {
  const y0 = proj.toY(0);
  ctx.strokeStyle = "rgba(60, 60, 60, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(width, y0);
  ctx.stroke();
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  proj: Projector,
  f: (x: number) => number,
  xRange: readonly [number, number],
  width: number,
): void {
  const [xMin, xMax] = xRange;
  const samples = 320;
  ctx.strokeStyle = "#1f4f7a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + (i / samples) * (xMax - xMin);
    const y = f(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const cx = (i / samples) * width;
    const cy = proj.toY(y);
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
}

function paintBracketHistory(
  ctx: CanvasRenderingContext2D,
  proj: Projector,
  history: readonly Bracket[],
  height: number,
): void {
  if (history.length === 0) return;
  history.forEach((bracket, idx) => {
    const age = history.length - idx;
    const alpha = Math.max(0.04, 0.18 / age);
    const x0 = proj.toX(bracket[0]);
    const x1 = proj.toX(bracket[1]);
    ctx.fillStyle = `rgba(0, 105, 62, ${alpha})`;
    ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), height);
  });
}

function paintCurrentBracket(
  ctx: CanvasRenderingContext2D,
  proj: Projector,
  bracket: Bracket,
  height: number,
): void {
  const x0 = proj.toX(bracket[0]);
  const x1 = proj.toX(bracket[1]);
  const left = Math.min(x0, x1);
  const w = Math.abs(x1 - x0);
  ctx.fillStyle = "rgba(0, 105, 62, 0.22)";
  ctx.fillRect(left, 0, Math.max(1, w), height);
  ctx.strokeStyle = "rgba(0, 105, 62, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, 0, Math.max(1, w), height);
}

function paintMidpoint(
  ctx: CanvasRenderingContext2D,
  proj: Projector,
  bracket: Bracket,
): void {
  const mid = (bracket[0] + bracket[1]) / 2;
  const cx = proj.toX(mid);
  const cy = proj.toY(0);
  ctx.fillStyle = "#cf4f4f";
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function paintErrorMessage(
  ctx: CanvasRenderingContext2D,
  message: string,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "rgba(207, 79, 79, 0.12)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#8a2a2a";
  ctx.font = "16px 'Inter Variable', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
}

export function BisectionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "bisection",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const fn = useMemo(() => FUNCTIONS[state.funcSlug], [state.funcSlug]);

  // Validate the bracket BEFORE calling the pure algorithm. The algorithm
  // throws on equal endpoints or same-sign endpoints, so we gate here.
  const bracketInvalid = useMemo<string | null>(() => {
    if (state.a === state.b) {
      return "Bracket invalid: endpoints must differ.";
    }
    const fa = fn.f(state.a);
    const fb = fn.f(state.b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
      return "Bracket invalid: f(a) or f(b) is not finite.";
    }
    if (fa * fb > 0) {
      return "Bracket invalid: f(a) and f(b) must have opposite signs.";
    }
    return null;
  }, [fn, state.a, state.b]);

  const result = useMemo(() => {
    if (bracketInvalid !== null) return null;
    try {
      return bisection({
        f: fn.f,
        a: state.a,
        b: state.b,
        tolerance: state.tolerance,
        maxIterations: state.maxIterations,
      });
    } catch {
      return null;
    }
  }, [bracketInvalid, fn, state.a, state.b, state.tolerance, state.maxIterations]);

  const brackets = result?.brackets ?? [];
  const totalSteps = Math.max(0, brackets.length - 1);

  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  // Reset animation whenever inputs change.
  useEffect(() => {
    accumulatorRef.current = 0;
    setStepCount(0);
  }, [state.funcSlug, state.a, state.b, state.tolerance, state.maxIterations]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      if (bracketInvalid !== null) {
        paintErrorMessage(ctx, bracketInvalid, width, height);
        return;
      }

      const proj = makeProjector(width, height, fn.xRange, fn.yRange);

      // Advance step count one bracket per STEP_INTERVAL_MS.
      accumulatorRef.current += deltaMs;
      if (totalSteps > 0) {
        let advanced = 0;
        while (
          accumulatorRef.current >= STEP_INTERVAL_MS &&
          stepCount + advanced < totalSteps
        ) {
          accumulatorRef.current -= STEP_INTERVAL_MS;
          advanced += 1;
        }
        if (advanced > 0) setStepCount((s) => Math.min(totalSteps, s + advanced));
      }

      const currentIdx = Math.min(stepCount, brackets.length - 1);
      const history = brackets.slice(0, Math.max(0, currentIdx));
      const current = brackets[currentIdx];

      paintBracketHistory(ctx, proj, history, height);
      if (current) paintCurrentBracket(ctx, proj, current, height);
      paintAxes(ctx, proj, width);
      paintCurve(ctx, proj, fn.f, fn.xRange, width);
      if (current) paintMidpoint(ctx, proj, current);
    },
    [bracketInvalid, fn, brackets, totalSteps, stepCount],
  );

  const currentBracket = brackets[Math.min(stepCount, Math.max(0, brackets.length - 1))];
  const aDisp = currentBracket ? currentBracket[0] : state.a;
  const bDisp = currentBracket ? currentBracket[1] : state.b;
  const widthDisp = Math.abs(bDisp - aDisp);

  const handleReset = (): void => {
    reset();
    accumulatorRef.current = 0;
    setStepCount(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="bi-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Bisection presets"
      />

      <div className="bi-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Bisection root finder on f(x) = ${fn.name}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `[a, b] = [${aDisp.toFixed(4)}, ${bDisp.toFixed(4)}]`,
            `|b - a| = ${widthDisp.toExponential(2)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="bi-visualizer__controls">
        <SliderRow
          label="Left endpoint a"
          description="Left side of the bracket [a, b]. f(a) and f(b) must have opposite signs."
          min={fn.xRange[0]}
          max={fn.xRange[1]}
          step={0.01}
          value={state.a}
          onChange={(a) => setState({ ...state, a })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Right endpoint b"
          description="Right side of the bracket [a, b]."
          min={fn.xRange[0]}
          max={fn.xRange[1]}
          step={0.01}
          value={state.b}
          onChange={(b) => setState({ ...state, b })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Tolerance"
          description="Stop once |f(mid)| or half the bracket width is below this."
          min={1e-8}
          max={0.1}
          step={1e-8}
          value={state.tolerance}
          onChange={(tolerance) => setState({ ...state, tolerance })}
          format={{ precision: 8 }}
        />
        <SliderRow
          label="Max iterations"
          description="Hard cap on the number of bracket halvings."
          min={1}
          max={60}
          step={1}
          value={state.maxIterations}
          onChange={(maxIterations) => setState({ ...state, maxIterations })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="bi-visualizer__actions">
        <button
          type="button"
          className="bi-visualizer__btn bi-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="bi-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="bi-visualizer__counter" aria-live="off">
          step {stepCount} / {state.maxIterations}
        </span>
      </div>
    </div>
  );
}
