import { useCallback, useMemo, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { fieldGrid, type GridSamplePoint, type PointCharge } from "./algorithm";
import {
  type ChargeFieldDemoState,
  DEFAULT_STATE,
  PRESET_META,
  PRESET_SLUGS,
  PRESETS,
} from "./presets";
import "./ChargeFieldVisualizer.css";

/**
 * <ChargeFieldVisualizer> — visualises the 2D electrostatic field from a
 * preset configuration of point charges. Wraps the pure `fieldGrid` /
 * `fieldAt` algorithm in the demo-kit primitives.
 */

const X_MIN = -2;
const X_MAX = 2;
const Y_MIN = -2;
const Y_MAX = 2;

const STATE_SCHEMA = {
  preset: { type: "enum", default: DEFAULT_STATE.preset, values: PRESET_SLUGS },
  nx: { type: "number", default: DEFAULT_STATE.nx },
  ny: { type: "number", default: DEFAULT_STATE.ny },
  arrowScale: { type: "number", default: DEFAULT_STATE.arrowScale },
  showPotential: { type: "number", default: DEFAULT_STATE.showPotential },
} as const satisfies Schema;

const narrationTemplate = (state: ChargeFieldDemoState): string => {
  const meta = PRESET_META[state.preset];
  return `${meta.narration} Field sampled on a ${state.nx}×${state.ny} grid over [${X_MIN}, ${X_MAX}] × [${Y_MIN}, ${Y_MAX}].`;
};

function project(
  x: number,
  y: number,
  width: number,
  height: number,
): readonly [number, number] {
  const cx = ((x - X_MIN) / (X_MAX - X_MIN)) * width;
  const cy = height - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * height;
  return [cx, cy];
}

function paintPotential(
  ctx: CanvasRenderingContext2D,
  charges: readonly PointCharge[],
): void {
  const { width, height } = ctx.canvas;
  const cols = 60;
  const rows = 60;
  const samples = fieldGrid({
    charges,
    xMin: X_MIN,
    xMax: X_MAX,
    yMin: Y_MIN,
    yMax: Y_MAX,
    nx: cols,
    ny: rows,
  });
  let maxV = 0;
  for (const s of samples) {
    if (Number.isFinite(s.potential)) {
      const a = Math.abs(s.potential);
      if (a > maxV) maxV = a;
    }
  }
  if (maxV === 0) return;
  const cellW = width / (cols - 1);
  const cellH = height / (rows - 1);
  for (const s of samples) {
    if (!Number.isFinite(s.potential)) continue;
    const t = Math.tanh(s.potential / (maxV * 0.25));
    const r = t > 0 ? Math.round(220 + t * 35) : Math.round(220 + t * -35);
    const g = Math.round(220 - Math.abs(t) * 60);
    const b = t < 0 ? Math.round(220 + -t * 35) : Math.round(220 - t * 35);
    const [cx, cy] = project(s.x, s.y, width, height);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
    ctx.fillRect(cx - cellW / 2, cy - cellH / 2, cellW + 1, cellH + 1);
  }
}

function paintArrows(
  ctx: CanvasRenderingContext2D,
  samples: readonly GridSamplePoint[],
  arrowScale: number,
): void {
  const { width, height } = ctx.canvas;
  let maxMag = 0;
  for (const s of samples) {
    if (Number.isFinite(s.magnitude) && s.magnitude > maxMag) maxMag = s.magnitude;
  }
  if (maxMag === 0) return;
  const baseLen = Math.min(width, height) / 28;
  ctx.strokeStyle = "#1f2933";
  ctx.fillStyle = "#1f2933";
  ctx.lineWidth = 1;

  for (const s of samples) {
    if (!Number.isFinite(s.magnitude) || s.magnitude === 0) continue;
    const norm = s.magnitude / maxMag;
    const len = baseLen * arrowScale * (0.2 + 0.8 * Math.sqrt(norm));
    const ux = s.Ex / s.magnitude;
    const uy = s.Ey / s.magnitude;
    const [cx, cy] = project(s.x, s.y, width, height);
    // Canvas y is inverted: world +y → screen -y
    const dx = ux * len;
    const dy = -uy * len;
    const ex = cx + dx;
    const ey = cy + dy;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // arrowhead
    const ah = Math.max(2, len * 0.3);
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ah * Math.cos(ang - Math.PI / 6), ey - ah * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(ex - ah * Math.cos(ang + Math.PI / 6), ey - ah * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
}

function paintCharges(
  ctx: CanvasRenderingContext2D,
  charges: readonly PointCharge[],
): void {
  const { width, height } = ctx.canvas;
  for (const c of charges) {
    const [cx, cy] = project(c.x, c.y, width, height);
    const radius = 4 + Math.abs(c.q) * 6;
    ctx.fillStyle = c.q >= 0 ? "#cf4f4f" : "#3a6ea5";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.q >= 0 ? "+" : "−", cx, cy);
  }
}

export default function ChargeFieldVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "charge-field",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const charges = useMemo(() => PRESET_META[state.preset].charges, [state.preset]);

  const samples = useMemo(
    () =>
      fieldGrid({
        charges,
        xMin: X_MIN,
        xMax: X_MAX,
        yMin: Y_MIN,
        yMax: Y_MAX,
        nx: state.nx,
        ny: state.ny,
      }),
    [charges, state.nx, state.ny],
  );

  const { maxE, maxV } = useMemo(() => {
    let mE = 0;
    let mV = 0;
    for (const s of samples) {
      if (Number.isFinite(s.magnitude) && s.magnitude > mE) mE = s.magnitude;
      if (Number.isFinite(s.potential)) {
        const a = Math.abs(s.potential);
        if (a > mV) mV = a;
      }
    }
    return { maxE: mE, maxV: mV };
  }, [samples]);

  const showPotential = state.showPotential >= 0.5;

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = "#fafaf7";
      ctx.fillRect(0, 0, width, height);
      if (showPotential) paintPotential(ctx, charges);
      paintArrows(ctx, samples, state.arrowScale);
      paintCharges(ctx, charges);
    },
    [charges, samples, state.arrowScale, showPotential],
  );

  const [paused] = useState(false);

  const handlePresetSelect = (next: ChargeFieldDemoState): void => {
    setState({ ...state, ...next });
  };

  return (
    <div className="cf-visualizer">
      <PresetCarousel
        presets={PRESETS as readonly { name: string; state: ChargeFieldDemoState }[] as {
          name: string;
          state: ChargeFieldDemoState;
        }[]}
        onSelect={handlePresetSelect}
        ariaLabel="Charge field presets"
      />

      <div className="cf-visualizer__stage">
        <DemoCanvas
          width={520}
          height={520}
          ariaLabel={`Electric field of ${PRESET_META[state.preset].label}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `N = ${charges.length}`,
            `\\max |E| = ${maxE.toFixed(2)}`,
            `\\max |V| = ${maxV.toFixed(2)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="cf-visualizer__controls">
        <SliderRow
          label="nx (grid columns)"
          min={10}
          max={30}
          step={2}
          value={state.nx}
          onChange={(nx) => setState({ ...state, nx })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="ny (grid rows)"
          min={10}
          max={30}
          step={2}
          value={state.ny}
          onChange={(ny) => setState({ ...state, ny })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Arrow scale"
          min={0.2}
          max={2.0}
          step={0.1}
          value={state.arrowScale}
          onChange={(arrowScale) => setState({ ...state, arrowScale })}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="Show potential (0=off, 1=on)"
          min={0}
          max={1}
          step={1}
          value={state.showPotential}
          onChange={(showPotential) => setState({ ...state, showPotential })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="cf-visualizer__actions">
        <button type="button" className="cf-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="cf-visualizer__counter" aria-live="off">
          charges {charges.length} · max |E| = {maxE.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
