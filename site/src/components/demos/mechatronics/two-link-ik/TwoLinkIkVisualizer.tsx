import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  forwardKinematics,
  inverseKinematics,
  workspaceInnerRadius,
  workspaceOuterRadius,
} from "./algorithm";
import {
  DEFAULT_STATE,
  ELBOW_CHOICES,
  PATH_LABELS,
  PATH_SLUGS,
  PRESETS,
  type TwoLinkIkDemoState,
  getPath,
} from "./presets";
import "./TwoLinkIkVisualizer.css";

/**
 * <TwoLinkIkVisualizer> — 2-link planar arm chasing a moving target.
 *
 * Wraps the pure `algorithm.ts` brain (FK + IK) with the demo-kit primitives
 * so a reader can pick a parametric path, tweak link lengths and elbow
 * preference, and watch how IK reachability evolves over time.
 */

const TRAIL_SECONDS = 3;
const TRAIL_SAMPLES = 90; // ≈ 30 fps × 3 s
const PATH_PREVIEW_SAMPLES = 240;

const STATE_SCHEMA = {
  pathSlug: { type: "enum", default: DEFAULT_STATE.pathSlug, values: PATH_SLUGS },
  l1: { type: "number", default: DEFAULT_STATE.l1 },
  l2: { type: "number", default: DEFAULT_STATE.l2 },
  elbow: { type: "enum", default: DEFAULT_STATE.elbow, values: ELBOW_CHOICES },
  cycleSpeed: { type: "number", default: DEFAULT_STATE.cycleSpeed },
} as const satisfies Schema;

const narrationTemplate = (state: TwoLinkIkDemoState): string => {
  const path = PATH_LABELS[state.pathSlug];
  return `Two-link planar arm with link lengths L1 = ${state.l1.toFixed(2)} and L2 = ${state.l2.toFixed(2)}, solving inverse kinematics for the elbow-${state.elbow} configuration as the target traces a ${path} at ${state.cycleSpeed.toFixed(2)} cycles per second.`;
};

/** World → canvas projector (square aspect, centred on origin). */
function projector(width: number, height: number, reach: number) {
  const margin = reach + 0.5;
  const worldSpan = 2 * margin;
  const scale = Math.min(width / worldSpan, height / worldSpan);
  const cx = width / 2;
  const cy = height / 2;
  return {
    toCanvas: (x: number, y: number): readonly [number, number] => [
      cx + x * scale,
      cy - y * scale,
    ],
    scale,
  };
}

function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#f7f5f2";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function TwoLinkIkVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "two-link-ik",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const pathFn = useMemo(() => getPath(state.pathSlug), [state.pathSlug]);

  const tRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number; reachable: boolean }[]>([]);
  const hudRef = useRef({
    targetX: 0,
    targetY: 0,
    theta1Deg: 0,
    theta2Deg: 0,
    reachable: true,
  });
  const [paused, setPaused] = useState(false);
  const [tDisplay, setTDisplay] = useState(0);

  // Reset clock + trail whenever any control changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps; body resets refs/state and doesn't read the listed state.* values
  useEffect(() => {
    tRef.current = 0;
    trailRef.current = [];
    setTDisplay(0);
  }, [state.pathSlug, state.l1, state.l2, state.elbow, state.cycleSpeed]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: state.pathSlug feeds into pathFn (already a dep); keeping it explicit in the dep array documents the cause-effect chain and matches the reset-effect deps above
  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      const reach = state.l1 + state.l2;
      const proj = projector(width, height, reach);

      clearCanvas(ctx);

      // Advance t at `cycleSpeed` cycles/sec.
      tRef.current = (tRef.current + (deltaMs / 1000) * state.cycleSpeed) % 1;
      const t = tRef.current;

      // Workspace annulus.
      const outer = workspaceOuterRadius(state.l1, state.l2);
      const inner = workspaceInnerRadius(state.l1, state.l2);
      const [ox, oy] = proj.toCanvas(0, 0);
      ctx.strokeStyle = "#b8b3ad";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, outer * proj.scale, 0, Math.PI * 2);
      ctx.stroke();
      if (inner > 1e-6) {
        ctx.beginPath();
        ctx.arc(ox, oy, inner * proj.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Path preview (faint grey).
      ctx.strokeStyle = "rgba(120, 115, 110, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= PATH_PREVIEW_SAMPLES; i += 1) {
        const u = i / PATH_PREVIEW_SAMPLES;
        const p = pathFn(u);
        const [cx, cy] = proj.toCanvas(p.x, p.y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Current target.
      const target = pathFn(t);
      const ik = inverseKinematics({
        x: target.x,
        y: target.y,
        l1: state.l1,
        l2: state.l2,
        elbow: state.elbow,
      });

      // Append to trail.
      trailRef.current.push({ x: target.x, y: target.y, reachable: ik.reachable });
      if (trailRef.current.length > TRAIL_SAMPLES) {
        trailRef.current.splice(0, trailRef.current.length - TRAIL_SAMPLES);
      }

      // Render trail with fading alpha.
      const trail = trailRef.current;
      for (let i = 0; i < trail.length; i += 1) {
        const point = trail[i]!;
        const alpha = (i + 1) / trail.length;
        const [cx, cy] = proj.toCanvas(point.x, point.y);
        ctx.fillStyle = point.reachable
          ? `rgba(0, 105, 62, ${0.15 + 0.35 * alpha})`
          : `rgba(207, 79, 79, ${0.15 + 0.45 * alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Both IK solutions overlay (when both available, draw secondary first
      // in a muted style so the primary pops on top).
      if (ik.reachable && ik.poses.length === 2) {
        const otherElbow = state.elbow === "up" ? "down" : "up";
        const other = inverseKinematics({
          x: target.x,
          y: target.y,
          l1: state.l1,
          l2: state.l2,
          elbow: otherElbow,
        });
        const otherPose = other.poses[0];
        if (otherPose) {
          const fk = forwardKinematics({
            theta1: otherPose.theta1,
            theta2: otherPose.theta2,
            l1: state.l1,
            l2: state.l2,
          });
          const [sx, sy] = proj.toCanvas(0, 0);
          const [ex, ey] = proj.toCanvas(fk.elbow.x, fk.elbow.y);
          const [tx, ty] = proj.toCanvas(fk.x, fk.y);
          ctx.strokeStyle = "rgba(120, 115, 110, 0.55)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }

      // Primary pose: render arm; if unreachable, point toward target.
      const primary = ik.reachable
        ? ik.poses[0]
        : (() => {
            const phi = Math.atan2(target.y, target.x);
            return { theta1: phi, theta2: 0 };
          })();

      let tipWorld = { x: target.x, y: target.y };
      let elbowWorld = { x: 0, y: 0 };
      let primaryDeg = { theta1: 0, theta2: 0 };
      if (primary) {
        const fk = forwardKinematics({
          theta1: primary.theta1,
          theta2: primary.theta2,
          l1: state.l1,
          l2: state.l2,
        });
        tipWorld = { x: fk.x, y: fk.y };
        elbowWorld = fk.elbow;
        primaryDeg = {
          theta1: (primary.theta1 * 180) / Math.PI,
          theta2: (primary.theta2 * 180) / Math.PI,
        };
      }

      const [sx, sy] = proj.toCanvas(0, 0);
      const [ex, ey] = proj.toCanvas(elbowWorld.x, elbowWorld.y);
      const [tx, ty] = proj.toCanvas(tipWorld.x, tipWorld.y);

      const armColor = ik.reachable ? "#1f3a68" : "#cf4f4f";
      ctx.strokeStyle = armColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Joints.
      ctx.fillStyle = "#1f3a68"; // shoulder = blue
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d98a3a"; // elbow = orange
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#00693e"; // tip = green
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.fill();

      // Current target dot (red).
      const [rx, ry] = proj.toCanvas(target.x, target.y);
      ctx.fillStyle = ik.reachable ? "#cf4f4f" : "#cf4f4f";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Stash latest readings for the HUD render below.
      hudRef.current = {
        targetX: target.x,
        targetY: target.y,
        theta1Deg: primaryDeg.theta1,
        theta2Deg: primaryDeg.theta2,
        reachable: ik.reachable,
      };
      setTDisplay(t);
    },
    [state.pathSlug, state.l1, state.l2, state.elbow, state.cycleSpeed, pathFn],
  );

  const hud = hudRef.current;

  const handleReset = (): void => {
    reset();
    tRef.current = 0;
    trailRef.current = [];
    setTDisplay(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="ik-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Two-link IK presets"
      />

      <div className="ik-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Two-link arm tracking a ${PATH_LABELS[state.pathSlug]} target`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{target} = (${hud.targetX.toFixed(2)}, ${hud.targetY.toFixed(2)})`,
            `\\theta_1 = ${hud.theta1Deg.toFixed(1)}^\\circ`,
            `\\theta_2 = ${hud.theta2Deg.toFixed(1)}^\\circ`,
            `\\text{reachable: ${hud.reachable ? "yes" : "no"}}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ik-visualizer__controls">
        <SliderRow
          label="L1"
          description="Length of the upper arm (shoulder → elbow)."
          min={0.5}
          max={2.0}
          step={0.1}
          value={state.l1}
          onChange={(l1) => setState({ ...state, l1 })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="L2"
          description="Length of the forearm (elbow → tip)."
          min={0.5}
          max={2.0}
          step={0.1}
          value={state.l2}
          onChange={(l2) => setState({ ...state, l2 })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Cycle speed"
          description="How many target-path cycles to traverse per second."
          min={0.1}
          max={3.0}
          step={0.1}
          value={state.cycleSpeed}
          onChange={(cycleSpeed) => setState({ ...state, cycleSpeed })}
          format={{ precision: 2 }}
        />
        <label className="ik-visualizer__elbow-toggle">
          Elbow
          <select
            value={state.elbow}
            onChange={(event) =>
              setState({
                ...state,
                elbow: event.target.value === "down" ? "down" : "up",
              })
            }
          >
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </label>
      </div>

      <div className="ik-visualizer__actions">
        <button
          type="button"
          className="ik-visualizer__btn ik-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="ik-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="ik-visualizer__counter" aria-live="off">
          t = {tDisplay.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
