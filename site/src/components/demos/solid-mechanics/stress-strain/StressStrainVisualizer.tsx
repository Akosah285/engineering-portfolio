import { useCallback, useMemo, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type StressStrainParams, curve } from "./algorithm";
import {
  DEFAULT_STATE,
  MATERIAL_SLUGS,
  PRESETS,
  PRESET_META,
  type StressStrainDemoState,
} from "./presets";
import "./StressStrainVisualizer.css";

/**
 * <StressStrainVisualizer> — interactive σ(ε) curve for ductile metals (#90).
 *
 * Plots the four-region engineering stress-strain model with the proportional
 * limit, yield point, ultimate strength, and fracture point annotated.
 */

const STATE_SCHEMA = {
  materialSlug: {
    type: "enum",
    default: DEFAULT_STATE.materialSlug,
    values: MATERIAL_SLUGS,
  },
  E_GPa: { type: "number", default: DEFAULT_STATE.E_GPa },
  yieldStress_MPa: { type: "number", default: DEFAULT_STATE.yieldStress_MPa },
  ultimateStress_MPa: { type: "number", default: DEFAULT_STATE.ultimateStress_MPa },
  plateauEndStrain: { type: "number", default: DEFAULT_STATE.plateauEndStrain },
  failureStrain: { type: "number", default: DEFAULT_STATE.failureStrain },
} as const satisfies Schema;

const PADDING = { left: 56, right: 16, top: 24, bottom: 40 };

interface CurveResult {
  params: StressStrainParams;
  ultimateStrain: number;
  pointsMPa: { strain: number; stress: number }[];
  yieldStrainValue: number;
  yieldStressMPa: number;
  ultimateStressMPa: number;
}

function computeCurve(state: StressStrainDemoState): CurveResult | { error: string } {
  const E_Pa = state.E_GPa * 1e9;
  const sigmaY_Pa = state.yieldStress_MPa * 1e6;
  const sigmaU_Pa = state.ultimateStress_MPa * 1e6;
  const ultimateStrain = (state.plateauEndStrain + state.failureStrain) / 2;
  const params: StressStrainParams = {
    E: E_Pa,
    yieldStress: sigmaY_Pa,
    ultimateStress: sigmaU_Pa,
    plateauEndStrain: state.plateauEndStrain,
    ultimateStrain,
    failureStrain: state.failureStrain,
  };
  try {
    const raw = curve(params, 200);
    return {
      params,
      ultimateStrain,
      pointsMPa: raw.map((p) => ({ strain: p.strain, stress: p.stress / 1e6 })),
      yieldStrainValue: sigmaY_Pa / E_Pa,
      yieldStressMPa: state.yieldStress_MPa,
      ultimateStressMPa: state.ultimateStress_MPa,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function paintCurve(ctx: CanvasRenderingContext2D, result: CurveResult): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  const xMax = result.params.failureStrain;
  const yMax = Math.max(result.ultimateStressMPa, result.yieldStressMPa) * 1.15;

  const xToPx = (x: number): number => PADDING.left + (x / xMax) * plotW;
  const yToPx = (y: number): number => PADDING.top + plotH - (y / yMax) * plotH;

  const ey = result.yieldStrainValue;
  const eh = result.params.plateauEndStrain;
  const eu = result.ultimateStrain;
  const ef = result.params.failureStrain;

  // Shaded regions
  const regions: { x0: number; x1: number; color: string }[] = [
    { x0: 0, x1: ey, color: "rgba(144, 238, 144, 0.35)" },
    { x0: ey, x1: eh, color: "rgba(255, 255, 153, 0.45)" },
    { x0: eh, x1: eu, color: "rgba(255, 200, 130, 0.45)" },
    { x0: eu, x1: ef, color: "rgba(255, 160, 160, 0.45)" },
  ];
  for (const r of regions) {
    ctx.fillStyle = r.color;
    const x0 = xToPx(Math.max(0, r.x0));
    const x1 = xToPx(Math.min(xMax, r.x1));
    ctx.fillRect(x0, PADDING.top, Math.max(0, x1 - x0), plotH);
  }

  // Axes
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING.left, PADDING.top);
  ctx.lineTo(PADDING.left, PADDING.top + plotH);
  ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#222";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("strain ε", PADDING.left + plotW / 2, height - 8);
  ctx.save();
  ctx.translate(14, PADDING.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("stress σ (MPa)", 0, 0);
  ctx.restore();

  // Horizontal dashed lines: σ_y, σ_u
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#888";
  ctx.beginPath();
  const yY = yToPx(result.yieldStressMPa);
  ctx.moveTo(PADDING.left, yY);
  ctx.lineTo(PADDING.left + plotW, yY);
  ctx.stroke();
  ctx.beginPath();
  const yU = yToPx(result.ultimateStressMPa);
  ctx.moveTo(PADDING.left, yU);
  ctx.lineTo(PADDING.left + plotW, yU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#555";
  ctx.textAlign = "right";
  ctx.fillText("σ_y", PADDING.left - 4, yY + 4);
  ctx.fillText("σ_u", PADDING.left - 4, yU + 4);

  // Vertical dotted lines at ε_y, ε_h, ε_u, ε_f
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "#777";
  const marks: { x: number; label: string }[] = [
    { x: ey, label: "ε_y" },
    { x: eh, label: "ε_h" },
    { x: eu, label: "ε_u" },
    { x: ef, label: "ε_f" },
  ];
  ctx.textAlign = "center";
  ctx.fillStyle = "#444";
  for (const m of marks) {
    const px = xToPx(m.x);
    ctx.beginPath();
    ctx.moveTo(px, PADDING.top);
    ctx.lineTo(px, PADDING.top + plotH);
    ctx.stroke();
    ctx.fillText(m.label, px, PADDING.top + plotH + 14);
  }
  ctx.setLineDash([]);

  // Curve
  ctx.strokeStyle = "steelblue";
  ctx.lineWidth = 2;
  ctx.beginPath();
  result.pointsMPa.forEach((p, i) => {
    const px = xToPx(p.strain);
    const py = yToPx(p.stress);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Mark key points
  const dots: { x: number; y: number; color: string }[] = [
    { x: ey, y: result.yieldStressMPa, color: "#2a8a2a" },
    { x: eu, y: result.ultimateStressMPa, color: "#cc7a00" },
    { x: ef, y: 0, color: "#b00020" },
  ];
  for (const d of dots) {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(xToPx(d.x), yToPx(d.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintError(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#fff5f5";
  ctx.fillRect(0, 0, width, height);
}

const narrationTemplate = (state: StressStrainDemoState): string => {
  const meta = PRESET_META[state.materialSlug];
  const label = meta?.label ?? "Custom material";
  return `${label} stress-strain curve. E = ${state.E_GPa} GPa, yield ${state.yieldStress_MPa} MPa, ultimate ${state.ultimateStress_MPa} MPa, fracture at ε = ${state.failureStrain.toFixed(2)}.`;
};

export function StressStrainVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "stress-strain",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const computation = useMemo(() => computeCurve(state), [state]);
  const hasError = "error" in computation;
  const [paused] = useState(false);

  const draw: DrawFn = useCallback(
    (ctx) => {
      if ("error" in computation) {
        paintError(ctx);
      } else {
        paintCurve(ctx, computation);
      }
    },
    [computation],
  );

  const handlePresetSelect = (next: StressStrainDemoState): void => {
    setState(next);
  };

  const hudLines = [
    `\\sigma_y = ${state.yieldStress_MPa} \\text{ MPa}`,
    `\\sigma_u = ${state.ultimateStress_MPa} \\text{ MPa}`,
    `\\epsilon_f = ${state.failureStrain.toFixed(2)}`,
  ];

  return (
    <div className="ss-visualizer">
      <PresetCarousel
        presets={PRESETS as readonly { name: string; state: StressStrainDemoState }[] as {
          name: string;
          state: StressStrainDemoState;
        }[]}
        onSelect={handlePresetSelect}
        ariaLabel="Stress-strain material presets"
      />

      <div className="ss-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Stress-strain curve for ${PRESET_META[state.materialSlug]?.label ?? "custom material"}`}
          draw={draw}
          paused={paused}
        />
        <MathHud corner="top-right" lines={hudLines} />
        {hasError ? (
          <div className="ss-visualizer__error" role="alert">
            Invalid parameters — adjust sliders so σ_y/E ≤ plateau-end strain &lt; failure strain.
          </div>
        ) : null}
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ss-visualizer__controls">
        <SliderRow
          label="E (GPa)"
          description="Young's modulus — slope of the linear elastic region."
          min={50}
          max={300}
          step={10}
          value={state.E_GPa}
          onChange={(E_GPa) => setState({ ...state, E_GPa })}
          format={{ precision: 0, unit: "GPa" }}
        />
        <SliderRow
          label="Yield stress σ_y"
          description="Stress at which plastic deformation begins."
          min={50}
          max={800}
          step={10}
          value={state.yieldStress_MPa}
          onChange={(yieldStress_MPa) => setState({ ...state, yieldStress_MPa })}
          format={{ precision: 0, unit: "MPa" }}
        />
        <SliderRow
          label="Ultimate stress σ_u"
          description="Peak engineering stress before necking starts."
          min={100}
          max={1200}
          step={10}
          value={state.ultimateStress_MPa}
          onChange={(ultimateStress_MPa) => setState({ ...state, ultimateStress_MPa })}
          format={{ precision: 0, unit: "MPa" }}
        />
        <SliderRow
          label="Plateau end strain ε_h"
          description="Strain at which strain-hardening begins."
          min={0.005}
          max={0.05}
          step={0.005}
          value={state.plateauEndStrain}
          onChange={(plateauEndStrain) => setState({ ...state, plateauEndStrain })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Failure strain ε_f"
          description="Strain at which fracture occurs."
          min={0.05}
          max={0.3}
          step={0.01}
          value={state.failureStrain}
          onChange={(failureStrain) => setState({ ...state, failureStrain })}
          format={{ precision: 2 }}
        />
      </div>

      <div className="ss-visualizer__actions">
        <button type="button" className="ss-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="ss-visualizer__counter" aria-live="off">
          σ_y = {state.yieldStress_MPa} MPa
        </span>
      </div>
    </div>
  );
}
