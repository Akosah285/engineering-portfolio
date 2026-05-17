import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type DescentState, gradientDescentStep, isConverged } from "./algorithm";
import { DEFAULT_STATE, type DescentDemoState, PRESETS } from "./presets";
import { SURFACE_SLUGS, type Surface, getSurface } from "./surfaces";
import "./GradientDescentVisualizer.css";

/**
 * <GradientDescentVisualizer> — the v1 hero ML demo (plan §4.1, #24).
 *
 * Wires every demo-kit primitive together to visualise momentum-augmented
 * gradient descent on one of four named loss surfaces.
 */

const MAX_TRAJECTORY = 400;
const TARGET_STEPS_PER_SECOND = 30;

const STATE_SCHEMA = {
  surface: {
    type: "enum",
    default: DEFAULT_STATE.surface,
    values: SURFACE_SLUGS,
  },
  lr: { type: "number", default: DEFAULT_STATE.lr },
  momentum: { type: "number", default: DEFAULT_STATE.momentum },
  startX: { type: "number", default: DEFAULT_STATE.startX },
  startY: { type: "number", default: DEFAULT_STATE.startY },
} as const satisfies Schema;

const narrationTemplate = (state: DescentDemoState): string => {
  const surface = getSurface(state.surface);
  return `Gradient descent on the ${surface.name.toLowerCase()} surface, starting at (${state.startX.toFixed(1)}, ${state.startY.toFixed(1)}) with learning rate ${state.lr.toFixed(3)} and momentum ${state.momentum.toFixed(2)}, descending toward the minimum at (${surface.minimum.x}, ${surface.minimum.y}).`;
};

/** Project (x, y) in surface coordinates to (cx, cy) in canvas pixels. */
function projector(surface: Surface, width: number, height: number) {
  const { xMin, xMax, yMin, yMax } = surface.bounds;
  const sx = width / (xMax - xMin);
  const sy = height / (yMax - yMin);
  return {
    toCanvas: (x: number, y: number): readonly [number, number] => [
      (x - xMin) * sx,
      height - (y - yMin) * sy,
    ],
  };
}

/** Render a contour-shaded background of the loss surface to the canvas. */
function paintContours(ctx: CanvasRenderingContext2D, surface: Surface): void {
  const { width, height } = ctx.canvas;
  const { xMin, xMax, yMin, yMax } = surface.bounds;
  // Sample at low resolution for cheap shading; 80x60 gridcells max.
  const cols = 80;
  const rows = Math.max(1, Math.round(cols * (height / width)));
  const cellW = width / cols;
  const cellH = height / rows;

  // Compute loss range over a coarse pre-pass for normalisation.
  let minL = Number.POSITIVE_INFINITY;
  let maxL = Number.NEGATIVE_INFINITY;
  const samples: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = xMin + ((c + 0.5) / cols) * (xMax - xMin);
      const y = yMax - ((r + 0.5) / rows) * (yMax - yMin);
      const l = surface.loss(x, y);
      samples.push(l);
      if (Number.isFinite(l)) {
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
    }
  }
  const range = maxL - minL || 1;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const l = samples[r * cols + c];
      if (l === undefined || !Number.isFinite(l)) continue;
      // Compress dynamic range with sqrt
      const t = Math.sqrt(Math.max(0, (l - minL) / range));
      // Pine-tinted colour ramp: low = light, high = dark
      const grey = Math.round(248 - t * 130);
      const green = Math.round(245 - t * 110);
      ctx.fillStyle = `rgb(${grey}, ${green}, ${grey})`;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    }
  }

  // Mark the minimum
  const proj = projector(surface, width, height);
  const [cx, cy] = proj.toCanvas(surface.minimum.x, surface.minimum.y);
  ctx.fillStyle = "rgba(207, 79, 79, 0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** Paint the trajectory poly-line + the current iterate as a filled dot. */
function paintTrajectory(
  ctx: CanvasRenderingContext2D,
  surface: Surface,
  trajectory: readonly DescentState[],
): void {
  const { width, height } = ctx.canvas;
  const proj = projector(surface, width, height);

  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  trajectory.forEach((p, i) => {
    const [cx, cy] = proj.toCanvas(p.x, p.y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  const last = trajectory[trajectory.length - 1];
  if (last) {
    const [cx, cy] = proj.toCanvas(last.x, last.y);
    ctx.fillStyle = "#00693e";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function GradientDescentVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "gradient-descent",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const surface = useMemo(() => getSurface(state.surface), [state.surface]);

  // Trajectory + accumulated step time live in refs so the draw loop
  // can mutate them without re-rendering React on every frame.
  const trajRef = useRef<DescentState[]>([
    { x: state.startX, y: state.startY, vx: 0, vy: 0 },
  ]);
  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  // Reset trajectory whenever any control or surface changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger deps; body resets refs/state and only reads state.startX/startY (both listed)
  useEffect(() => {
    trajRef.current = [{ x: state.startX, y: state.startY, vx: 0, vy: 0 }];
    accumulatorRef.current = 0;
    setStepCount(0);
  }, [state.surface, state.lr, state.momentum, state.startX, state.startY]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      paintContours(ctx, surface);
      // Advance the trajectory by `n` steps based on elapsed time
      const stepInterval = 1000 / TARGET_STEPS_PER_SECOND;
      accumulatorRef.current += deltaMs;
      let n = 0;
      while (accumulatorRef.current >= stepInterval && n < 5) {
        accumulatorRef.current -= stepInterval;
        n += 1;
        const cur = trajRef.current[trajRef.current.length - 1];
        if (!cur) break;
        if (isConverged(cur, surface.grad)) break;
        if (trajRef.current.length >= MAX_TRAJECTORY) break;
        const next = gradientDescentStep(cur, surface.grad, {
          lr: state.lr,
          momentum: state.momentum,
        });
        if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) break;
        trajRef.current.push(next);
      }
      if (n > 0) setStepCount((s) => s + n);
      paintTrajectory(ctx, surface, trajRef.current);
    },
    [surface, state.lr, state.momentum],
  );

  const last = trajRef.current[trajRef.current.length - 1] ?? {
    x: state.startX,
    y: state.startY,
    vx: 0,
    vy: 0,
  };
  const currentLoss = surface.loss(last.x, last.y);
  const [gx, gy] = surface.grad(last.x, last.y);
  const gradNorm = Math.hypot(gx, gy);

  const handleReset = (): void => {
    reset();
    trajRef.current = [
      { x: DEFAULT_STATE.startX, y: DEFAULT_STATE.startY, vx: 0, vy: 0 },
    ];
    setStepCount(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="gd-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Gradient descent presets"
      />

      <div className="gd-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Gradient descent trajectory on the ${surface.name.toLowerCase()} surface`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `L = ${currentLoss.toFixed(3)}`,
            `\\|\\nabla L\\| = ${gradNorm.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="gd-visualizer__controls">
        <SliderRow
          label="Learning rate η"
          description="How big each gradient step is. Too small → slow; too big → overshoots."
          min={0.001}
          max={0.5}
          step={0.001}
          value={state.lr}
          onChange={(lr) => setState({ ...state, lr })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Momentum β"
          description="0 = vanilla GD; 0.9 typically accelerates over flat valleys."
          min={0}
          max={0.99}
          step={0.01}
          value={state.momentum}
          onChange={(momentum) => setState({ ...state, momentum })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Start x"
          min={surface.bounds.xMin}
          max={surface.bounds.xMax}
          step={0.1}
          value={state.startX}
          onChange={(startX) => setState({ ...state, startX })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Start y"
          min={surface.bounds.yMin}
          max={surface.bounds.yMax}
          step={0.1}
          value={state.startY}
          onChange={(startY) => setState({ ...state, startY })}
          format={{ precision: 2 }}
        />
      </div>

      <div className="gd-visualizer__actions">
        <button
          type="button"
          className="gd-visualizer__btn gd-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="gd-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="gd-visualizer__counter" aria-live="off">
          step {stepCount} / {MAX_TRAJECTORY}
        </span>
      </div>
    </div>
  );
}
