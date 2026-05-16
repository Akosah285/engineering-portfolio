import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { curlZ, divergence, sampleGrid } from "./algorithm";
import {
  COLORING_MODES,
  type ColoringMode,
  DEFAULT_STATE,
  FIELD_KINDS,
  type FieldKind,
  PRESETS,
  type VectorFieldDemoState,
} from "./presets";
import "./VectorFieldVisualizer.css";

/**
 * <VectorFieldVisualizer> — wraps the generic vector-field sampling algorithm
 * (#101) into a shareable React shell with arrow-glyph rendering, divergence/
 * curl coloring, and four named preset fields.
 */

const XMIN = -2;
const XMAX = 2;
const YMIN = -2;
const YMAX = 2;
const CANVAS_W = 640;
const CANVAS_H = 480;

const STATE_SCHEMA = {
  coloring: {
    type: "enum",
    default: DEFAULT_STATE.coloring,
    values: COLORING_MODES,
  },
  field: {
    type: "enum",
    default: DEFAULT_STATE.field,
    values: FIELD_KINDS,
  },
  nx: { type: "number", default: DEFAULT_STATE.nx },
  ny: { type: "number", default: DEFAULT_STATE.ny },
} as const satisfies Schema;

function fieldFn(kind: FieldKind): (x: number, y: number) => { fx: number; fy: number } {
  switch (kind) {
    case "uniform":
      return () => ({ fx: 1, fy: 0.3 });
    case "radial":
      return (x, y) => ({ fx: x, fy: y });
    case "vortex":
      return (x, y) => ({ fx: -y, fy: x });
    case "saddle":
      return (x, y) => ({ fx: x, fy: -y });
  }
}

function toCanvas(x: number, y: number): readonly [number, number] {
  const cx = ((x - XMIN) / (XMAX - XMIN)) * CANVAS_W;
  const cy = CANVAS_H - ((y - YMIN) / (YMAX - YMIN)) * CANVAS_H;
  return [cx, cy];
}

/** Diverging red↔blue ramp. t ∈ [-1, 1]; t > 0 red, t < 0 blue. */
function divergingColor(t: number): string {
  const clamped = Math.max(-1, Math.min(1, t));
  if (clamped >= 0) {
    // red ramp
    const r = 200;
    const g = Math.round(180 - clamped * 140);
    const b = Math.round(180 - clamped * 140);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const a = -clamped;
  const r = Math.round(180 - a * 140);
  const g = Math.round(180 - a * 100);
  const b = 200;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Greyscale ramp keyed on magnitude (t ∈ [0,1]). */
function magnitudeColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const grey = Math.round(180 - clamped * 130);
  const green = Math.round(170 - clamped * 110);
  return `rgb(${grey}, ${green}, ${grey})`;
}

export function VectorFieldVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "vector-field",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { grid, divs, curls, maxAbsDiv, maxAbsCurl } = useMemo(() => {
    const f = fieldFn(state.field);
    const g = sampleGrid({
      f,
      xmin: XMIN,
      xmax: XMAX,
      ymin: YMIN,
      ymax: YMAX,
      nx: state.nx,
      ny: state.ny,
    });
    const d = divergence(g, XMIN, XMAX, YMIN, YMAX);
    const c = curlZ(g, XMIN, XMAX, YMIN, YMAX);
    let mD = 0;
    let mC = 0;
    for (const v of d) {
      const a = Math.abs(v);
      if (a > mD) mD = a;
    }
    for (const v of c) {
      const a = Math.abs(v);
      if (a > mC) mC = a;
    }
    return { grid: g, divs: d, curls: c, maxAbsDiv: mD, maxAbsCurl: mC };
  }, [state.field, state.nx, state.ny]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = "#fbfaf6";
      ctx.fillRect(0, 0, width, height);

      const cellW = width / state.nx;
      const cellH = height / state.ny;
      const cellSize = Math.min(cellW, cellH);
      const maxMag = grid.maxMagnitude || 1;

      for (let i = 0; i < grid.samples.length; i += 1) {
        const s = grid.samples[i]!;
        const [cx, cy] = toCanvas(s.x, s.y);

        // Choose color
        let color: string;
        if (state.coloring === "divergence") {
          const t = maxAbsDiv > 0 ? divs[i]! / maxAbsDiv : 0;
          color = divergingColor(t);
        } else if (state.coloring === "curl") {
          const t = maxAbsCurl > 0 ? curls[i]! / maxAbsCurl : 0;
          color = divergingColor(t);
        } else {
          color = magnitudeColor(s.magnitude / maxMag);
        }

        // Arrow length normalized to cellSize
        const len = (s.magnitude / maxMag) * cellSize * 0.9;
        const mag = s.magnitude || 1;
        // dy flipped because canvas y is inverted
        const ux = s.fx / mag;
        const uy = -s.fy / mag;
        const ex = cx + ux * len;
        const ey = cy + uy * len;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrowhead
        const headLen = Math.max(3, cellSize * 0.18);
        const angle = Math.atan2(uy, ux);
        const a1 = angle + Math.PI - 0.4;
        const a2 = angle + Math.PI + 0.4;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(a1) * headLen, ey + Math.sin(a1) * headLen);
        ctx.lineTo(ex + Math.cos(a2) * headLen, ey + Math.sin(a2) * headLen);
        ctx.closePath();
        ctx.fill();
      }
    },
    [grid, divs, curls, maxAbsDiv, maxAbsCurl, state.coloring, state.nx, state.ny],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: VectorFieldDemoState): void => {
    setState(next);
  };

  // Map enum <-> index for slider control
  const coloringIdx = COLORING_MODES.indexOf(state.coloring);
  const fieldIdx = FIELD_KINDS.indexOf(state.field);

  return (
    <div className="vf-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: VectorFieldDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Vector field presets"
      />

      <div className="vf-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Vector field ${state.field} sampled on a ${state.nx} by ${state.ny} grid, coloured by ${state.coloring}`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\max |F| = ${grid.maxMagnitude.toFixed(3)}`,
            `\\max |\\nabla\\cdot F| = ${maxAbsDiv.toFixed(3)}`,
            `\\max |(\\nabla\\times F)_z| = ${maxAbsCurl.toFixed(3)}`,
          ]}
        />
      </div>

      <div className="vf-visualizer__controls">
        <SliderRow
          label="Coloring"
          description="magnitude / divergence (red = source, blue = sink) / curl (red = CCW, blue = CW)"
          min={0}
          max={COLORING_MODES.length - 1}
          step={1}
          value={coloringIdx >= 0 ? coloringIdx : 0}
          onChange={(i) =>
            setState({
              ...state,
              coloring: COLORING_MODES[i] ?? ("magnitude" as ColoringMode),
            })
          }
          format={{ precision: 0 }}
          hideTicks
        />
        <SliderRow
          label="Field"
          description={`uniform · radial · vortex · saddle — current: ${state.field}`}
          min={0}
          max={FIELD_KINDS.length - 1}
          step={1}
          value={fieldIdx >= 0 ? fieldIdx : 0}
          onChange={(i) =>
            setState({ ...state, field: FIELD_KINDS[i] ?? ("uniform" as FieldKind) })
          }
          format={{ precision: 0 }}
          hideTicks
        />
        <SliderRow
          label="nx"
          description="Samples along x."
          min={4}
          max={24}
          step={2}
          value={state.nx}
          onChange={(nx) => setState({ ...state, nx })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="ny"
          description="Samples along y."
          min={4}
          max={24}
          step={2}
          value={state.ny}
          onChange={(ny) => setState({ ...state, ny })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="vf-visualizer__actions">
        <button type="button" className="vf-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="vf-visualizer__counter" aria-live="off">
          max |F| {grid.maxMagnitude.toFixed(2)} · max |div| {maxAbsDiv.toFixed(2)} · max
          |curl| {maxAbsCurl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default VectorFieldVisualizer;
