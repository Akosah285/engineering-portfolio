import { useCallback, useEffect, useMemo, useRef } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  rcChargingVoltage,
  rcDischargingVoltage,
  rcTimeConstant,
  rlCurrent,
  rlTimeConstant,
  timeToFraction,
} from "./algorithm";
import {
  DEFAULT_STATE,
  MODE_VALUES,
  PRESETS,
  type RcRlDemoState,
  type RcRlMode,
} from "./presets";
import "./RcRlVisualizer.css";

/**
 * <RcRlVisualizer> — first-order RC / RL step-response demo.
 *
 * Two-panel canvas: left = circuit schematic for the active mode;
 * right = response curve over a 5τ window with τ, 2τ, 3τ tick markers
 * and an animated cursor sweeping across the time axis.
 */

const STATE_SCHEMA = {
  mode: { type: "enum", default: DEFAULT_STATE.mode, values: MODE_VALUES },
  R: { type: "number", default: DEFAULT_STATE.R },
  C: { type: "number", default: DEFAULT_STATE.C },
  L: { type: "number", default: DEFAULT_STATE.L },
  Vstep: { type: "number", default: DEFAULT_STATE.Vstep },
} as const satisfies Schema;

const CANVAS_W = 640;
const CANVAS_H = 320;
const SCHEMATIC_W = 240;
const PLOT_X0 = SCHEMATIC_W + 40;
const PLOT_Y0 = 30;
const PLOT_W = CANVAS_W - PLOT_X0 - 20;
const PLOT_H = CANVAS_H - PLOT_Y0 - 40;
const SWEEP_PERIOD_MS = 4000;

function computeTau(state: RcRlDemoState): number {
  return state.mode === "rl"
    ? rlTimeConstant(state.R, state.L)
    : rcTimeConstant(state.R, state.C);
}

function responseAt(state: RcRlDemoState, tau: number, t: number): number {
  if (state.mode === "rc-charge") {
    return rcChargingVoltage({ Vstep: state.Vstep, tau, t });
  }
  if (state.mode === "rc-discharge") {
    return rcDischargingVoltage(state.Vstep, tau, t);
  }
  return rlCurrent(state.Vstep, state.R, state.L, t);
}

function asymptote(state: RcRlDemoState): number {
  if (state.mode === "rc-charge") return state.Vstep;
  if (state.mode === "rc-discharge") return state.Vstep;
  return state.Vstep / state.R;
}

function unitLabel(mode: RcRlMode): string {
  return mode === "rl" ? "A" : "V";
}

function modeIndex(mode: RcRlMode): number {
  return MODE_VALUES.indexOf(mode);
}

function paintSchematic(ctx: CanvasRenderingContext2D, mode: RcRlMode): void {
  ctx.save();
  ctx.strokeStyle = "#222";
  ctx.fillStyle = "#222";
  ctx.lineWidth = 2;
  ctx.font = "12px system-ui, sans-serif";

  const x0 = 20;
  const y0 = 50;
  const w = SCHEMATIC_W - 40;
  const h = CANVAS_H - 100;

  ctx.strokeRect(x0, y0, w, h);

  // Battery (left side, mid-height)
  const bx = x0;
  const by = y0 + h / 2;
  ctx.beginPath();
  ctx.moveTo(bx - 12, by - 12);
  ctx.lineTo(bx - 12, by + 12);
  ctx.moveTo(bx - 6, by - 6);
  ctx.lineTo(bx - 6, by + 6);
  ctx.stroke();
  ctx.fillText("Vstep", bx - 30, by - 16);

  // Resistor (top edge zig-zag)
  const rx0 = x0 + 30;
  const rx1 = x0 + w - 30;
  const ry = y0;
  ctx.beginPath();
  ctx.moveTo(rx0, ry);
  const segs = 8;
  for (let i = 0; i <= segs; i += 1) {
    const px = rx0 + ((rx1 - rx0) * i) / segs;
    const py = ry + (i % 2 === 0 ? -6 : 6);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(rx1, ry);
  ctx.stroke();
  ctx.fillText("R", (rx0 + rx1) / 2 - 4, ry - 12);

  // Right side element: capacitor or inductor
  const ex = x0 + w;
  const ey = y0 + h / 2;
  if (mode === "rl") {
    // Inductor: 4 humps
    const humps = 4;
    const hw = 12;
    const total = humps * hw;
    const startY = ey - total / 2;
    ctx.beginPath();
    for (let i = 0; i < humps; i += 1) {
      const cy = startY + i * hw + hw / 2;
      ctx.moveTo(ex, cy - hw / 2);
      ctx.arc(ex, cy, hw / 2, -Math.PI / 2, Math.PI / 2, false);
    }
    ctx.stroke();
    ctx.fillText("L", ex + 14, ey);
  } else {
    // Capacitor: two parallel plates
    ctx.beginPath();
    ctx.moveTo(ex - 6, ey - 14);
    ctx.lineTo(ex - 6, ey + 14);
    ctx.moveTo(ex + 6, ey - 14);
    ctx.lineTo(ex + 6, ey + 14);
    ctx.stroke();
    ctx.fillText("C", ex + 14, ey);
  }

  // Mode label
  ctx.fillStyle = "#00693e";
  ctx.font = "13px system-ui, sans-serif";
  const label =
    mode === "rc-charge"
      ? "RC charging"
      : mode === "rc-discharge"
        ? "RC discharging"
        : "RL step response";
  ctx.fillText(label, x0, y0 - 18);

  ctx.restore();
}

function paintResponse(
  ctx: CanvasRenderingContext2D,
  state: RcRlDemoState,
  tau: number,
  cursorT: number,
): void {
  ctx.save();
  ctx.font = "11px system-ui, sans-serif";

  // Axes
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PLOT_X0, PLOT_Y0);
  ctx.lineTo(PLOT_X0, PLOT_Y0 + PLOT_H);
  ctx.lineTo(PLOT_X0 + PLOT_W, PLOT_Y0 + PLOT_H);
  ctx.stroke();

  const tMax = 5 * tau;
  const yMax = Math.max(Math.abs(asymptote(state)), 1e-12);
  const tToX = (t: number): number => PLOT_X0 + (t / tMax) * PLOT_W;
  const yToY = (y: number): number => PLOT_Y0 + PLOT_H - (Math.abs(y) / yMax) * PLOT_H;

  // τ, 2τ, 3τ vertical guides + labels
  const fractions = [
    { mult: 1, label: "τ", pct: state.mode === "rc-discharge" ? "36.8%" : "63.2%" },
    {
      mult: 2,
      label: "2τ",
      pct: state.mode === "rc-discharge" ? "13.5%" : "86.5%",
    },
    { mult: 3, label: "3τ", pct: state.mode === "rc-discharge" ? "5.0%" : "95.0%" },
  ];
  ctx.strokeStyle = "#cdd";
  ctx.fillStyle = "#557";
  for (const f of fractions) {
    const x = tToX(f.mult * tau);
    ctx.beginPath();
    ctx.moveTo(x, PLOT_Y0);
    ctx.lineTo(x, PLOT_Y0 + PLOT_H);
    ctx.stroke();
    ctx.fillText(f.label, x - 6, PLOT_Y0 - 4);
    ctx.fillText(f.pct, x - 14, PLOT_Y0 + PLOT_H + 14);
  }

  // Curve
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const samples = 200;
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * tMax;
    const v = responseAt(state, tau, t);
    const px = tToX(t);
    const py = yToY(v);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Cursor + value readout
  const cv = responseAt(state, tau, cursorT);
  const cx = tToX(cursorT);
  const cy = yToY(cv);
  ctx.strokeStyle = "rgba(207, 79, 79, 0.8)";
  ctx.beginPath();
  ctx.moveTo(cx, PLOT_Y0);
  ctx.lineTo(cx, PLOT_Y0 + PLOT_H);
  ctx.stroke();
  ctx.fillStyle = "#cf4f4f";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(
    `t=${cursorT.toExponential(2)}s  →  ${cv.toExponential(2)} ${unitLabel(state.mode)}`,
    PLOT_X0,
    PLOT_Y0 + PLOT_H + 30,
  );

  ctx.restore();
}

export default function RcRlVisualizer() {
  const [state, setState, { reset }] = useDemoState("rc-rl", STATE_SCHEMA, DEFAULT_STATE);

  const tau = useMemo(() => computeTau(state), [state]);
  const t90 = useMemo(() => timeToFraction(tau, 0.9), [tau]);

  const cursorRef = useRef(0);
  const totalRef = useRef(0);

  // Reset cursor whenever inputs change so the sweep restarts at t=0.
  useEffect(() => {
    cursorRef.current = 0;
    totalRef.current = 0;
  }, [state.mode, state.R, state.C, state.L, state.Vstep]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      totalRef.current += deltaMs;
      const phase = (totalRef.current % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS;
      cursorRef.current = phase * 5 * tau;

      paintSchematic(ctx, state.mode);
      paintResponse(ctx, state, tau, cursorRef.current);
    },
    [state, tau],
  );

  const handleReset = (): void => {
    reset();
    cursorRef.current = 0;
    totalRef.current = 0;
  };

  const handlePresetSelect = (next: RcRlDemoState): void => {
    setState(next);
  };

  const isRc = state.mode === "rc-charge" || state.mode === "rc-discharge";
  const isRl = state.mode === "rl";

  return (
    <div className="rcrl-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: RcRlDemoState }[] as {
            name: string;
            state: RcRlDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="RC/RL presets"
      />

      <div className="rcrl-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`RC/RL ${state.mode} response over 5 time-constants`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\tau = ${tau.toExponential(2)}\\,\\text{s}`,
            `t_{90} = ${t90.toExponential(2)}\\,\\text{s}`,
          ]}
        />
      </div>

      <div className="rcrl-visualizer__controls">
        <SliderRow
          label="Mode (circuit)"
          description="0 = RC charge · 1 = RC discharge · 2 = RL"
          min={0}
          max={MODE_VALUES.length - 1}
          step={1}
          value={modeIndex(state.mode)}
          onChange={(idx) => {
            const mode = MODE_VALUES[Math.round(idx)] ?? DEFAULT_STATE.mode;
            setState({ ...state, mode });
          }}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="R (resistance)"
          description="Series resistance Ω."
          min={1}
          max={1000}
          step={10}
          value={state.R}
          onChange={(R) => setState({ ...state, R })}
          format={{ precision: 0, unit: "Ω" }}
        />
        <SliderRow
          label="C (capacitance)"
          description="Capacitance — only relevant for RC modes."
          min={0.000001}
          max={0.01}
          step={0.0001}
          value={state.C}
          onChange={(C) => setState({ ...state, C })}
          format={{ precision: 6, unit: "F" }}
          disabled={!isRc}
        />
        <SliderRow
          label="L (inductance)"
          description="Inductance — only relevant for RL mode."
          min={0.001}
          max={10}
          step={0.05}
          value={state.L}
          onChange={(L) => setState({ ...state, L })}
          format={{ precision: 3, unit: "H" }}
          disabled={!isRl}
        />
        <SliderRow
          label="Vstep (step voltage)"
          description="Magnitude of the step input."
          min={1}
          max={24}
          step={1}
          value={state.Vstep}
          onChange={(Vstep) => setState({ ...state, Vstep })}
          format={{ precision: 0, unit: "V" }}
        />
      </div>

      <div className="rcrl-visualizer__actions">
        <button type="button" className="rcrl-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="rcrl-visualizer__counter" aria-live="off">
          τ = {tau.toExponential(3)} s · t90 = {t90.toExponential(3)} s
        </span>
      </div>
    </div>
  );
}
