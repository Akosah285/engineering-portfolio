import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type ShaftGeometry, torsionAnalysis } from "./algorithm";
import {
  DEFAULT_STATE,
  GEOMETRY_SLUGS,
  PRESETS,
  PRESET_META,
  type TorsionDemoState,
} from "./presets";
import "./TorsionVisualizer.css";

/**
 * <TorsionVisualizer> — interactive shell around `torsionAnalysis`.
 *
 * Two-panel canvas:
 *   - LEFT: shaft cross-section with a radial shear-stress gradient.
 *   - RIGHT: side view of the cylinder with twisted longitudinal lines
 *     showing φ(x) = φ · x/L.
 */

const STATE_SCHEMA = {
  geometrySlug: {
    type: "enum",
    default: DEFAULT_STATE.geometrySlug,
    values: GEOMETRY_SLUGS,
  },
  torque_Nm: { type: "number", default: DEFAULT_STATE.torque_Nm },
  length_m: { type: "number", default: DEFAULT_STATE.length_m },
  G_GPa: { type: "number", default: DEFAULT_STATE.G_GPa },
  outerRadius_mm: { type: "number", default: DEFAULT_STATE.outerRadius_mm },
  innerRadius_mm: { type: "number", default: DEFAULT_STATE.innerRadius_mm },
} as const satisfies Schema;

const CANVAS_W = 640;
const CANVAS_H = 360;
const LEFT_CX = 200;
const RIGHT_CX = 440;
const CENTER_Y = 180;
const MIN_OUTER_PX = 60;
const MAX_OUTER_PX = 100;
const MIN_OUTER_MM = 5;
const MAX_OUTER_MM = 50;
const SHAFT_LEN_PX = 200;

/** Linear pixel-radius for a given outer radius in mm. */
function outerRadiusPx(outerRadius_mm: number): number {
  const t = (outerRadius_mm - MIN_OUTER_MM) / (MAX_OUTER_MM - MIN_OUTER_MM);
  const clamped = Math.max(0, Math.min(1, t));
  return MIN_OUTER_PX + clamped * (MAX_OUTER_PX - MIN_OUTER_PX);
}

/** Blue (low) → red (high) interpolation in sRGB. */
function stressColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(40 + clamped * (220 - 40));
  const g = Math.round(80 + (1 - Math.abs(clamped - 0.5) * 2) * 80);
  const b = Math.round(220 - clamped * (220 - 40));
  return `rgb(${r}, ${g}, ${b})`;
}

function paintCrossSection(
  ctx: CanvasRenderingContext2D,
  outerPx: number,
  innerPx: number,
): void {
  // Background panel
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, CANVAS_W / 2, CANVAS_H);

  // Concentric stress rings: outer→inner, painting a discrete gradient.
  const steps = 48;
  for (let i = steps; i >= 1; i -= 1) {
    const r = (i / steps) * outerPx;
    const tau_t = i / steps; // τ(r)/τ_max = r/c
    ctx.fillStyle = stressColor(tau_t);
    ctx.beginPath();
    ctx.arc(LEFT_CX, CENTER_Y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hollow: punch out the inner bore.
  if (innerPx > 0) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(LEFT_CX, CENTER_Y, innerPx, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer outline
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(LEFT_CX, CENTER_Y, outerPx, 0, Math.PI * 2);
  ctx.stroke();
}

function paintSideView(
  ctx: CanvasRenderingContext2D,
  outerPx: number,
  phi_rad: number,
): void {
  // Background panel
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(CANVAS_W / 2, 0, CANVAS_W / 2, CANVAS_H);

  const x0 = RIGHT_CX - SHAFT_LEN_PX / 2;
  const x1 = RIGHT_CX + SHAFT_LEN_PX / 2;
  const halfH = outerPx;

  // Cylinder body
  ctx.fillStyle = "#e8eef3";
  ctx.fillRect(x0, CENTER_Y - halfH, SHAFT_LEN_PX, halfH * 2);
  ctx.strokeStyle = "#456";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, CENTER_Y - halfH, SHAFT_LEN_PX, halfH * 2);

  // Left end face (fixed end)
  ctx.fillStyle = "#cfd9e3";
  ctx.beginPath();
  ctx.ellipse(x0, CENTER_Y, halfH * 0.25, halfH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 5 longitudinal twisted lines along the top half of the surface.
  // Each line starts at θ0 around the axis at x = x0 and twists by
  // φ(x) = φ · (x - x0) / L as x marches to x1. We project the angle
  // onto the vertical (y) axis since we're looking from the side.
  const N = 5;
  ctx.strokeStyle = "#205070";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < N; i += 1) {
    const theta0 = (i / N) * Math.PI * 2;
    ctx.beginPath();
    const steps = 40;
    for (let s = 0; s <= steps; s += 1) {
      const u = s / steps;
      const x = x0 + u * SHAFT_LEN_PX;
      const theta = theta0 + phi_rad * u;
      const y = CENTER_Y + Math.sin(theta) * halfH;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Right end face — rotation marker.
  ctx.fillStyle = "#b8c8d8";
  ctx.beginPath();
  ctx.ellipse(x1, CENTER_Y, halfH * 0.25, halfH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Twist indicator: a radius line on the right end rotated by φ.
  ctx.save();
  ctx.translate(x1, CENTER_Y);
  ctx.strokeStyle = "#b03030";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -halfH);
  ctx.stroke();
  // Rotated radius
  ctx.rotate(phi_rad);
  ctx.strokeStyle = "#1f7a3a";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -halfH);
  ctx.stroke();
  // Arc arrow between the two radii
  ctx.strokeStyle = "#1f7a3a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const arcR = halfH * 0.55;
  const start = -Math.PI / 2 - phi_rad;
  const end = -Math.PI / 2;
  ctx.arc(0, 0, arcR, start, end, phi_rad < 0);
  ctx.stroke();
  ctx.restore();

  // Axis label
  ctx.fillStyle = "#333";
  ctx.font = "12px sans-serif";
  ctx.fillText("fixed", x0 - 4, CENTER_Y + halfH + 16);
  ctx.fillText("φ", x1 - 4, CENTER_Y - halfH - 6);
}

function divider(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 12);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H - 12);
  ctx.stroke();
}

const narrationTemplate = (state: TorsionDemoState): string => {
  const meta = PRESET_META[state.geometrySlug];
  const safeInner = Math.min(state.innerRadius_mm, state.outerRadius_mm - 1);
  const geometry: ShaftGeometry =
    safeInner > 0
      ? {
          kind: "hollow",
          outerRadius: state.outerRadius_mm / 1000,
          innerRadius: safeInner / 1000,
        }
      : { kind: "solid", radius: state.outerRadius_mm / 1000 };
  const result = torsionAnalysis({
    torque: state.torque_Nm,
    length: state.length_m,
    shearModulus: state.G_GPa * 1e9,
    geometry,
  });
  const tauMax_MPa = result.maxShearStress / 1e6;
  const phi_deg = (result.twistAngle * 180) / Math.PI;
  return `${meta.label} shaft, T = ${state.torque_Nm} N·m, L = ${state.length_m.toFixed(1)} m, G = ${state.G_GPa} GPa. τ_max = ${tauMax_MPa.toFixed(1)} MPa at r = ${state.outerRadius_mm} mm; twist angle = ${phi_deg.toFixed(2)}°.`;
};

export function TorsionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "torsion",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { result, tauMax_MPa, phi_deg, J_cm4, outerPx, innerPx } = useMemo(() => {
    const outerMm = state.outerRadius_mm;
    const innerMm = Math.max(0, Math.min(state.innerRadius_mm, outerMm - 1));
    const geometry: ShaftGeometry =
      innerMm > 0
        ? {
            kind: "hollow",
            outerRadius: outerMm / 1000,
            innerRadius: innerMm / 1000,
          }
        : { kind: "solid", radius: outerMm / 1000 };
    const r = torsionAnalysis({
      torque: state.torque_Nm,
      length: state.length_m,
      shearModulus: state.G_GPa * 1e9,
      geometry,
    });
    const oPx = outerRadiusPx(outerMm);
    const iPx = innerMm > 0 ? oPx * (innerMm / outerMm) : 0;
    return {
      result: r,
      tauMax_MPa: r.maxShearStress / 1e6,
      phi_deg: (r.twistAngle * 180) / Math.PI,
      J_cm4: r.J * 1e8,
      outerPx: oPx,
      innerPx: iPx,
    };
  }, [
    state.outerRadius_mm,
    state.innerRadius_mm,
    state.torque_Nm,
    state.length_m,
    state.G_GPa,
  ]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      paintCrossSection(ctx, outerPx, innerPx);
      paintSideView(ctx, outerPx, result.twistAngle);
      divider(ctx);
    },
    [outerPx, innerPx, result.twistAngle],
  );

  const handlePresetSelect = (next: TorsionDemoState): void => {
    setState(next);
  };

  return (
    <div className="tr-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: TorsionDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Torsion geometry presets"
      />

      <div className="tr-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Torsion of ${PRESET_META[state.geometrySlug].label} shaft, cross-section and side view`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\tau_{max} = ${tauMax_MPa.toFixed(1)} \\text{ MPa}`,
            `\\varphi = ${phi_deg.toFixed(2)}°`,
            `J = ${J_cm4.toFixed(2)} \\text{ cm}^4`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="tr-visualizer__controls">
        <SliderRow
          label="Torque T"
          min={-1000}
          max={1000}
          step={10}
          value={state.torque_Nm}
          onChange={(torque_Nm) => setState({ ...state, torque_Nm })}
          format={{ precision: 0, unit: "N·m" }}
        />
        <SliderRow
          label="Length L"
          min={0.1}
          max={5}
          step={0.1}
          value={state.length_m}
          onChange={(length_m) => setState({ ...state, length_m })}
          format={{ precision: 1, unit: "m" }}
        />
        <SliderRow
          label="Shear modulus G"
          min={20}
          max={100}
          step={5}
          value={state.G_GPa}
          onChange={(G_GPa) => setState({ ...state, G_GPa })}
          format={{ precision: 0, unit: "GPa" }}
        />
        <SliderRow
          label="Outer radius"
          min={5}
          max={50}
          step={1}
          value={state.outerRadius_mm}
          onChange={(outerRadius_mm) => setState({ ...state, outerRadius_mm })}
          format={{ precision: 0, unit: "mm" }}
        />
        <SliderRow
          label="Inner radius"
          description="Set > 0 for a hollow shaft. Auto-clamped below outer radius."
          min={0}
          max={49}
          step={1}
          value={state.innerRadius_mm}
          onChange={(innerRadius_mm) => setState({ ...state, innerRadius_mm })}
          format={{ precision: 0, unit: "mm" }}
        />
      </div>

      <div className="tr-visualizer__actions">
        <button type="button" className="tr-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="tr-visualizer__counter" aria-live="off">
          τ_max = {tauMax_MPa.toFixed(1)} MPa
        </span>
      </div>
    </div>
  );
}
