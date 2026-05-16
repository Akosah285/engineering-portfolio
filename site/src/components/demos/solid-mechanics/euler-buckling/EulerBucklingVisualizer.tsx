import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type EndCondition, eulerCriticalLoad } from "./algorithm";
import {
  DEFAULT_STATE,
  END_CONDITION_SLUGS,
  type EulerBucklingDemoState,
  PRESETS,
  PRESET_META,
} from "./presets";
import "./EulerBucklingVisualizer.css";

/**
 * <EulerBucklingVisualizer> — solid-mechanics demo for Euler's critical-load
 * formula (#91). Side-by-side schematic + capacity panel.
 */

const STATE_SCHEMA = {
  endConditionSlug: {
    type: "enum",
    default: DEFAULT_STATE.endConditionSlug,
    values: END_CONDITION_SLUGS,
  },
  L: { type: "number", default: DEFAULT_STATE.L },
  E_GPa: { type: "number", default: DEFAULT_STATE.E_GPa },
  I_cm4: { type: "number", default: DEFAULT_STATE.I_cm4 },
  area_cm2: { type: "number", default: DEFAULT_STATE.area_cm2 },
  yieldStress_MPa: { type: "number", default: DEFAULT_STATE.yieldStress_MPa },
} as const satisfies Schema;

function computeBuckling(state: EulerBucklingDemoState) {
  const E_Pa = state.E_GPa * 1e9;
  const I_m4 = state.I_cm4 * 1e-8;
  const area_m2 = state.area_cm2 * 1e-4;
  const yieldStress_Pa = state.yieldStress_MPa * 1e6;
  const result = eulerCriticalLoad({
    E: E_Pa,
    I: I_m4,
    L: state.L,
    endCondition: state.endConditionSlug,
    area: area_m2,
    yieldStress: yieldStress_Pa,
  });
  return {
    result,
    P_cr_kN: result.criticalLoad / 1000,
    sigma_cr_MPa: (result.criticalStress ?? 0) / 1e6,
    lambda: result.slendernessRatio ?? 0,
    lambdaC: result.criticalSlenderness ?? 0,
  };
}

const narrationTemplate = (state: EulerBucklingDemoState): string => {
  const { result, P_cr_kN, lambda, lambdaC } = computeBuckling(state);
  const label = PRESET_META[state.endConditionSlug].label;
  const tail = result.validIfSlenderEnough
    ? "(slender — Euler governs)"
    : "(stocky — yield may govern)";
  return `Euler buckling for ${label} column (K = ${result.K}). Critical load P_cr = ${P_cr_kN.toFixed(1)} kN, slenderness λ = ${lambda.toFixed(1)} vs λ_c = ${lambdaC.toFixed(1)} ${tail}.`;
};

// --- Drawing helpers --------------------------------------------------------

const PANEL_LEFT_X = 120; // column centerline x in the left panel
const COL_TOP_Y = 50;
const COL_BOTTOM_Y = 310;
const COL_HEIGHT_PX = COL_BOTTOM_Y - COL_TOP_Y; // 260
const COL_WIDTH_PX = 16;

function drawHatchedWall(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  width: number,
): void {
  const half = width / 2;
  ctx.save();
  ctx.strokeStyle = "#445";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let x = cx - half; x <= cx + half; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pointingUp: boolean,
): void {
  ctx.save();
  ctx.fillStyle = "#445";
  ctx.beginPath();
  if (pointingUp) {
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
  } else {
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnd(
  ctx: CanvasRenderingContext2D,
  kind: "pinned" | "fixed" | "free",
  cx: number,
  cy: number,
  isTop: boolean,
): void {
  if (kind === "pinned") {
    drawTriangle(ctx, cx, cy, !isTop);
  } else if (kind === "fixed") {
    drawHatchedWall(ctx, cx, cy, 40);
  }
}

function drawLoadArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#cf4f4f";
  ctx.fillStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  const tailY = topY - 36;
  ctx.beginPath();
  ctx.moveTo(cx, tailY);
  ctx.lineTo(cx, topY - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - 6, topY - 8);
  ctx.lineTo(cx + 6, topY - 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = "13px 'Inter Variable', sans-serif";
  ctx.fillText("P", cx + 10, tailY + 8);
  ctx.restore();
}

function drawColumnPanel(
  ctx: CanvasRenderingContext2D,
  endCondition: EndCondition,
  L: number,
): void {
  const [topKind, bottomKind] = endCondition.split("-") as [
    "pinned" | "fixed",
    "pinned" | "fixed" | "free",
  ];

  // Mode shape: small horizontal deflection at midheight.
  const amp = 14;
  ctx.save();
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const t = i / 60; // 0 at top, 1 at bottom
    const y = COL_TOP_Y + t * COL_HEIGHT_PX;
    let dx: number;
    if (endCondition === "fixed-free") {
      // Cantilever first mode: cos(πt/2) deflection at the free end (top).
      // Convention here: bottom fixed, top free -> deflection grows toward top.
      dx = amp * (1 - Math.cos((Math.PI * (1 - t)) / 2));
    } else {
      dx = amp * Math.sin(Math.PI * t);
    }
    const x = PANEL_LEFT_X + dx;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Undeflected centerline (faint)
  ctx.save();
  ctx.strokeStyle = "rgba(80, 80, 80, 0.25)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PANEL_LEFT_X, COL_TOP_Y);
  ctx.lineTo(PANEL_LEFT_X, COL_BOTTOM_Y);
  ctx.stroke();
  ctx.restore();

  // End markers
  drawEnd(ctx, topKind, PANEL_LEFT_X, COL_TOP_Y, true);
  drawEnd(ctx, bottomKind, PANEL_LEFT_X, COL_BOTTOM_Y, false);

  // Load arrow at the top
  drawLoadArrow(ctx, PANEL_LEFT_X, COL_TOP_Y - 14);

  // L dimension on the left
  ctx.save();
  ctx.strokeStyle = "#445";
  ctx.lineWidth = 1;
  const dimX = PANEL_LEFT_X - 50;
  ctx.beginPath();
  ctx.moveTo(dimX, COL_TOP_Y);
  ctx.lineTo(dimX, COL_BOTTOM_Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(dimX - 4, COL_TOP_Y);
  ctx.lineTo(dimX + 4, COL_TOP_Y);
  ctx.moveTo(dimX - 4, COL_BOTTOM_Y);
  ctx.lineTo(dimX + 4, COL_BOTTOM_Y);
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.fillText(
    `L = ${L.toFixed(1)} m`,
    dimX - 36,
    (COL_TOP_Y + COL_BOTTOM_Y) / 2,
  );
  ctx.restore();

  // Column width hint (faint rectangle behind centerline at top end)
  ctx.save();
  ctx.fillStyle = "rgba(0, 105, 62, 0.08)";
  ctx.fillRect(
    PANEL_LEFT_X - COL_WIDTH_PX / 2,
    COL_TOP_Y,
    COL_WIDTH_PX,
    COL_HEIGHT_PX,
  );
  ctx.restore();
}

function drawCapacityPanel(
  ctx: CanvasRenderingContext2D,
  P_cr_kN: number,
  sigma_cr_MPa: number,
  yieldStress_MPa: number,
  lambda: number,
  lambdaC: number,
  validIfSlenderEnough: boolean | null,
): void {
  const panelX = 320;
  const panelW = 300;
  ctx.save();
  ctx.fillStyle = "#222";
  ctx.font = "bold 14px 'Inter Variable', sans-serif";
  ctx.fillText("Capacity", panelX, 40);

  // --- Load bar -----------------------------------------------------------
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.fillStyle = "#444";
  ctx.fillText("P_cr (kN)", panelX, 70);
  const loadBarY = 80;
  const loadBarH = 22;
  // Logarithmic-ish scale: cap at 10 MN (10,000 kN). Use sqrt for visual spread.
  const loadFrac = Math.min(1, Math.sqrt(P_cr_kN / 10000));
  ctx.fillStyle = "rgba(0, 105, 62, 0.18)";
  ctx.fillRect(panelX, loadBarY, panelW, loadBarH);
  ctx.fillStyle = "#00693e";
  ctx.fillRect(panelX, loadBarY, panelW * loadFrac, loadBarH);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px 'JetBrains Mono Variable', monospace";
  ctx.fillText(`${P_cr_kN.toFixed(1)} kN`, panelX + 8, loadBarY + 15);

  // --- Stress bar with yield overlay --------------------------------------
  ctx.fillStyle = "#444";
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.fillText("σ_cr (MPa)", panelX, 130);
  const stressBarY = 140;
  const stressBarH = 22;
  const stressScale = Math.max(sigma_cr_MPa, yieldStress_MPa, 1) * 1.2;
  const stressFrac = Math.min(1, sigma_cr_MPa / stressScale);
  ctx.fillStyle = "rgba(80, 100, 180, 0.18)";
  ctx.fillRect(panelX, stressBarY, panelW, stressBarH);
  ctx.fillStyle = "#5060b4";
  ctx.fillRect(panelX, stressBarY, panelW * stressFrac, stressBarH);
  // Yield overlay line
  const yieldX = panelX + panelW * Math.min(1, yieldStress_MPa / stressScale);
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(yieldX, stressBarY - 4);
  ctx.lineTo(yieldX, stressBarY + stressBarH + 4);
  ctx.stroke();
  ctx.fillStyle = "#cf4f4f";
  ctx.font = "10px 'Inter Variable', sans-serif";
  ctx.fillText(`σ_y=${yieldStress_MPa.toFixed(0)}`, yieldX + 4, stressBarY - 6);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px 'JetBrains Mono Variable', monospace";
  ctx.fillText(`${sigma_cr_MPa.toFixed(1)} MPa`, panelX + 8, stressBarY + 15);

  // --- Slenderness comparison --------------------------------------------
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.fillStyle = "#444";
  ctx.fillText("Slenderness", panelX, 195);

  const ok = validIfSlenderEnough === true;
  ctx.fillStyle = ok ? "#00693e" : "#cf4f4f";
  ctx.font = "bold 13px 'JetBrains Mono Variable', monospace";
  ctx.fillText(
    `λ = ${lambda.toFixed(1)}    λ_c = ${lambdaC.toFixed(1)}`,
    panelX,
    215,
  );
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText(
    ok ? "slender — Euler valid" : "stocky — yield may govern",
    panelX,
    232,
  );

  ctx.restore();
}

// --- Component --------------------------------------------------------------

export function EulerBucklingVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "euler-buckling",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { result, P_cr_kN, sigma_cr_MPa, lambda, lambdaC } = useMemo(
    () => computeBuckling(state),
    [state],
  );

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      // Faint divider between the two panels
      ctx.save();
      ctx.strokeStyle = "rgba(80, 80, 80, 0.25)";
      ctx.beginPath();
      ctx.moveTo(width / 2, 20);
      ctx.lineTo(width / 2, height - 20);
      ctx.stroke();
      ctx.restore();

      drawColumnPanel(ctx, state.endConditionSlug, state.L);
      drawCapacityPanel(
        ctx,
        P_cr_kN,
        sigma_cr_MPa,
        state.yieldStress_MPa,
        lambda,
        lambdaC,
        result.validIfSlenderEnough,
      );
    },
    [
      state.endConditionSlug,
      state.L,
      state.yieldStress_MPa,
      P_cr_kN,
      sigma_cr_MPa,
      lambda,
      lambdaC,
      result.validIfSlenderEnough,
    ],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="eb-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Euler buckling end-condition presets"
      />

      <div className="eb-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Euler buckling schematic for ${PRESET_META[state.endConditionSlug].label} column`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `K = ${result.K}`,
            `P_{cr} = ${P_cr_kN.toFixed(1)} \\text{ kN}`,
            `\\lambda = ${lambda.toFixed(1)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="eb-visualizer__controls">
        <SliderRow
          label="L (length)"
          min={0.5}
          max={5}
          step={0.1}
          value={state.L}
          onChange={(L) => setState({ ...state, L })}
          format={{ precision: 1, unit: "m" }}
        />
        <SliderRow
          label="E (GPa)"
          description="Young's modulus of the column material."
          min={50}
          max={300}
          step={10}
          value={state.E_GPa}
          onChange={(E_GPa) => setState({ ...state, E_GPa })}
          format={{ precision: 0, unit: "GPa" }}
        />
        <SliderRow
          label="I (cm⁴)"
          description="Smallest second moment of area of the cross-section."
          min={10}
          max={10000}
          step={10}
          value={state.I_cm4}
          onChange={(I_cm4) => setState({ ...state, I_cm4 })}
          format={{ precision: 0, unit: "cm⁴" }}
        />
        <SliderRow
          label="Area (cm²)"
          min={1}
          max={100}
          step={1}
          value={state.area_cm2}
          onChange={(area_cm2) => setState({ ...state, area_cm2 })}
          format={{ precision: 0, unit: "cm²" }}
        />
        <SliderRow
          label="Yield stress σ_y (MPa)"
          min={50}
          max={800}
          step={10}
          value={state.yieldStress_MPa}
          onChange={(yieldStress_MPa) => setState({ ...state, yieldStress_MPa })}
          format={{ precision: 0, unit: "MPa" }}
        />
      </div>

      <div className="eb-visualizer__actions">
        <button
          type="button"
          className="eb-visualizer__btn"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="eb-visualizer__counter" aria-live="off">
          P_cr = {P_cr_kN.toFixed(1)} kN
        </span>
      </div>
    </div>
  );
}
