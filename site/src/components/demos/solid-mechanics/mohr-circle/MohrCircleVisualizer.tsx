import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { mohrCircle } from "./algorithm";
import { DEFAULT_STATE, type MohrDemoState, PRESETS, PRESET_SLUGS } from "./presets";
import "./MohrCircleVisualizer.css";

/**
 * <MohrCircleVisualizer> — v6 hero solid-mechanics demo (#89).
 *
 * Renders the Mohr's circle in σ-τ space alongside the physical stress
 * element (original + rotated to principal orientation), driven by three
 * sliders for σx / σy / τxy.
 */

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: PRESET_SLUGS,
  },
  sigmaX: { type: "number", default: DEFAULT_STATE.sigmaX },
  sigmaY: { type: "number", default: DEFAULT_STATE.sigmaY },
  tauXY: { type: "number", default: DEFAULT_STATE.tauXY },
} as const satisfies Schema;

const CANVAS_W = 640;
const CANVAS_H = 360;
const PANEL_W = 320;
const PANEL_H = 360;

const narrationTemplate = (state: MohrDemoState): string => {
  const r = mohrCircle({
    sigmaX: state.sigmaX,
    sigmaY: state.sigmaY,
    tauXY: state.tauXY,
  });
  const deg = (r.thetaP * 180) / Math.PI;
  return `Stress state σx = ${state.sigmaX} MPa, σy = ${state.sigmaY} MPa, τxy = ${state.tauXY} MPa. Principal stresses σ1 = ${r.sigma1.toFixed(1)}, σ2 = ${r.sigma2.toFixed(1)} MPa, rotated by ${deg.toFixed(1)}°.`;
};

/** Compute an axis scale (px per MPa) that fits the current stress state. */
function axisScale(maxAbs: number, halfPx: number): number {
  const safe = Math.max(maxAbs, 50);
  return (halfPx - 24) / safe;
}

function drawMohrPanel(ctx: CanvasRenderingContext2D, state: MohrDemoState): void {
  const x0 = 0;
  const cx = x0 + PANEL_W / 2;
  const cy = PANEL_H / 2;
  const half = Math.min(PANEL_W, PANEL_H) / 2;

  const r = mohrCircle({
    sigmaX: state.sigmaX,
    sigmaY: state.sigmaY,
    tauXY: state.tauXY,
  });

  const maxAbs = Math.max(
    Math.abs(state.sigmaX),
    Math.abs(state.sigmaY),
    Math.abs(state.tauXY),
    Math.abs(r.sigma1),
    Math.abs(r.sigma2),
    r.radius,
  );
  const s = axisScale(maxAbs, half);

  // Axes
  ctx.strokeStyle = "#bdbdbd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 8, cy);
  ctx.lineTo(x0 + PANEL_W - 8, cy);
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx, PANEL_H - 8);
  ctx.stroke();

  // Tick marks every 50 MPa
  ctx.fillStyle = "#999";
  ctx.font = "10px 'JetBrains Mono Variable', monospace";
  for (let t = -300; t <= 300; t += 50) {
    if (t === 0) continue;
    const px = cx + t * s;
    if (px < x0 + 4 || px > x0 + PANEL_W - 4) continue;
    ctx.beginPath();
    ctx.moveTo(px, cy - 3);
    ctx.lineTo(px, cy + 3);
    ctx.strokeStyle = "#d0d0d0";
    ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = "#555";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText("σ", x0 + PANEL_W - 14, cy - 6);
  ctx.fillText("τ", cx + 6, 14);

  // Circle
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + r.centre * s, cy, Math.max(1, r.radius * s), 0, Math.PI * 2);
  ctx.stroke();

  // Points X = (σx, τxy) and Y = (σy, -τxy). τ axis positive DOWN (Mohr).
  const xPx = cx + state.sigmaX * s;
  const xPy = cy + state.tauXY * s;
  const yPx = cx + state.sigmaY * s;
  const yPy = cy - state.tauXY * s;

  // Diameter X-Y dashed
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xPx, xPy);
  ctx.lineTo(yPx, yPy);
  ctx.stroke();
  ctx.restore();

  // X and Y dots
  ctx.fillStyle = "#1f6feb";
  ctx.beginPath();
  ctx.arc(xPx, xPy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#00693e";
  ctx.beginPath();
  ctx.arc(yPx, yPy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText("X", xPx + 6, xPy - 4);
  ctx.fillText("Y", yPx + 6, yPy - 4);

  // σ1, σ2 markers
  const drawMarker = (sigma: number, label: string) => {
    const px = cx + sigma * s;
    ctx.fillStyle = "#cf4f4f";
    ctx.beginPath();
    ctx.moveTo(px, cy - 6);
    ctx.lineTo(px - 4, cy);
    ctx.lineTo(px + 4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.fillText(label, px - 6, cy - 8);
  };
  drawMarker(r.sigma1, "σ1");
  drawMarker(r.sigma2, "σ2");

  // τ_max label at top of circle
  const topY = cy - r.radius * s;
  ctx.fillStyle = "#cf4f4f";
  ctx.fillText(`τ_max = ${r.tauMax.toFixed(0)}`, cx + r.centre * s + 6, topY - 4);
}

function drawElementPanel(ctx: CanvasRenderingContext2D, state: MohrDemoState): void {
  const x0 = PANEL_W;
  const cx = x0 + PANEL_W / 2;
  const cy = PANEL_H / 2;
  const side = 110;

  const r = mohrCircle({
    sigmaX: state.sigmaX,
    sigmaY: state.sigmaY,
    tauXY: state.tauXY,
  });

  // Separator
  ctx.strokeStyle = "#e0e0e0";
  ctx.beginPath();
  ctx.moveTo(x0, 8);
  ctx.lineTo(x0, PANEL_H - 8);
  ctx.stroke();

  // Rotated principal element (filled, behind)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(r.thetaP);
  ctx.fillStyle = "rgba(0, 105, 62, 0.10)";
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-side / 2, -side / 2, side, side);
  ctx.fill();
  ctx.stroke();

  // σ1 arrows (along rotated x)
  ctx.fillStyle = "#00693e";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText(`σ1=${r.sigma1.toFixed(0)}`, side / 2 + 6, 0);
  ctx.fillText(`σ2=${r.sigma2.toFixed(0)}`, -20, -side / 2 - 6);
  ctx.restore();

  // Original element (outline only)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "#1f2328";
  ctx.lineWidth = 1.25;
  ctx.strokeRect(-side / 2, -side / 2, side, side);

  // Stress arrows on the original element
  ctx.fillStyle = "#1f2328";
  ctx.font = "10px 'JetBrains Mono Variable', monospace";
  ctx.fillText(`σx=${state.sigmaX}`, side / 2 + 6, 4);
  ctx.fillText(`σy=${state.sigmaY}`, -20, -side / 2 - 18);
  ctx.fillText(`τxy=${state.tauXY}`, -side / 2 - 4, side / 2 + 14);
  ctx.restore();

  // Caption
  ctx.fillStyle = "#555";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText(`θp = ${((r.thetaP * 180) / Math.PI).toFixed(1)}°`, x0 + 12, PANEL_H - 12);
}

export function MohrCircleVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "mohr-circle",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const result = useMemo(
    () =>
      mohrCircle({
        sigmaX: state.sigmaX,
        sigmaY: state.sigmaY,
        tauXY: state.tauXY,
      }),
    [state.sigmaX, state.sigmaY, state.tauXY],
  );

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawMohrPanel(ctx, state);
      drawElementPanel(ctx, state);
    },
    [state],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: MohrDemoState): void => {
    setState(next);
  };

  return (
    <div className="mc-visualizer">
      <PresetCarousel
        presets={PRESETS.map((p) => ({ name: p.name, state: p.state }))}
        onSelect={handlePresetSelect}
        ariaLabel="Mohr's circle presets"
      />

      <div className="mc-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Mohr's circle for σx=${state.sigmaX}, σy=${state.sigmaY}, τxy=${state.tauXY} MPa`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\sigma_1 = ${result.sigma1.toFixed(1)} \\text{ MPa}`,
            `\\sigma_2 = ${result.sigma2.toFixed(1)} \\text{ MPa}`,
            `\\tau_{max} = ${result.tauMax.toFixed(1)} \\text{ MPa}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="mc-visualizer__controls">
        <SliderRow
          label="σx"
          min={-200}
          max={200}
          step={5}
          value={state.sigmaX}
          onChange={(sigmaX) => setState({ ...state, sigmaX })}
          format={{ precision: 0, unit: "MPa" }}
        />
        <SliderRow
          label="σy"
          min={-200}
          max={200}
          step={5}
          value={state.sigmaY}
          onChange={(sigmaY) => setState({ ...state, sigmaY })}
          format={{ precision: 0, unit: "MPa" }}
        />
        <SliderRow
          label="τxy"
          min={-100}
          max={100}
          step={5}
          value={state.tauXY}
          onChange={(tauXY) => setState({ ...state, tauXY })}
          format={{ precision: 0, unit: "MPa" }}
        />
      </div>

      <div className="mc-visualizer__actions">
        <button type="button" className="mc-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="mc-visualizer__counter" aria-live="off">
          σ1 = {result.sigma1.toFixed(1)} MPa
        </span>
      </div>
    </div>
  );
}
