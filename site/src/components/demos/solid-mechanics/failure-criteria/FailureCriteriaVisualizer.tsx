import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type PrincipalStress,
  rankine,
  rankineSafetyFactor,
  rankineStress,
  tresca,
  trescaSafetyFactor,
  trescaStress,
  vonMises,
  vonMisesSafetyFactor,
  vonMisesStress,
} from "./algorithm";
import { DEFAULT_STATE, type FailureCriteriaDemoState, PRESETS } from "./presets";
import "./FailureCriteriaVisualizer.css";

/**
 * <FailureCriteriaVisualizer> — σ1–σ2 plane with Tresca, von Mises and
 * Rankine yield envelopes overlaid, plus a draggable stress-state dot.
 */

const CANVAS_W = 560;
const CANVAS_H = 420;
const PAD = 36;
const SAMPLES = 200;

const STATE_SCHEMA = {
  s1: { type: "number", default: DEFAULT_STATE.s1 },
  s2: { type: "number", default: DEFAULT_STATE.s2 },
  sy: { type: "number", default: DEFAULT_STATE.sy },
} as const satisfies Schema;

const TRESCA_COLOR = "#1f7a8c";
const VM_COLOR = "#bf6f00";
const RANKINE_COLOR = "#6a4c93";

interface Projector {
  toCanvas: (s1: number, s2: number) => readonly [number, number];
}

function makeProjector(sy: number): Projector {
  const lim = 1.5 * sy;
  const sx = (CANVAS_W - 2 * PAD) / (2 * lim);
  const sy_ = (CANVAS_H - 2 * PAD) / (2 * lim);
  return {
    toCanvas: (a, b) => [PAD + (a + lim) * sx, CANVAS_H - PAD - (b + lim) * sy_],
  };
}

function drawAxes(ctx: CanvasRenderingContext2D, proj: Projector, sy: number): void {
  ctx.save();
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.strokeStyle = "#bdbdbd";
  ctx.lineWidth = 1;
  // Gridlines at -sy, 0, +sy
  for (const t of [-sy, 0, sy]) {
    const [, y] = proj.toCanvas(0, t);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(CANVAS_W - PAD, y);
    ctx.stroke();
    const [x] = proj.toCanvas(t, 0);
    ctx.beginPath();
    ctx.moveTo(x, PAD);
    ctx.lineTo(x, CANVAS_H - PAD);
    ctx.stroke();
  }

  // Main axes
  ctx.strokeStyle = "#424242";
  ctx.lineWidth = 1.5;
  const [, y0] = proj.toCanvas(0, 0);
  ctx.beginPath();
  ctx.moveTo(PAD, y0);
  ctx.lineTo(CANVAS_W - PAD, y0);
  ctx.stroke();
  const [x0] = proj.toCanvas(0, 0);
  ctx.beginPath();
  ctx.moveTo(x0, PAD);
  ctx.lineTo(x0, CANVAS_H - PAD);
  ctx.stroke();

  ctx.fillStyle = "#424242";
  ctx.font = "12px 'JetBrains Mono Variable', monospace";
  ctx.fillText("σ1", CANVAS_W - PAD + 4, y0 + 4);
  ctx.fillText("σ2", x0 + 6, PAD - 6);
  ctx.fillText("+σy", ...labelOffset(proj.toCanvas(sy, 0), 2, -4));
  ctx.fillText("-σy", ...labelOffset(proj.toCanvas(-sy, 0), 2, -4));
  ctx.restore();
}

function labelOffset(
  p: readonly [number, number],
  dx: number,
  dy: number,
): [number, number] {
  return [p[0] + dx, p[1] + dy];
}

function drawClosedPath(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  color: string,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const first = points[0];
  if (!first) {
    ctx.restore();
    return;
  }
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (!p) continue;
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Tresca envelope vertices in (σ1, σ2) — distorted hexagon.
function trescaVertices(sy: number): ReadonlyArray<readonly [number, number]> {
  return [
    [sy, 0],
    [sy, sy],
    [0, sy],
    [-sy, 0],
    [-sy, -sy],
    [0, -sy],
  ];
}

// Rankine envelope: square |σ1|=σy, |σ2|=σy.
function rankineVertices(sy: number): ReadonlyArray<readonly [number, number]> {
  return [
    [sy, sy],
    [-sy, sy],
    [-sy, -sy],
    [sy, -sy],
  ];
}

// Von Mises ellipse: sample σ1 ∈ [-2σy/√3, +2σy/√3] (real σ2 roots), take
// the upper branch out and the lower branch back, then close.
function vonMisesCurve(sy: number): ReadonlyArray<readonly [number, number]> {
  const limit = (2 * sy) / Math.sqrt(3);
  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const s1 = -limit + (2 * limit * i) / SAMPLES;
    const disc = Math.max(0, 4 * sy * sy - 3 * s1 * s1);
    const s2 = (s1 + Math.sqrt(disc)) / 2;
    pts.push([s1, s2]);
  }
  for (let i = SAMPLES; i >= 0; i -= 1) {
    const s1 = -limit + (2 * limit * i) / SAMPLES;
    const disc = Math.max(0, 4 * sy * sy - 3 * s1 * s1);
    const s2 = (s1 - Math.sqrt(disc)) / 2;
    pts.push([s1, s2]);
  }
  return pts;
}

function projectAll(
  pts: ReadonlyArray<readonly [number, number]>,
  proj: Projector,
): ReadonlyArray<readonly [number, number]> {
  return pts.map(([a, b]) => proj.toCanvas(a, b));
}

function safeOverallColor(trescaOk: boolean, vmOk: boolean, rankineOk: boolean): string {
  const passes = (trescaOk ? 1 : 0) + (vmOk ? 1 : 0) + (rankineOk ? 1 : 0);
  if (passes === 3) return "#2e7d32"; // green: safe under all
  if (passes === 0) return "#c62828"; // red: failed under all
  return "#ef6c00"; // orange: failed under some
}

function fmtSF(sf: number): string {
  if (!Number.isFinite(sf)) return "∞";
  if (sf >= 100) return sf.toFixed(0);
  return sf.toFixed(2);
}

export function FailureCriteriaVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "failure-criteria",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const p: PrincipalStress = useMemo(
    () => ({ s1: state.s1, s2: state.s2 }),
    [state.s1, state.s2],
  );

  const trescaEq = trescaStress(p);
  const vmEq = vonMisesStress(p);
  const rankineEq = rankineStress(p);
  const sfT = trescaSafetyFactor(p, state.sy);
  const sfV = vonMisesSafetyFactor(p, state.sy);
  const sfR = rankineSafetyFactor(p, state.sy);
  const failT = tresca(p, state.sy);
  const failV = vonMises(p, state.sy);
  const failR = rankine(p, state.sy);
  const minSF = Math.min(sfT, sfV, sfR);

  const failingCriteria = [
    failT ? "Tresca" : null,
    failV ? "von Mises" : null,
    failR ? "Rankine" : null,
  ].filter((s): s is string => s !== null);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const proj = makeProjector(state.sy);
      drawAxes(ctx, proj, state.sy);

      // Envelopes
      drawClosedPath(ctx, projectAll(trescaVertices(state.sy), proj), TRESCA_COLOR);
      drawClosedPath(ctx, projectAll(vonMisesCurve(state.sy), proj), VM_COLOR);
      drawClosedPath(ctx, projectAll(rankineVertices(state.sy), proj), RANKINE_COLOR);

      // Stress-state dot
      const [cx, cy] = proj.toCanvas(state.s1, state.s2);
      ctx.save();
      ctx.fillStyle = safeOverallColor(!failT, !failV, !failR);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
    [state.s1, state.s2, state.sy, failT, failV, failR],
  );

  const handleReset = (): void => {
    reset();
  };

  return (
    <div className="fc-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: FailureCriteriaDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={(next) => setState(next)}
        ariaLabel="Failure criteria presets"
      />

      <div className="fc-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel="σ1–σ2 plane with Tresca, von Mises and Rankine yield envelopes"
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\sigma_{eq}^{T} = ${trescaEq.toFixed(0)}`,
            `\\sigma_{eq}^{VM} = ${vmEq.toFixed(0)}`,
            `\\sigma_{eq}^{R} = ${rankineEq.toFixed(0)}`,
            `SF_T = ${fmtSF(sfT)}`,
            `SF_{VM} = ${fmtSF(sfV)}`,
            `SF_R = ${fmtSF(sfR)}`,
          ]}
        />
      </div>

      <div className="fc-visualizer__legend" aria-hidden="true">
        <span>
          <span
            className="fc-visualizer__legend-swatch"
            style={{ background: TRESCA_COLOR }}
          />
          Tresca
        </span>
        <span>
          <span
            className="fc-visualizer__legend-swatch"
            style={{ background: VM_COLOR }}
          />
          von Mises
        </span>
        <span>
          <span
            className="fc-visualizer__legend-swatch"
            style={{ background: RANKINE_COLOR }}
          />
          Rankine
        </span>
        <span>
          Failing: {failingCriteria.length === 0 ? "none" : failingCriteria.join(", ")}
        </span>
      </div>

      <div className="fc-visualizer__controls">
        <SliderRow
          label="σ1 (MPa)"
          description="First principal stress."
          min={-300}
          max={300}
          step={10}
          value={state.s1}
          onChange={(s1) => setState({ ...state, s1 })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="σ2 (MPa)"
          description="Second principal stress."
          min={-300}
          max={300}
          step={10}
          value={state.s2}
          onChange={(s2) => setState({ ...state, s2 })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="σy yield (MPa)"
          description="Material yield strength."
          min={50}
          max={500}
          step={10}
          value={state.sy}
          onChange={(sy) => setState({ ...state, sy })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="fc-visualizer__actions">
        <button type="button" className="fc-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="fc-visualizer__counter" aria-live="off">
          min SF = {fmtSF(minSF)} (Tresca {fmtSF(sfT)} · von Mises {fmtSF(sfV)} · Rankine{" "}
          {fmtSF(sfR)})
        </span>
      </div>
    </div>
  );
}

export default FailureCriteriaVisualizer;
