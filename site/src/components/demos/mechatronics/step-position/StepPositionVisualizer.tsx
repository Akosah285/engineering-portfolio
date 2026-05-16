import { useCallback, useMemo, useRef } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type StepPlanInput, plan } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  type StepPositionDemoState,
  USE_TRAPEZOIDAL_VALUES,
  type UseTrapezoidal,
} from "./presets";
import "./StepPositionVisualizer.css";

/**
 * <StepPositionVisualizer> — two-panel visualisation of the trapezoidal
 * step-position planner (lab step_position.ino).
 */

const STATE_SCHEMA = {
  currentTicks: { type: "number", default: DEFAULT_STATE.currentTicks },
  targetTicks: { type: "number", default: DEFAULT_STATE.targetTicks },
  maxStepsPerSec: { type: "number", default: DEFAULT_STATE.maxStepsPerSec },
  accel: { type: "number", default: DEFAULT_STATE.accel },
  useTrapezoidal: {
    type: "enum",
    default: DEFAULT_STATE.useTrapezoidal,
    values: USE_TRAPEZOIDAL_VALUES,
  },
} as const satisfies Schema;

function buildInput(state: StepPositionDemoState): StepPlanInput {
  const base: StepPlanInput = {
    currentTicks: Math.round(state.currentTicks),
    targetTicks: Math.round(state.targetTicks),
    maxStepsPerSec: state.maxStepsPerSec,
    ...(state.useTrapezoidal === "on" ? { accelStepsPerSecSq: state.accel } : {}),
  };
  return base;
}

function directionGlyph(direction: 1 | -1 | 0): string {
  if (direction === 1) return "↑";
  if (direction === -1) return "↓";
  return "—";
}

export default function StepPositionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "step-position",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const stepPlan = useMemo(() => {
    try {
      return plan(buildInput(state));
    } catch {
      return plan({
        currentTicks: 0,
        targetTicks: 0,
        maxStepsPerSec: state.maxStepsPerSec,
      });
    }
  }, [state]);

  // Derived velocity samples: v(t) = 1/dt between consecutive event timestamps.
  const velocitySamples = useMemo(() => {
    const events = stepPlan.events;
    const out: { t: number; v: number }[] = [];
    for (let i = 1; i < events.length; i += 1) {
      const prev = events[i - 1]!;
      const cur = events[i]!;
      const dt = cur.t - prev.t;
      if (dt > 0) {
        out.push({ t: (cur.t + prev.t) / 2, v: 1 / dt });
      }
    }
    return out;
  }, [stepPlan]);

  const vMaxActual = useMemo(
    () => velocitySamples.reduce((m, s) => (s.v > m ? s.v : m), 0),
    [velocitySamples],
  );

  // Cursor time animates in a ref so the canvas redraws don't trigger React renders.
  const cursorTRef = useRef(0);
  const loopRestartRef = useRef(0);
  loopRestartRef.current = stepPlan.elapsed;

  const drawPosition: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const events = stepPlan.events;
      const elapsed = stepPlan.elapsed;
      const tMax = elapsed > 0 ? elapsed : 1;

      // Advance cursor.
      cursorTRef.current += deltaMs / 1000;
      if (cursorTRef.current > tMax) cursorTRef.current = 0;

      // Bounds for position axis.
      let posMin = Math.min(state.currentTicks, state.targetTicks);
      let posMax = Math.max(state.currentTicks, state.targetTicks);
      for (const e of events) {
        if (e.position < posMin) posMin = e.position;
        if (e.position > posMax) posMax = e.position;
      }
      if (posMin === posMax) {
        posMin -= 1;
        posMax += 1;
      }
      const pad = (posMax - posMin) * 0.1;
      posMin -= pad;
      posMax += pad;

      const padL = 36;
      const padR = 10;
      const padT = 10;
      const padB = 22;
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;

      const toX = (t: number): number => padL + (t / tMax) * plotW;
      const toY = (p: number): number =>
        padT + plotH - ((p - posMin) / (posMax - posMin)) * plotH;

      // Axes.
      ctx.strokeStyle = "#cfd8d0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      // Target dashed horizontal.
      ctx.strokeStyle = "#cf4f4f";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const yTarget = toY(state.targetTicks);
      ctx.moveTo(padL, yTarget);
      ctx.lineTo(padL + plotW, yTarget);
      ctx.stroke();
      ctx.setLineDash([]);

      // Staircase line through events.
      ctx.strokeStyle = "#00693e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      events.forEach((e, i) => {
        const x = toX(e.t);
        const y = toY(e.position);
        if (i === 0) ctx.moveTo(x, y);
        else {
          // Staircase: horizontal then vertical.
          const prev = events[i - 1]!;
          ctx.lineTo(toX(e.t), toY(prev.position));
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Cursor vertical line.
      ctx.strokeStyle = "#314f3a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const xc = toX(cursorTRef.current);
      ctx.moveTo(xc, padT);
      ctx.lineTo(xc, padT + plotH);
      ctx.stroke();

      // Labels.
      ctx.fillStyle = "#5a7a5f";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("pos", 4, padT + 10);
      ctx.fillText("t", padL + plotW - 8, padT + plotH + 14);
    },
    [stepPlan, state.currentTicks, state.targetTicks],
  );

  const drawVelocity: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const elapsed = stepPlan.elapsed;
      const tMax = elapsed > 0 ? elapsed : 1;
      const vMax = Math.max(state.maxStepsPerSec, vMaxActual) * 1.1 || 1;

      const padL = 36;
      const padR = 10;
      const padT = 10;
      const padB = 22;
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;

      const toX = (t: number): number => padL + (t / tMax) * plotW;
      const toY = (v: number): number => padT + plotH - (v / vMax) * plotH;

      ctx.strokeStyle = "#cfd8d0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      // maxStepsPerSec dashed.
      ctx.strokeStyle = "#cf4f4f";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const yMax = toY(state.maxStepsPerSec);
      ctx.moveTo(padL, yMax);
      ctx.lineTo(padL + plotW, yMax);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#00693e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      velocitySamples.forEach((s, i) => {
        const x = toX(s.t);
        const y = toY(s.v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Cursor vertical line.
      ctx.strokeStyle = "#314f3a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const xc = toX(cursorTRef.current);
      ctx.moveTo(xc, padT);
      ctx.lineTo(xc, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = "#5a7a5f";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("v", 4, padT + 10);
      ctx.fillText("t", padL + plotW - 8, padT + plotH + 14);
    },
    [stepPlan, state.maxStepsPerSec, velocitySamples, vMaxActual],
  );

  const handlePresetSelect = (next: StepPositionDemoState): void => {
    cursorTRef.current = 0;
    setState(next);
  };

  const handleReset = (): void => {
    cursorTRef.current = 0;
    reset();
  };

  const trapIndex = USE_TRAPEZOIDAL_VALUES.indexOf(state.useTrapezoidal);

  return (
    <div className="sp-visualizer">
      <PresetCarousel
        presets={PRESETS.map((p) => ({ name: p.name, state: p.state }))}
        onSelect={handlePresetSelect}
        ariaLabel="Step-position presets"
      />

      <div className="sp-visualizer__panels">
        <div className="sp-visualizer__panel">
          <div className="sp-visualizer__panel-title">Position vs time</div>
          <DemoCanvas
            width={420}
            height={240}
            ariaLabel="Position versus time staircase plot"
            draw={drawPosition}
          />
        </div>
        <div className="sp-visualizer__panel">
          <div className="sp-visualizer__panel-title">Velocity vs time</div>
          <DemoCanvas
            width={420}
            height={240}
            ariaLabel="Instantaneous velocity versus time"
            draw={drawVelocity}
          />
        </div>
      </div>

      <div className="sp-visualizer__hud">
        <div className="sp-visualizer__hud-item">
          <span className="sp-visualizer__hud-label">Direction</span>
          <span className="sp-visualizer__hud-value">
            {directionGlyph(stepPlan.direction)}
          </span>
        </div>
        <div className="sp-visualizer__hud-item">
          <span className="sp-visualizer__hud-label">Total steps</span>
          <span className="sp-visualizer__hud-value">{stepPlan.totalSteps}</span>
        </div>
        <div className="sp-visualizer__hud-item">
          <span className="sp-visualizer__hud-label">Elapsed</span>
          <span className="sp-visualizer__hud-value">
            {stepPlan.elapsed.toFixed(3)} s
          </span>
        </div>
        <div className="sp-visualizer__hud-item">
          <span className="sp-visualizer__hud-label">vMax actual</span>
          <span className="sp-visualizer__hud-value">{vMaxActual.toFixed(1)} st/s</span>
        </div>
      </div>

      <div className="sp-visualizer__controls">
        <SliderRow
          label="Current ticks (start)"
          min={-100}
          max={100}
          step={5}
          value={state.currentTicks}
          onChange={(currentTicks) => setState({ ...state, currentTicks })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Target ticks"
          min={-100}
          max={100}
          step={5}
          value={state.targetTicks}
          onChange={(targetTicks) => setState({ ...state, targetTicks })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="maxStepsPerSec (rate)"
          min={10}
          max={500}
          step={10}
          value={state.maxStepsPerSec}
          onChange={(maxStepsPerSec) => setState({ ...state, maxStepsPerSec })}
          format={{ precision: 0, unit: "st/s" }}
        />
        <SliderRow
          label="Accel"
          min={50}
          max={2000}
          step={50}
          value={state.accel}
          onChange={(accel) => setState({ ...state, accel })}
          format={{ precision: 0, unit: "st/s²" }}
          disabled={state.useTrapezoidal === "off"}
        />
        <SliderRow
          label={`Trapezoidal profile (${state.useTrapezoidal})`}
          min={0}
          max={USE_TRAPEZOIDAL_VALUES.length - 1}
          step={1}
          value={trapIndex < 0 ? 0 : trapIndex}
          onChange={(idx) => {
            const i = Math.max(
              0,
              Math.min(USE_TRAPEZOIDAL_VALUES.length - 1, Math.round(idx)),
            );
            const next = USE_TRAPEZOIDAL_VALUES[i] as UseTrapezoidal;
            setState({ ...state, useTrapezoidal: next });
          }}
          format={{ precision: 0 }}
          hideTicks
        />
      </div>

      <div className="sp-visualizer__actions">
        <button type="button" className="sp-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="sp-visualizer__counter" aria-live="off">
          {stepPlan.totalSteps} steps · elapsed {stepPlan.elapsed.toFixed(3)} s
        </span>
      </div>
    </div>
  );
}
