import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type BeamInput,
  type PointLoad,
  type Udl,
  analyze,
} from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  PRESET_META,
  PRESET_SLUGS,
  type ShearMomentDemoState,
} from "./presets";
import "./ShearMomentVisualizer.css";

/**
 * <ShearMomentVisualizer> — Solid Mechanics v6 hero demo (#96).
 *
 * Wraps the pure `analyze` algorithm in a 3-panel canvas (beam schematic,
 * shear diagram V(x), moment diagram M(x)) plus a parameter HUD.
 */

const CANVAS_W = 640;
const CANVAS_H = 420;
const PANEL_H = CANVAS_H / 3;
const MARGIN_X = 40;

const STATE_SCHEMA = {
  preset: { type: "enum", default: DEFAULT_STATE.preset, values: PRESET_SLUGS },
  L: { type: "number", default: DEFAULT_STATE.L },
  P: { type: "number", default: DEFAULT_STATE.P },
  xP: { type: "number", default: DEFAULT_STATE.xP },
  w: { type: "number", default: DEFAULT_STATE.w },
} as const satisfies Schema;

/** Build a SI-unit BeamInput from the kN-unit demo state. */
function toBeamInput(state: ShearMomentDemoState): BeamInput {
  const L = state.L;
  const xP = Math.min(Math.max(state.xP, 0), L);
  const pointLoads: PointLoad[] =
    state.P > 0 ? [{ x: xP, P: state.P * 1000 }] : [];
  const udls: Udl[] =
    state.w > 0 ? [{ xStart: 0, xEnd: L, w: state.w * 1000 }] : [];
  return {
    L,
    ...(pointLoads.length > 0 ? { pointLoads } : {}),
    ...(udls.length > 0 ? { udls } : {}),
  };
}

const narrationTemplate = (state: ShearMomentDemoState): string => {
  const meta = PRESET_META[state.preset];
  return `${meta.narration} Span L = ${state.L.toFixed(1)} m, P = ${state.P.toFixed(1)} kN at x = ${state.xP.toFixed(2)} m, w = ${state.w.toFixed(1)} kN/m.`;
};

interface Range {
  readonly min: number;
  readonly max: number;
}

function symRange(min: number, max: number): Range {
  const a = Math.max(Math.abs(min), Math.abs(max), 1e-9);
  return { min: -a, max: a };
}

/** Map a beam x in [0, L] to a canvas x. */
function beamX(x: number, L: number): number {
  return MARGIN_X + (x / L) * (CANVAS_W - 2 * MARGIN_X);
}

function drawSchematic(
  ctx: CanvasRenderingContext2D,
  state: ShearMomentDemoState,
  yTop: number,
): void {
  const L = state.L;
  const beamY = yTop + PANEL_H * 0.65;
  const xL = beamX(0, L);
  const xR = beamX(L, L);

  // Beam line
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xL, beamY);
  ctx.lineTo(xR, beamY);
  ctx.stroke();

  // Pin support at A (triangle)
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(xL, beamY);
  ctx.lineTo(xL - 9, beamY + 16);
  ctx.lineTo(xL + 9, beamY + 16);
  ctx.closePath();
  ctx.fill();

  // Roller support at B (circle)
  ctx.beginPath();
  ctx.arc(xR, beamY + 9, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xR - 12, beamY + 18);
  ctx.lineTo(xR + 12, beamY + 18);
  ctx.stroke();

  // UDL: hatched rectangle above the beam
  if (state.w > 0) {
    const top = beamY - 36;
    const left = xL;
    const width = xR - xL;
    ctx.fillStyle = "rgba(0, 105, 62, 0.12)";
    ctx.fillRect(left, top, width, 28);
    ctx.strokeStyle = "#00693e";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 14; i += 1) {
      const x = left + (i / 14) * width;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + 28);
      ctx.stroke();
      // Tiny downward arrowheads
      ctx.beginPath();
      ctx.moveTo(x, beamY - 4);
      ctx.lineTo(x - 3, beamY - 9);
      ctx.lineTo(x + 3, beamY - 9);
      ctx.closePath();
      ctx.fillStyle = "#00693e";
      ctx.fill();
    }
  }

  // Point load: downward arrow at xP
  if (state.P > 0) {
    const x = beamX(state.xP, L);
    const top = beamY - 60;
    ctx.strokeStyle = "#cf4f4f";
    ctx.fillStyle = "#cf4f4f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, beamY - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, beamY - 1);
    ctx.lineTo(x - 5, beamY - 9);
    ctx.lineTo(x + 5, beamY - 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = "12px 'Inter Variable', sans-serif";
    ctx.fillText(`P = ${state.P.toFixed(1)} kN`, x + 6, top + 10);
  }

  // Axis labels
  ctx.fillStyle = "#444";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.fillText("A", xL - 6, beamY + 32);
  ctx.fillText("B", xR - 4, beamY + 32);
}

function drawDiagram(
  ctx: CanvasRenderingContext2D,
  samples: readonly { x: number; V: number; M: number }[],
  L: number,
  yTop: number,
  field: "V" | "M",
  label: string,
  fillPos: string,
  fillNeg: string,
): { yMax: number; yMin: number; absMax: number; xAtMax: number } {
  // Determine vertical scale
  let yMax = 0;
  let yMin = 0;
  for (const s of samples) {
    const v = s[field];
    if (v > yMax) yMax = v;
    if (v < yMin) yMin = v;
  }
  const range = symRange(yMin, yMax);
  const usableTop = yTop + 12;
  const usableBottom = yTop + PANEL_H - 18;
  const axisY = (usableTop + usableBottom) / 2;
  const scale = (usableBottom - usableTop) / 2 / range.max;

  const toY = (v: number): number => axisY - v * scale;

  // Zero axis line
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(beamX(0, L), axisY);
  ctx.lineTo(beamX(L, L), axisY);
  ctx.stroke();

  // Filled area (positive above axis = fillPos, negative below = fillNeg)
  const path = (sign: 1 | -1, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(beamX(samples[0]!.x, L), axisY);
    for (const s of samples) {
      const v = s[field];
      const clipped = sign > 0 ? Math.max(0, v) : Math.min(0, v);
      ctx.lineTo(beamX(s.x, L), toY(clipped));
    }
    ctx.lineTo(beamX(samples[samples.length - 1]!.x, L), axisY);
    ctx.closePath();
    ctx.fill();
  };
  path(1, fillPos);
  path(-1, fillNeg);

  // Outline
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  samples.forEach((s, i) => {
    const cx = beamX(s.x, L);
    const cy = toY(s[field]);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // Find x at max |field|
  let absMax = 0;
  let xAtMax = 0;
  for (const s of samples) {
    const a = Math.abs(s[field]);
    if (a > absMax) {
      absMax = a;
      xAtMax = s.x;
    }
  }

  // Label
  ctx.fillStyle = "#222";
  ctx.font = "12px 'Inter Variable', sans-serif";
  ctx.fillText(label, MARGIN_X - 30, yTop + 14);

  return { yMax, yMin, absMax, xAtMax };
}

export function ShearMomentVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "shear-moment",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const result = useMemo(() => {
    try {
      return analyze(toBeamInput(state));
    } catch {
      return null;
    }
  }, [state]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      drawSchematic(ctx, state, 0);

      if (!result) return;
      const mDiag = drawDiagram(
        ctx,
        result.samples,
        state.L,
        PANEL_H * 2,
        "M",
        "M(x) [N·m]",
        "rgba(0, 105, 62, 0.25)",
        "rgba(0, 105, 62, 0.15)",
      );
      drawDiagram(
        ctx,
        result.samples,
        state.L,
        PANEL_H,
        "V",
        "V(x) [N]",
        "rgba(207, 79, 79, 0.22)",
        "rgba(207, 79, 79, 0.12)",
      );

      // Mark max |M| location with a vertical dashed line on moment panel
      const cx = beamX(mDiag.xAtMax, state.L);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#00693e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, PANEL_H * 2 + 8);
      ctx.lineTo(cx, PANEL_H * 3 - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#00693e";
      ctx.font = "11px 'Inter Variable', sans-serif";
      ctx.fillText(`|M|max @ x=${mDiag.xAtMax.toFixed(2)} m`, cx + 4, PANEL_H * 2 + 22);
    },
    [state, result],
  );

  const samples = result?.samples ?? [];
  const vMax = samples.length
    ? Math.max(...samples.map((s) => Math.abs(s.V)))
    : 0;
  const mMax = samples.length
    ? Math.max(...samples.map((s) => Math.abs(s.M)))
    : 0;
  const RA = result?.RA ?? 0;
  const RB = result?.RB ?? 0;

  const handlePresetSelect = (next: ShearMomentDemoState): void => {
    setState(next);
  };

  return (
    <div className="sm-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Shear and moment presets"
      />

      <div className="sm-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel="Beam schematic with shear and moment diagrams"
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `R_A = ${(RA / 1000).toFixed(2)}\\,\\text{kN}`,
            `R_B = ${(RB / 1000).toFixed(2)}\\,\\text{kN}`,
            `V_{\\max} = ${(vMax / 1000).toFixed(2)}\\,\\text{kN}`,
            `M_{\\max} = ${(mMax / 1000).toFixed(2)}\\,\\text{kN·m}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="sm-visualizer__controls">
        <SliderRow
          label="Span"
          description="Distance between the pin (A) and roller (B) supports."
          min={1}
          max={10}
          step={0.5}
          value={state.L}
          onChange={(L) => {
            const xP = Math.min(state.xP, L);
            setState({ ...state, L, xP });
          }}
          format={{ precision: 1, unit: "m" }}
        />
        <SliderRow
          label="P (kN)"
          description="Downward concentrated point load applied at position xP."
          min={0}
          max={20}
          step={1}
          value={state.P}
          onChange={(P) => setState({ ...state, P })}
          format={{ precision: 0, unit: "kN" }}
        />
        <SliderRow
          label="xP position"
          description="Where the point load acts, measured from support A."
          min={0}
          max={state.L}
          step={0.1}
          value={Math.min(state.xP, state.L)}
          onChange={(xP) => setState({ ...state, xP })}
          format={{ precision: 2, unit: "m" }}
        />
        <SliderRow
          label="w intensity (kN/m)"
          description="Uniformly distributed downward load over the whole span."
          min={0}
          max={10}
          step={0.5}
          value={state.w}
          onChange={(w) => setState({ ...state, w })}
          format={{ precision: 1, unit: "kN/m" }}
        />
      </div>

      <div className="sm-visualizer__actions">
        <button type="button" className="sm-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="sm-visualizer__counter" aria-live="off">
          |M|max = {(mMax / 1000).toFixed(2)} kN·m
        </span>
      </div>
    </div>
  );
}

export default ShearMomentVisualizer;
