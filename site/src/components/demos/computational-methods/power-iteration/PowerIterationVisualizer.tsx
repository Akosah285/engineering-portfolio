import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { powerIteration } from "./algorithm";
import {
  DEFAULT_STATE,
  MATRIX_SLUGS,
  PRESETS,
  PRESET_META,
  type PowerIterationDemoState,
} from "./presets";
import "./PowerIterationVisualizer.css";

/**
 * <PowerIterationVisualizer> — animates v ← Av/‖Av‖ on the unit circle
 * for a chosen 2×2 matrix preset, surfacing the Rayleigh quotient and
 * convergence state via the demo-kit primitives.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const TRAIL_CAP = 40;
const STEPS_PER_FRAME_CAP = 50;

const STATE_SCHEMA = {
  matrixSlug: {
    type: "enum",
    default: DEFAULT_STATE.matrixSlug,
    values: MATRIX_SLUGS,
  },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
  maxIterations: { type: "number", default: DEFAULT_STATE.maxIterations },
} as const satisfies Schema;

type Vec2 = readonly [number, number];

const INITIAL_V: Vec2 = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];

function applyMatrix(A: ReadonlyArray<ReadonlyArray<number>>, v: Vec2): Vec2 {
  const r0 = A[0]!;
  const r1 = A[1]!;
  return [r0[0]! * v[0] + r0[1]! * v[1], r1[0]! * v[0] + r1[1]! * v[1]];
}

function normalize2(v: Vec2): Vec2 {
  const n = Math.hypot(v[0], v[1]);
  if (n === 0) return v;
  return [v[0] / n, v[1] / n];
}

function rayleigh(A: ReadonlyArray<ReadonlyArray<number>>, v: Vec2): number {
  const Av = applyMatrix(A, v);
  return v[0] * Av[0] + v[1] * Av[1];
}

/** World-to-canvas projector: unit circle radius = `R` pixels, origin centred. */
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = CANVAS_H / 2;
const R = 130;

function toCanvas(v: Vec2): readonly [number, number] {
  return [ORIGIN_X + v[0] * R, ORIGIN_Y - v[1] * R];
}

function paintBackground(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // Faint unit circle
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, R, 0, Math.PI * 2);
  ctx.stroke();
  // Axes
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.beginPath();
  ctx.moveTo(0, ORIGIN_Y);
  ctx.lineTo(CANVAS_W, ORIGIN_Y);
  ctx.moveTo(ORIGIN_X, 0);
  ctx.lineTo(ORIGIN_X, CANVAS_H);
  ctx.stroke();
}

function paintArrow(
  ctx: CanvasRenderingContext2D,
  to: Vec2,
  color: string,
  width: number,
  scale = 1,
): void {
  const [tx, ty] = toCanvas([to[0] * scale, to[1] * scale]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // Arrowhead
  const dx = tx - ORIGIN_X;
  const dy = ty - ORIGIN_Y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = 9;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - ux * head - uy * head * 0.6, ty - uy * head + ux * head * 0.6);
  ctx.lineTo(tx - ux * head + uy * head * 0.6, ty - uy * head - ux * head * 0.6);
  ctx.closePath();
  ctx.fill();
}

function paintEigenAxis(ctx: CanvasRenderingContext2D, eig: Vec2): void {
  // Dashed crimson line through origin along eigenvector direction.
  const len = Math.hypot(eig[0], eig[1]);
  if (len === 0) return;
  const ux = eig[0] / len;
  const uy = eig[1] / len;
  const farPx = Math.max(CANVAS_W, CANVAS_H);
  const [x1, y1] = toCanvas([ux * (farPx / R), uy * (farPx / R)]);
  const [x2, y2] = toCanvas([-ux * (farPx / R), -uy * (farPx / R)]);
  ctx.strokeStyle = "rgba(180, 30, 50, 0.55)";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintTrail(ctx: CanvasRenderingContext2D, trail: readonly Vec2[]): void {
  const n = trail.length;
  for (let i = 0; i < n; i += 1) {
    const v = trail[i]!;
    const [cx, cy] = toCanvas(v);
    const alpha = 0.08 + 0.35 * (i / Math.max(1, n - 1));
    ctx.fillStyle = `rgba(80, 80, 80, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

const narrationTemplate =
  (eigDisplay: number) =>
  (state: PowerIterationDemoState): string => {
    const meta = PRESET_META[state.matrixSlug];
    return `Power iteration on matrix preset "${meta.label}" — ${meta.blurb}. v ← Av/‖Av‖ converges to the dominant eigenvector at rate |λ₂/λ₁|. Currently λ ≈ ${eigDisplay.toFixed(3)}.`;
  };

export function PowerIterationVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "power-iteration",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const meta = useMemo(() => PRESET_META[state.matrixSlug], [state.matrixSlug]);

  // Reference dominant eigenvector (precomputed) for the dashed axis.
  const dominantEig = useMemo<Vec2>(() => {
    const res = powerIteration({ A: meta.A, tol: 1e-12, maxIterations: 500 });
    const e0 = res.eigenvector[0] ?? 1;
    const e1 = res.eigenvector[1] ?? 0;
    return [e0, e1];
  }, [meta]);

  const vRef = useRef<Vec2>(INITIAL_V);
  const trailRef = useRef<Vec2[]>([]);
  const iterRef = useRef(0);
  const accumulatorRef = useRef(0);
  const convergedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [displayIter, setDisplayIter] = useState(0);
  const [eigenvalueDisplay, setEigenvalueDisplay] = useState(() =>
    rayleigh(meta.A, INITIAL_V),
  );
  const [converged, setConverged] = useState(false);

  // Reset the live iterate whenever the matrix preset or maxIterations change.
  useEffect(() => {
    vRef.current = INITIAL_V;
    trailRef.current = [];
    iterRef.current = 0;
    accumulatorRef.current = 0;
    convergedRef.current = false;
    setDisplayIter(0);
    setEigenvalueDisplay(rayleigh(meta.A, INITIAL_V));
    setConverged(false);
  }, [meta, state.maxIterations]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const A = meta.A;
      accumulatorRef.current += deltaMs;
      let stepped = 0;
      while (
        accumulatorRef.current >= state.stepDelay &&
        stepped < STEPS_PER_FRAME_CAP &&
        iterRef.current < state.maxIterations &&
        !convergedRef.current
      ) {
        const cur = vRef.current;
        const Av = applyMatrix(A, cur);
        const nrm = Math.hypot(Av[0], Av[1]);
        if (nrm === 0) {
          convergedRef.current = true;
          break;
        }
        let next: Vec2 = [Av[0] / nrm, Av[1] / nrm];
        // Sign-align with previous so we converge to one representative.
        if (next[0] * cur[0] + next[1] * cur[1] < 0) {
          next = [-next[0], -next[1]];
        }
        // Push previous iterate into the trail (cap at TRAIL_CAP).
        trailRef.current.push(cur);
        if (trailRef.current.length > TRAIL_CAP) trailRef.current.shift();
        // Detect convergence
        const diff = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
        if (diff < 1e-8) {
          convergedRef.current = true;
        }
        vRef.current = next;
        iterRef.current += 1;
        accumulatorRef.current -= state.stepDelay;
        stepped += 1;
      }

      // Paint
      paintBackground(ctx);
      paintEigenAxis(ctx, dominantEig);
      paintTrail(ctx, trailRef.current);
      // Av arrow (red): unnormalised image, scaled down to fit
      const Avec = applyMatrix(A, vRef.current);
      const avNrm = Math.hypot(Avec[0], Avec[1]) || 1;
      const avScale = Math.min(1, 1 / avNrm); // keep within unit-ish bounds
      paintArrow(
        ctx,
        [Avec[0] * avScale, Avec[1] * avScale],
        "rgba(207, 79, 79, 0.95)",
        2.5,
      );
      // v arrow (blue): unit
      paintArrow(ctx, vRef.current, "rgba(38, 110, 196, 0.95)", 3);

      // Cheap per-frame React updates so the HUD/counter stay live.
      if (iterRef.current !== displayIter) setDisplayIter(iterRef.current);
      const lam = rayleigh(A, normalize2(vRef.current));
      if (Math.abs(lam - eigenvalueDisplay) > 1e-6) setEigenvalueDisplay(lam);
      if (convergedRef.current !== converged) setConverged(convergedRef.current);
    },
    [
      meta,
      state.stepDelay,
      state.maxIterations,
      dominantEig,
      displayIter,
      eigenvalueDisplay,
      converged,
    ],
  );

  const handleReset = (): void => {
    reset();
    vRef.current = INITIAL_V;
    trailRef.current = [];
    iterRef.current = 0;
    accumulatorRef.current = 0;
    convergedRef.current = false;
    setDisplayIter(0);
    setEigenvalueDisplay(rayleigh(PRESET_META[DEFAULT_STATE.matrixSlug].A, INITIAL_V));
    setConverged(false);
  };

  const handlePresetSelect = (next: PowerIterationDemoState): void => {
    setState(next);
  };

  const narrationFn = useMemo(
    () => narrationTemplate(eigenvalueDisplay),
    [eigenvalueDisplay],
  );

  return (
    <div className="pi-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: PowerIterationDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Power iteration matrix presets"
      />

      <div className="pi-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Power iteration on the ${meta.label} matrix`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\lambda \\approx ${eigenvalueDisplay.toFixed(3)}`,
            `\\text{iteration } k = ${displayIter}`,
            `\\text{converged: } ${converged ? "yes" : "no"}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationFn} />

      <div className="pi-visualizer__controls">
        <SliderRow
          label="Step delay"
          description="Milliseconds between successive v ← Av/‖Av‖ steps."
          min={50}
          max={800}
          step={25}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0, unit: "ms" }}
        />
        <SliderRow
          label="Max iterations"
          description="Cap on the number of power-iteration steps before the demo halts."
          min={10}
          max={300}
          step={10}
          value={state.maxIterations}
          onChange={(maxIterations) => setState({ ...state, maxIterations })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="pi-visualizer__actions">
        <button
          type="button"
          className="pi-visualizer__btn pi-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="pi-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="pi-visualizer__counter" aria-live="off">
          iteration {displayIter}
        </span>
      </div>
    </div>
  );
}
