import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type Complex,
  buildEpicycles,
  dft,
  epicycleChain,
  samplePath,
} from "./algorithm";
import {
  DEFAULT_STATE,
  type EpicycleDemoState,
  PATH_SLUGS,
  PRESETS,
  getPath,
} from "./presets";
import "./EpicycleVisualizer.css";

/**
 * <EpicycleVisualizer> — Fourier epicycle reconstruction of a closed path.
 *
 * Wires demo-kit primitives together to visualise a 3Blue1Brown-style
 * chain of rotating circles tracing a parametric curve. The DFT of the
 * sampled path produces complex coefficients; buildEpicycles() sorts
 * them by amplitude; epicycleChain() evaluates the partial sum at t.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const WORLD_HALF_W = 2;
const WORLD_HALF_H = 1.5;
const TARGET_SAMPLES = 240;
const TRACE_LIMIT = 4096;
const MAX_NUM_TERMS = 128;

const STATE_SCHEMA = {
  pathSlug: {
    type: "enum",
    default: DEFAULT_STATE.pathSlug,
    values: PATH_SLUGS,
  },
  numTerms: { type: "number", default: DEFAULT_STATE.numTerms },
  samplePoints: { type: "number", default: DEFAULT_STATE.samplePoints },
  cycleSpeed: { type: "number", default: DEFAULT_STATE.cycleSpeed },
} as const satisfies Schema;

const narrationTemplate = (state: EpicycleDemoState): string => {
  const path = getPath(state.pathSlug);
  return `Fourier epicycles tracing the ${path.name.toLowerCase()} path with ${state.numTerms} of ${state.samplePoints} terms, advancing at ${state.cycleSpeed.toFixed(2)} cycles per second.`;
};

function toCanvasX(x: number): number {
  return CANVAS_W / 2 + (x / WORLD_HALF_W) * (CANVAS_W / 2);
}
function toCanvasY(y: number): number {
  // +im should draw upward
  return CANVAS_H / 2 - (y / WORLD_HALF_H) * (CANVAS_H / 2);
}
// Uniform scale (per world unit) for circle radii — pick the smaller of
// the two so the unit circle stays round on a non-square canvas.
const SCALE = Math.min(CANVAS_W / 2 / WORLD_HALF_W, CANVAS_H / 2 / WORLD_HALF_H);

function paintTargetPath(
  ctx: CanvasRenderingContext2D,
  fn: (t: number) => Complex,
): void {
  ctx.strokeStyle = "rgba(120, 120, 120, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= TARGET_SAMPLES; i++) {
    const t = i / TARGET_SAMPLES;
    const z = fn(t);
    const x = toCanvasX(z.re);
    const y = toCanvasY(z.im);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paintChain(
  ctx: CanvasRenderingContext2D,
  points: readonly Complex[],
  amps: readonly number[],
): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(80, 80, 80, 0.55)";
  // Circles: at each joint i (0..points.length-2), draw a circle of
  // radius amps[i] centred on points[i].
  for (let i = 0; i < points.length - 1; i++) {
    const c = points[i]!;
    const r = amps[i]!;
    ctx.beginPath();
    ctx.arc(toCanvasX(c.re), toCanvasY(c.im), r * SCALE, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Connector arms
  ctx.strokeStyle = "rgba(40, 40, 40, 0.85)";
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const x = toCanvasX(p.re);
    const y = toCanvasY(p.im);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paintTrace(ctx: CanvasRenderingContext2D, trace: readonly Complex[]): void {
  if (trace.length < 2) return;
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < trace.length; i++) {
    const p = trace[i]!;
    const x = toCanvasX(p.re);
    const y = toCanvasY(p.im);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function EpicycleVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "epicycle",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const pathDef = useMemo(() => getPath(state.pathSlug), [state.pathSlug]);

  const eps = useMemo(() => {
    const samples = samplePath(pathDef.fn, state.samplePoints);
    const coeffs = dft(samples);
    return buildEpicycles(coeffs);
  }, [pathDef, state.samplePoints]);

  // Per-frame mutable state: time, trace history.
  const tRef = useRef(0);
  const traceRef = useRef<Complex[]>([]);
  const [paused, setPaused] = useState(false);

  // Clamp slider upper bound to actual epicycle count.
  const termCap = Math.min(MAX_NUM_TERMS, eps.length);
  const effectiveTerms = Math.max(1, Math.min(state.numTerms, termCap));

  // Clear the trace whenever the path, sample count, or term count changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps; body resets refs and doesn't read the listed state.* values
  useEffect(() => {
    tRef.current = 0;
    traceRef.current = [];
  }, [state.pathSlug, state.samplePoints, state.numTerms]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      paintTargetPath(ctx, pathDef.fn);

      // Advance t by (cycleSpeed cycles / sec) * deltaMs.
      const prevT = tRef.current;
      const nextT = prevT + (state.cycleSpeed * deltaMs) / 1000;
      const wrapped = Math.floor(nextT) !== Math.floor(prevT);
      tRef.current = nextT - Math.floor(nextT);
      if (wrapped) {
        traceRef.current = [];
      }

      const limit = Math.max(0, Math.min(effectiveTerms, eps.length));
      const result =
        limit < eps.length
          ? epicycleChain(eps, tRef.current, limit)
          : epicycleChain(eps, tRef.current);
      const amps = eps.slice(0, limit).map((e) => e.amp);
      paintChain(ctx, result.points, amps);

      traceRef.current.push(result.tip);
      if (traceRef.current.length > TRACE_LIMIT) {
        traceRef.current.splice(0, traceRef.current.length - TRACE_LIMIT);
      }
      paintTrace(ctx, traceRef.current);
    },
    [pathDef, eps, effectiveTerms, state.cycleSpeed],
  );

  const handleReset = (): void => {
    reset();
    tRef.current = 0;
    traceRef.current = [];
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
    tRef.current = 0;
    traceRef.current = [];
  };

  return (
    <div className="ep-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Epicycle path presets"
      />

      <div className="ep-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Fourier epicycles tracing the ${pathDef.name.toLowerCase()} path`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `t = ${tRef.current.toFixed(3)}`,
            `\\text{terms} = ${effectiveTerms} / ${state.samplePoints}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ep-visualizer__controls">
        <SliderRow
          label="Num terms"
          description="How many epicycles to sum. More terms → closer to the target path."
          min={1}
          max={MAX_NUM_TERMS}
          step={1}
          value={state.numTerms}
          onChange={(numTerms) => setState({ ...state, numTerms })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Sample points"
          description="N for the DFT. Higher N captures finer detail at O(N²) cost."
          min={64}
          max={256}
          step={64}
          value={state.samplePoints}
          onChange={(samplePoints) => setState({ ...state, samplePoints })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Cycle speed"
          description="Cycles per second — how fast the pen sweeps around the path."
          min={0.1}
          max={5}
          step={0.1}
          value={state.cycleSpeed}
          onChange={(cycleSpeed) => setState({ ...state, cycleSpeed })}
          format={{ precision: 2 }}
        />
      </div>

      <div className="ep-visualizer__actions">
        <button
          type="button"
          className="ep-visualizer__btn ep-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="ep-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="ep-visualizer__counter" aria-live="off">
          terms {effectiveTerms} / {state.samplePoints}
        </span>
      </div>
    </div>
  );
}
