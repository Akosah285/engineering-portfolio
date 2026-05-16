import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type Section,
  bendingStress,
  maxBendingStress,
  momentOfInertia,
  sectionModulus,
  yMax,
} from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  SECTION_KINDS,
  type BendingStressDemoState,
  type SectionKind,
} from "./presets";
import "./BendingStressVisualizer.css";

/**
 * <BendingStressVisualizer> — visual shell over the flexure-formula algorithm.
 *
 * Left panel: cross-section coloured by σ(y) (blue = compression, red = tension).
 * Right panel: linear σ(y) profile drawn as horizontal bars from -y_max..+y_max.
 */

const STATE_SCHEMA = {
  M: { type: "number", default: DEFAULT_STATE.M },
  kind: { type: "enum", default: DEFAULT_STATE.kind, values: SECTION_KINDS },
  dim1: { type: "number", default: DEFAULT_STATE.dim1 },
  dim2: { type: "number", default: DEFAULT_STATE.dim2 },
} as const satisfies Schema;

const CANVAS_W = 640;
const CANVAS_H = 360;
const PANEL_GAP = 16;
const PAD = 24;

function buildSection(state: BendingStressDemoState): Section {
  const d1 = state.dim1 / 1000;
  const d2 = state.dim2 / 1000;
  if (state.kind === "rect") return { kind: "rect", b: d1, h: d2 };
  if (state.kind === "circle") return { kind: "circle", R: d1 };
  // ibeam: outer B×H minus inner (0.6·B)×(0.8·H) per spec.
  return { kind: "ibeam", B: d1, H: d2, b: 0.6 * d1, h: 0.8 * d2 };
}

/** Half-width of the section at height y (metres). */
function sectionHalfWidthAtY(s: Section, y: number): number {
  if (s.kind === "rect") {
    if (Math.abs(y) > s.h / 2) return 0;
    return s.b / 2;
  }
  if (s.kind === "circle") {
    if (Math.abs(y) > s.R) return 0;
    return Math.sqrt(s.R * s.R - y * y);
  }
  // ibeam: web width when |y| within inner h, full B outside.
  if (Math.abs(y) > s.H / 2) return 0;
  if (Math.abs(y) <= s.h / 2) {
    // inside the web region: width = B - b (removed material on each side)
    return (s.B - s.b) / 2;
  }
  return s.B / 2;
}

/** Outer cross-section width (metres). */
function sectionOuterWidth(s: Section): number {
  if (s.kind === "rect") return s.b;
  if (s.kind === "circle") return 2 * s.R;
  return s.B;
}

/** Map normalised stress t∈[-1,1] to a CSS rgb string. */
function stressColor(t: number): string {
  const clamped = Math.max(-1, Math.min(1, t));
  if (clamped >= 0) {
    // tension → red
    const g = Math.round(240 * (1 - clamped));
    const b = Math.round(240 * (1 - clamped));
    return `rgb(245, ${g}, ${b})`;
  }
  const tt = -clamped;
  const r = Math.round(240 * (1 - tt));
  const g = Math.round(240 * (1 - tt));
  return `rgb(${r}, ${g}, 245)`;
}

function paintCrossSection(
  ctx: CanvasRenderingContext2D,
  s: Section,
  M: number,
  I: number,
  sigmaMax: number,
  panel: { x: number; y: number; w: number; h: number },
): void {
  const yM = yMax(s);
  const outerW = sectionOuterWidth(s);
  // Fit-to-panel scale.
  const scale = Math.min(
    (panel.w - 2 * PAD) / outerW,
    (panel.h - 2 * PAD) / (2 * yM),
  );
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;

  // Rasterize by horizontal strips (1px tall) so we can colour by σ(y).
  const rows = Math.round(2 * yM * scale);
  for (let i = 0; i < rows; i += 1) {
    // y in metres; positive upward.
    const yMetres = yM - ((i + 0.5) / rows) * (2 * yM);
    const halfW = sectionHalfWidthAtY(s, yMetres);
    if (halfW <= 0) continue;
    const sigma = bendingStress(M, yMetres, I);
    const t = sigmaMax > 0 ? sigma / sigmaMax : 0;
    ctx.fillStyle = stressColor(t);
    const px = cx - halfW * scale;
    const py = cy - yMetres * scale - 0.5;
    ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(halfW * 2 * scale), 2);
  }

  // Outline
  ctx.strokeStyle = "rgba(40, 40, 40, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (s.kind === "rect") {
    ctx.rect(cx - (s.b / 2) * scale, cy - (s.h / 2) * scale, s.b * scale, s.h * scale);
  } else if (s.kind === "circle") {
    ctx.arc(cx, cy, s.R * scale, 0, Math.PI * 2);
  } else {
    const B = s.B * scale;
    const H = s.H * scale;
    const hInner = s.h * scale;
    const webHalf = ((s.B - s.b) / 2) * scale;
    const left = cx - B / 2;
    const top = cy - H / 2;
    const flangeT = (H - hInner) / 2;
    // I-shape polygon, traced clockwise from top-left.
    ctx.moveTo(left, top);
    ctx.lineTo(left + B, top);
    ctx.lineTo(left + B, top + flangeT);
    ctx.lineTo(cx + webHalf, top + flangeT);
    ctx.lineTo(cx + webHalf, top + flangeT + hInner);
    ctx.lineTo(left + B, top + flangeT + hInner);
    ctx.lineTo(left + B, top + H);
    ctx.lineTo(left, top + H);
    ctx.lineTo(left, top + flangeT + hInner);
    ctx.lineTo(cx - webHalf, top + flangeT + hInner);
    ctx.lineTo(cx - webHalf, top + flangeT);
    ctx.lineTo(left, top + flangeT);
    ctx.closePath();
  }
  ctx.stroke();

  // Neutral axis (dashed horizontal line through centroid).
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(40, 40, 40, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panel.x + 8, cy);
  ctx.lineTo(panel.x + panel.w - 8, cy);
  ctx.stroke();
  ctx.restore();

  // Label
  ctx.fillStyle = "rgba(40,40,40,0.75)";
  ctx.font = "12px 'JetBrains Mono Variable', monospace";
  ctx.fillText("N.A.", panel.x + panel.w - 36, cy - 4);
}

function paintStressProfile(
  ctx: CanvasRenderingContext2D,
  s: Section,
  M: number,
  I: number,
  sigmaMax: number,
  panel: { x: number; y: number; w: number; h: number },
): void {
  const yM = yMax(s);
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  const yScale = (panel.h - 2 * PAD) / (2 * yM);
  const xScale = sigmaMax > 0 ? (panel.w / 2 - PAD) / sigmaMax : 0;

  // Background axes
  ctx.strokeStyle = "rgba(40,40,40,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, panel.y + 8);
  ctx.lineTo(cx, panel.y + panel.h - 8);
  ctx.moveTo(panel.x + 8, cy);
  ctx.lineTo(panel.x + panel.w - 8, cy);
  ctx.stroke();

  // Bars: one per pixel row across [-yMax, +yMax]
  const rows = Math.round(2 * yM * yScale);
  for (let i = 0; i < rows; i += 1) {
    const yMetres = yM - ((i + 0.5) / rows) * (2 * yM);
    const sigma = bendingStress(M, yMetres, I);
    const t = sigmaMax > 0 ? sigma / sigmaMax : 0;
    ctx.fillStyle = stressColor(t);
    const py = cy - yMetres * yScale - 0.5;
    const barLen = sigma * xScale;
    if (barLen >= 0) {
      ctx.fillRect(cx, Math.round(py), Math.ceil(barLen), 2);
    } else {
      ctx.fillRect(cx + Math.ceil(barLen), Math.round(py), Math.ceil(-barLen), 2);
    }
  }

  // Labels
  ctx.fillStyle = "rgba(40,40,40,0.8)";
  ctx.font = "11px 'JetBrains Mono Variable', monospace";
  ctx.fillText("σ(y)", cx + 6, panel.y + 18);
  ctx.fillText("−", panel.x + 12, cy - 4);
  ctx.fillText("+", panel.x + panel.w - 16, cy - 4);
}

export default function BendingStressVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "bending-stress",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const section = useMemo(() => buildSection(state), [state]);
  const M_SI = state.M * 1000; // kN·m → N·m
  const I = useMemo(() => momentOfInertia(section), [section]);
  const S = useMemo(() => sectionModulus(section), [section]);
  const yM = useMemo(() => yMax(section), [section]);
  const sigmaMax = useMemo(() => maxBendingStress(M_SI, section), [M_SI, section]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(252, 251, 248, 1)";
      ctx.fillRect(0, 0, width, height);

      const halfW = (width - PANEL_GAP) / 2;
      const left = { x: 0, y: 0, w: halfW, h: height };
      const right = { x: halfW + PANEL_GAP, y: 0, w: halfW, h: height };

      // Effective σ_max used for colour normalisation — guard zero moment.
      const effMax = sigmaMax > 0 ? sigmaMax : 1;
      paintCrossSection(ctx, section, M_SI, I, effMax, left);
      paintStressProfile(ctx, section, M_SI, I, effMax, right);
    },
    [section, M_SI, I, sigmaMax],
  );

  const kindIndex = SECTION_KINDS.indexOf(state.kind);

  const handleKindChange = (raw: number): void => {
    const idx = Math.max(0, Math.min(SECTION_KINDS.length - 1, Math.round(raw)));
    const nextKind: SectionKind = SECTION_KINDS[idx] ?? "rect";
    setState({ ...state, kind: nextKind });
  };

  const handlePresetSelect = (next: BendingStressDemoState): void => {
    setState(next);
  };

  const sigmaMaxMPa = sigmaMax / 1e6;

  const dim1Label =
    state.kind === "rect"
      ? "dim1 — width b (mm)"
      : state.kind === "circle"
        ? "dim1 — radius R (mm)"
        : "dim1 — outer flange width B (mm)";
  const dim2Label =
    state.kind === "rect"
      ? "dim2 — height h (mm)"
      : state.kind === "circle"
        ? "dim2 — unused (mm)"
        : "dim2 — overall height H (mm)";

  return (
    <div className="bn-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Bending stress presets"
      />

      <div className="bn-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Bending stress on a ${state.kind} section under M = ${state.M} kN·m`}
          draw={draw}
          paused={false}
        />
        <MathHud
          corner="top-right"
          lines={[
            `I = ${I.toExponential(3)}\\,\\text{m}^4`,
            `S = ${S.toExponential(3)}\\,\\text{m}^3`,
            `y_{\\max} = ${(yM * 1000).toFixed(1)}\\,\\text{mm}`,
            `\\sigma_{\\max} = ${sigmaMaxMPa.toFixed(2)}\\,\\text{MPa}`,
          ]}
        />
      </div>

      <div className="bn-visualizer__controls">
        <SliderRow
          label="M (moment, kN·m)"
          description="Applied bending moment. Positive → sagging (top in compression)."
          min={-50}
          max={50}
          step={1}
          value={state.M}
          onChange={(M) => setState({ ...state, M })}
          format={{ precision: 0, unit: "kN·m" }}
        />
        <SliderRow
          label={`kind (section: ${state.kind})`}
          description="0 = rect, 1 = circle, 2 = ibeam."
          min={0}
          max={SECTION_KINDS.length - 1}
          step={1}
          value={kindIndex < 0 ? 0 : kindIndex}
          onChange={handleKindChange}
          format={{ precision: 0 }}
        />
        <SliderRow
          label={dim1Label}
          min={20}
          max={500}
          step={10}
          value={state.dim1}
          onChange={(dim1) => setState({ ...state, dim1 })}
          format={{ precision: 0, unit: "mm" }}
        />
        <SliderRow
          label={dim2Label}
          min={20}
          max={500}
          step={10}
          value={state.dim2}
          onChange={(dim2) => setState({ ...state, dim2 })}
          format={{ precision: 0, unit: "mm" }}
          disabled={state.kind === "circle"}
        />
      </div>

      <div className="bn-visualizer__actions">
        <button type="button" className="bn-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="bn-visualizer__counter" aria-live="off">
          σ_max = {sigmaMaxMPa.toFixed(2)} MPa
        </span>
      </div>
    </div>
  );
}
