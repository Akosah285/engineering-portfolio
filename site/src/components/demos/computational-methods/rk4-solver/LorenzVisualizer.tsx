import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type TrajectoryPoint, rk4Integrate } from "./algorithm";
import {
  DEFAULT_STATE,
  type OdeSystem,
  PRESETS,
  type Rk4DemoState,
  SYSTEM_SLUGS,
  getSystem,
} from "./presets";
import "./LorenzVisualizer.css";

/**
 * <LorenzVisualizer> — the v5 hero RK4 demo (#76).
 *
 * Pre-computes a full trajectory with `rk4Integrate` whenever the system,
 * dt, or tEnd changes, then reveals `speed` points per animation frame
 * onto a 2D projection of the n-dimensional state.
 */

const STATE_SCHEMA = {
  systemSlug: {
    type: "enum",
    default: DEFAULT_STATE.systemSlug,
    values: SYSTEM_SLUGS,
  },
  dt: { type: "number", default: DEFAULT_STATE.dt },
  tEnd: { type: "number", default: DEFAULT_STATE.tEnd },
  speed: { type: "number", default: DEFAULT_STATE.speed },
} as const satisfies Schema;

const narrationTemplate = (state: Rk4DemoState): string => {
  const system = getSystem(state.systemSlug);
  return `RK4 trajectory for the ${system.name.toLowerCase()} system, integrated with step size dt = ${state.dt.toFixed(3)} from t = 0 to t = ${state.tEnd.toFixed(0)}. ${system.note}`;
};

interface Projector {
  toCanvas: (x: number, y: number) => readonly [number, number];
}

function makeProjector(system: OdeSystem, width: number, height: number): Projector {
  const [xMin, xMax] = system.xRange;
  const [yMin, yMax] = system.yRange;
  const sx = width / (xMax - xMin);
  const sy = height / (yMax - yMin);
  return {
    toCanvas: (x, y) => [(x - xMin) * sx, height - (y - yMin) * sy],
  };
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  system: OdeSystem,
  proj: Projector,
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(60, 60, 60, 0.25)";
  ctx.lineWidth = 1;
  // x-axis (y = 0 in system coords, if in range)
  const [yMin, yMax] = system.yRange;
  if (yMin <= 0 && yMax >= 0) {
    const [, y0] = proj.toCanvas(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(width, y0);
    ctx.stroke();
  }
  // y-axis (x = 0 in system coords, if in range)
  const [xMin, xMax] = system.xRange;
  if (xMin <= 0 && xMax >= 0) {
    const [x0] = proj.toCanvas(0, yMin);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, height);
    ctx.stroke();
  }

  // Outer frame
  ctx.strokeStyle = "rgba(60, 60, 60, 0.4)";
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function paintTrajectory(
  ctx: CanvasRenderingContext2D,
  system: OdeSystem,
  proj: Projector,
  trajectory: readonly TrajectoryPoint[],
  upTo: number,
): void {
  if (upTo <= 0) return;

  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 0; i <= upTo && i < trajectory.length; i += 1) {
    const point = trajectory[i]!;
    const [px, py] = system.project(point.y);
    const [cx, cy] = proj.toCanvas(px, py);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  const head = trajectory[Math.min(upTo, trajectory.length - 1)];
  if (head) {
    const [px, py] = system.project(head.y);
    const [cx, cy] = proj.toCanvas(px, py);
    ctx.fillStyle = "#00693e";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function LorenzVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "rk4-solver",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const system = useMemo(() => getSystem(state.systemSlug), [state.systemSlug]);

  // Pre-compute the full trajectory whenever the system, dt, or tEnd change.
  const trajectory = useMemo<TrajectoryPoint[]>(() => {
    try {
      return rk4Integrate({
        f: system.f,
        t0: 0,
        y0: system.y0,
        tEnd: state.tEnd,
        dt: state.dt,
      });
    } catch {
      return [{ t: 0, y: system.y0.slice() }];
    }
  }, [system, state.dt, state.tEnd]);

  const totalPoints = trajectory.length;
  const idxRef = useRef(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Reset the animation whenever the trajectory changes.
  useEffect(() => {
    idxRef.current = 0;
    setCurrentIdx(0);
  }, [trajectory]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const proj = makeProjector(system, ctx.canvas.width, ctx.canvas.height);
      paintAxes(ctx, system, proj);

      const maxIdx = totalPoints - 1;
      const next = Math.min(maxIdx, idxRef.current + state.speed);
      if (next !== idxRef.current) {
        idxRef.current = next;
        setCurrentIdx(next);
      }

      paintTrajectory(ctx, system, proj, trajectory, idxRef.current);
    },
    [system, trajectory, totalPoints, state.speed],
  );

  const safeIdx = Math.min(currentIdx, Math.max(0, totalPoints - 1));
  const headPoint = trajectory[safeIdx];
  const [hx, hy] = headPoint
    ? system.project(headPoint.y)
    : ([0, 0] as readonly [number, number]);
  const tNow = headPoint ? headPoint.t : 0;

  const handleReset = (): void => {
    reset();
    idxRef.current = 0;
    setCurrentIdx(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="lz-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="RK4 ODE presets"
      />

      <div className="lz-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`RK4 trajectory for the ${system.name.toLowerCase()} system`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `t = ${tNow.toFixed(2)}`,
            `(${system.xLabel}, ${system.yLabel}) = (${hx.toFixed(2)}, ${hy.toFixed(2)})`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="lz-visualizer__controls">
        <SliderRow
          label="dt (integration step)"
          description="Smaller dt → more accurate RK4 integration but more total work."
          min={0.001}
          max={0.05}
          step={0.001}
          value={state.dt}
          onChange={(dt) => setState({ ...state, dt })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Integration time t_end"
          description="How far in simulated time to integrate forward from t = 0."
          min={1}
          max={100}
          step={1}
          value={state.tEnd}
          onChange={(tEnd) => setState({ ...state, tEnd })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Speed (points / frame)"
          description="How many trajectory samples are revealed per animation frame."
          min={1}
          max={100}
          step={1}
          value={state.speed}
          onChange={(speed) => setState({ ...state, speed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="lz-visualizer__actions">
        <button
          type="button"
          className="lz-visualizer__btn lz-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="lz-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="lz-visualizer__counter" aria-live="off">
          step {currentIdx} / {totalPoints}
        </span>
      </div>
    </div>
  );
}
