import { useCallback, useEffect, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type DcMotorState,
  settlingTime,
  steadyStateOmega,
  trajectory,
} from "./algorithm";
import {
  DEFAULT_STATE,
  type DcMotorDemoState,
  MOTOR_SLUGS,
  PRESETS,
} from "./presets";
import "./DcMotorVisualizer.css";

/**
 * <DcMotorVisualizer> — first-order DC motor step response (plan #107).
 *
 * Shows ω(t) (top half) and θ(t) (bottom half) for a constant step voltage.
 * Marks the steady-state asymptote ω_ss and the 2% settling time t_s.
 */

const SAMPLES = 200;

const STATE_SCHEMA = {
  motorSlug: {
    type: "enum",
    default: DEFAULT_STATE.motorSlug,
    values: MOTOR_SLUGS,
  },
  voltage: { type: "number", default: DEFAULT_STATE.voltage },
  Km: { type: "number", default: DEFAULT_STATE.Km },
  tauM: { type: "number", default: DEFAULT_STATE.tauM },
  tEnd: { type: "number", default: DEFAULT_STATE.tEnd },
} as const satisfies Schema;

const narrationTemplate = (state: DcMotorDemoState): string => {
  const motor = { Km: state.Km, tauM: state.tauM };
  const omega_ss = steadyStateOmega(motor, state.voltage);
  const t_s = settlingTime(motor, 0.02);
  const label =
    PRESETS.find((p) => p.state.motorSlug === state.motorSlug)?.name ??
    state.motorSlug;
  return (
    `Step response of DC motor (preset "${label}") to ${state.voltage.toFixed(1)} V. ` +
    `Steady-state speed ω_ss = ${omega_ss.toFixed(2)} rad/s, ` +
    `time constant τ_m = ${state.tauM.toFixed(2)} s, ` +
    `settles to 2% in ${t_s.toFixed(2)} s.`
  );
};

interface PanelLayout {
  x0: number;
  y0: number;
  width: number;
  height: number;
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  panel: PanelLayout,
  label: string,
  yMin: number,
  yMax: number,
): void {
  ctx.strokeStyle = "#cbd1c5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panel.x0, panel.y0);
  ctx.lineTo(panel.x0, panel.y0 + panel.height);
  ctx.lineTo(panel.x0 + panel.width, panel.y0 + panel.height);
  ctx.stroke();

  // Zero line if range crosses zero
  if (yMin < 0 && yMax > 0) {
    const zeroY = panel.y0 + panel.height - ((0 - yMin) / (yMax - yMin)) * panel.height;
    ctx.strokeStyle = "#e0e3da";
    ctx.beginPath();
    ctx.moveTo(panel.x0, zeroY);
    ctx.lineTo(panel.x0 + panel.width, zeroY);
    ctx.stroke();
  }

  ctx.fillStyle = "#3a3f33";
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, panel.x0 + 6, panel.y0 + 4);

  // Y-axis range labels
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#6b7060";
  ctx.fillText(yMax.toFixed(1), panel.x0 - 4, panel.y0);
  ctx.textBaseline = "bottom";
  ctx.fillText(yMin.toFixed(1), panel.x0 - 4, panel.y0 + panel.height);
}

function plotSeries(
  ctx: CanvasRenderingContext2D,
  panel: PanelLayout,
  values: readonly number[],
  ts: readonly number[],
  tEnd: number,
  yMin: number,
  yMax: number,
  color: string,
): void {
  if (values.length < 2 || tEnd <= 0 || yMax === yMin) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < values.length; i += 1) {
    const t = ts[i]!;
    const v = values[i]!;
    const cx = panel.x0 + (t / tEnd) * panel.width;
    const cy =
      panel.y0 + panel.height - ((v - yMin) / (yMax - yMin)) * panel.height;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

export function DcMotorVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "dc-motor",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const motor = useMemo(() => ({ Km: state.Km, tauM: state.tauM }), [state.Km, state.tauM]);
  const omega_ss = useMemo(
    () => steadyStateOmega(motor, state.voltage),
    [motor, state.voltage],
  );
  const t_s = useMemo(() => settlingTime(motor, 0.02), [motor]);
  const traj = useMemo<DcMotorState[]>(
    () =>
      trajectory(
        { motor, voltage: state.voltage, omega0: 0, theta0: 0 },
        state.tEnd,
        SAMPLES,
      ),
    [motor, state.voltage, state.tEnd],
  );

  const ts = useMemo(() => traj.map((p) => p.t), [traj]);
  const omegas = useMemo(() => traj.map((p) => p.omega), [traj]);
  const thetas = useMemo(() => traj.map((p) => p.theta), [traj]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f7f8f4";
      ctx.fillRect(0, 0, width, height);

      const padLeft = 44;
      const padRight = 12;
      const padTop = 8;
      const padBottom = 24;
      const gutter = 16;
      const plotW = width - padLeft - padRight;
      const totalPlotH = height - padTop - padBottom - gutter;
      const panelH = totalPlotH / 2;

      const omegaPanel: PanelLayout = {
        x0: padLeft,
        y0: padTop,
        width: plotW,
        height: panelH,
      };
      const thetaPanel: PanelLayout = {
        x0: padLeft,
        y0: padTop + panelH + gutter,
        width: plotW,
        height: panelH,
      };

      // omega range
      const omegaAbsMax = omegas.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      const omegaPeak = Math.max(Math.abs(omega_ss), omegaAbsMax) * 1.1 || 1;
      const omegaMin = omega_ss < 0 ? -omegaPeak : 0;
      const omegaMax = omega_ss < 0 ? 0 : omegaPeak;

      // theta range
      const thetaMin = Math.min(0, ...thetas);
      const thetaMaxRaw = Math.max(0, ...thetas);
      const thetaSpan = thetaMaxRaw - thetaMin || 1;
      const thetaMax = thetaMaxRaw + thetaSpan * 0.05;

      paintAxes(ctx, omegaPanel, "ω(t)  [rad/s]", omegaMin, omegaMax);
      paintAxes(ctx, thetaPanel, "θ(t)  [rad]", thetaMin, thetaMax);

      // ω_ss dashed asymptote
      if (state.tEnd > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(70, 130, 180, 0.55)";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        const cy =
          omegaPanel.y0 +
          omegaPanel.height -
          ((omega_ss - omegaMin) / (omegaMax - omegaMin)) * omegaPanel.height;
        ctx.beginPath();
        ctx.moveTo(omegaPanel.x0, cy);
        ctx.lineTo(omegaPanel.x0 + omegaPanel.width, cy);
        ctx.stroke();
        ctx.restore();
      }

      // Settling time vertical marker (spans both panels)
      if (t_s > 0 && t_s <= state.tEnd) {
        ctx.save();
        ctx.strokeStyle = "rgba(207, 79, 79, 0.6)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        const cx = omegaPanel.x0 + (t_s / state.tEnd) * omegaPanel.width;
        ctx.beginPath();
        ctx.moveTo(cx, omegaPanel.y0);
        ctx.lineTo(cx, thetaPanel.y0 + thetaPanel.height);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "rgba(207, 79, 79, 0.85)";
        ctx.font = "11px 'JetBrains Mono Variable', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const cx2 = omegaPanel.x0 + (t_s / state.tEnd) * omegaPanel.width;
        ctx.fillText(`t_s=${t_s.toFixed(2)}s`, cx2 + 4, omegaPanel.y0 + 2);
      }

      plotSeries(ctx, omegaPanel, omegas, ts, state.tEnd, omegaMin, omegaMax, "steelblue");
      plotSeries(ctx, thetaPanel, thetas, ts, state.tEnd, thetaMin, thetaMax, "crimson");

      // Shared x-axis labels
      ctx.fillStyle = "#6b7060";
      ctx.font = "11px 'Inter Variable', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const baselineY = thetaPanel.y0 + thetaPanel.height + 4;
      ctx.fillText("0", thetaPanel.x0, baselineY);
      ctx.textAlign = "right";
      ctx.fillText(`${state.tEnd.toFixed(1)} s`, thetaPanel.x0 + thetaPanel.width, baselineY);
    },
    [omegas, thetas, ts, omega_ss, t_s, state.tEnd],
  );

  // Trigger a one-shot repaint after each state change; useDrawLoop runs every
  // frame anyway, but the deps array on the callback ensures it picks up changes.
  useEffect(() => {
    // no-op — re-renders the draw callback through useCallback deps
  }, [draw]);

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: DcMotorDemoState): void => {
    setState(next);
  };

  const activeLabel =
    PRESETS.find((p) => p.state.motorSlug === state.motorSlug)?.name ??
    state.motorSlug;

  return (
    <div className="dcm-visualizer">
      <div
        className="dcm-visualizer__presets"
        role="group"
        aria-label="DC motor presets"
      >
        {PRESETS.map((preset) => {
          const isActive = preset.state.motorSlug === state.motorSlug;
          return (
            <button
              key={preset.state.motorSlug}
              type="button"
              className={
                isActive
                  ? "dcm-visualizer__chip dcm-visualizer__chip--active"
                  : "dcm-visualizer__chip"
              }
              aria-pressed={isActive}
              onClick={() => handlePresetSelect(preset.state)}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      <div className="dcm-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`DC motor step response for ${activeLabel} at ${state.voltage.toFixed(1)} volts`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\omega_{ss} = ${omega_ss.toFixed(2)} \\text{ rad/s}`,
            `\\tau_m = ${state.tauM.toFixed(2)} \\text{ s}`,
            `t_{settling} = ${t_s.toFixed(2)} \\text{ s}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="dcm-visualizer__controls">
        <SliderRow
          label="Voltage V"
          description="Step input voltage applied to the armature. Negative drives reverse."
          min={-12}
          max={12}
          step={0.5}
          value={state.voltage}
          onChange={(voltage) => setState({ ...state, voltage })}
          format={{ precision: 1, unit: "V" }}
        />
        <SliderRow
          label="Km (gain)"
          description="Steady-state gain (rad/s per V): ω_ss = Km · V."
          min={0.1}
          max={5}
          step={0.1}
          value={state.Km}
          onChange={(Km) => setState({ ...state, Km })}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="τ_m (time constant)"
          description="Mechanical time constant — larger = slower rise."
          min={0.05}
          max={2}
          step={0.05}
          value={state.tauM}
          onChange={(tauM) => setState({ ...state, tauM })}
          format={{ precision: 2, unit: "s" }}
        />
        <SliderRow
          label="t_end (window)"
          description="Time window for the plotted trajectory."
          min={0.5}
          max={10}
          step={0.5}
          value={state.tEnd}
          onChange={(tEnd) => setState({ ...state, tEnd })}
          format={{ precision: 1, unit: "s" }}
        />
      </div>

      <div className="dcm-visualizer__actions">
        <button type="button" className="dcm-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="dcm-visualizer__counter" aria-live="off">
          V = {state.voltage.toFixed(1)} V
        </span>
      </div>
    </div>
  );
}
