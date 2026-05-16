import { useCallback, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Segment, circularLoop, fieldAt, loopAxisField } from "./algorithm";
import {
  type BiotSavartDemoState,
  CARRIERS,
  type Carrier,
  DEFAULT_STATE,
  PRESETS,
} from "./presets";
import "./BiotSavartVisualizer.css";

/**
 * <BiotSavartVisualizer> — magnetostatics demo: heat-map |Bz| of a
 * straight-segment current carrier in the xy-plane plus on-axis B(z)
 * for the circular-loop closed-form reference.
 */

const STATE_SCHEMA = {
  carrier: {
    type: "enum",
    default: DEFAULT_STATE.carrier,
    values: CARRIERS,
  },
  I: { type: "number", default: DEFAULT_STATE.I },
  R: { type: "number", default: DEFAULT_STATE.R },
  nSegments: { type: "number", default: DEFAULT_STATE.nSegments },
  gridRes: { type: "number", default: DEFAULT_STATE.gridRes },
} as const satisfies Schema;

function buildSegments(state: BiotSavartDemoState): Segment[] {
  const { carrier, I, R, nSegments } = state;
  if (carrier === "circular-loop") {
    return circularLoop(R, I, Math.max(3, Math.round(nSegments)));
  }
  if (carrier === "square-loop") {
    // square of side 2R centered at origin
    return [
      { x1: -R, y1: -R, x2: R, y2: -R, current: I },
      { x1: R, y1: -R, x2: R, y2: R, current: I },
      { x1: R, y1: R, x2: -R, y2: R, current: I },
      { x1: -R, y1: R, x2: -R, y2: -R, current: I },
    ];
  }
  // two-parallel-wires: anti-parallel along y at x = ±R
  const L = 6 * Math.max(R, 0.5);
  const d = R;
  return [
    { x1: -d, y1: -L / 2, x2: -d, y2: L / 2, current: I },
    { x1: d, y1: L / 2, x2: d, y2: -L / 2, current: I },
  ];
}

function paintHeatmap(
  ctx: CanvasRenderingContext2D,
  segments: readonly Segment[],
  gridRes: number,
  extent: number,
): number {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#f6f6f3";
  ctx.fillRect(0, 0, width, height);

  const cols = Math.max(4, Math.round(gridRes));
  const rows = cols;
  const cellW = width / cols;
  const cellH = height / rows;

  // First pass: sample Bz over grid, track max |Bz| for normalisation.
  const samples: number[] = new Array(rows * cols);
  let maxAbs = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = -extent + ((c + 0.5) / cols) * (2 * extent);
      const y = extent - ((r + 0.5) / rows) * (2 * extent);
      const { Bz } = fieldAt({ segments, x, y });
      samples[r * cols + c] = Bz;
      if (Number.isFinite(Bz)) {
        const a = Math.abs(Bz);
        if (a > maxAbs) maxAbs = a;
      }
    }
  }
  const norm = maxAbs > 0 ? maxAbs : 1;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const Bz = samples[r * cols + c]!;
      if (!Number.isFinite(Bz)) continue;
      const t = Math.sqrt(Math.min(1, Math.abs(Bz) / norm));
      // Red = positive (out of page), Blue = negative (into page)
      const alpha = 0.15 + 0.7 * t;
      if (Bz >= 0) {
        ctx.fillStyle = `rgba(207, 79, 79, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(60, 110, 200, ${alpha})`;
      }
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    }
  }

  return maxAbs;
}

function paintCarriers(
  ctx: CanvasRenderingContext2D,
  segments: readonly Segment[],
  extent: number,
): void {
  const { width, height } = ctx.canvas;
  const sx = width / (2 * extent);
  const sy = height / (2 * extent);
  const toCanvas = (x: number, y: number): [number, number] => [
    (x + extent) * sx,
    height - (y + extent) * sy,
  ];

  ctx.lineWidth = 2;
  for (const seg of segments) {
    ctx.strokeStyle = seg.current >= 0 ? "#222" : "#555";
    const [x1, y1] = toCanvas(seg.x1, seg.y1);
    const [x2, y2] = toCanvas(seg.x2, seg.y2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function paintAxisPlot(ctx: CanvasRenderingContext2D, R: number, I: number): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  const zMin = -3 * R;
  const zMax = 3 * R;
  const samples = 200;
  const values: number[] = [];
  let maxAbs = 0;
  for (let i = 0; i < samples; i += 1) {
    const z = zMin + ((i + 0.5) / samples) * (zMax - zMin);
    const b = loopAxisField(R, I, z);
    values.push(b);
    if (Math.abs(b) > maxAbs) maxAbs = Math.abs(b);
  }
  const norm = maxAbs > 0 ? maxAbs : 1;

  // axes
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // curve
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < samples; i += 1) {
    const cx = (i / (samples - 1)) * width;
    const v = values[i]!;
    const cy = height / 2 - (v / norm) * (height / 2) * 0.85;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

function formatBz(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0 T";
  const abs = Math.abs(value);
  if (abs >= 1) return `${value.toFixed(3)} T`;
  if (abs >= 1e-3) return `${(value * 1e3).toFixed(3)} mT`;
  if (abs >= 1e-6) return `${(value * 1e6).toFixed(3)} µT`;
  return `${(value * 1e9).toFixed(3)} nT`;
}

export default function BiotSavartVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "biot-savart",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const segments = useMemo(() => buildSegments(state), [state]);
  const extent = useMemo(() => Math.max(state.R * 2.2, 1.2), [state.R]);

  const maxBzRef = useRef(0);
  const [maxBz, setMaxBz] = useState(0);

  const drawPlan: DrawFn = useCallback(
    (ctx) => {
      const m = paintHeatmap(ctx, segments, state.gridRes, extent);
      paintCarriers(ctx, segments, extent);
      if (Math.abs(m - maxBzRef.current) > 1e-12) {
        maxBzRef.current = m;
        setMaxBz(m);
      }
    },
    [segments, state.gridRes, extent],
  );

  const drawAxis: DrawFn = useCallback(
    (ctx) => {
      paintAxisPlot(ctx, state.R, state.I);
    },
    [state.R, state.I],
  );

  // Enum slider helpers for `carrier`.
  const carrierIndex = CARRIERS.indexOf(state.carrier);
  const setCarrierByIndex = (idx: number): void => {
    const next = CARRIERS[Math.max(0, Math.min(CARRIERS.length - 1, Math.round(idx)))];
    if (next) setState({ ...state, carrier: next as Carrier });
  };

  const onAxisPeak = (4 * Math.PI * 1e-7 * state.I) / (2 * state.R);

  const handlePresetSelect = (next: BiotSavartDemoState): void => {
    setState(next);
  };

  return (
    <div className="bs-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: BiotSavartDemoState }[] as {
            name: string;
            state: BiotSavartDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Biot-Savart presets"
      />

      <div className="bs-visualizer__stage">
        <div className="bs-visualizer__panel">
          <div className="bs-visualizer__panel-title">
            Plan view · |Bz| heatmap (red out, blue in)
          </div>
          <DemoCanvas
            width={420}
            height={360}
            ariaLabel="Plan view of current carriers and Bz heatmap"
            draw={drawPlan}
          />
        </div>
        <div className="bs-visualizer__panel">
          <div className="bs-visualizer__panel-title">
            On-axis Bz(z) for circular loop · z ∈ [−3R, 3R]
          </div>
          <DemoCanvas
            width={420}
            height={360}
            ariaLabel="On-axis Bz versus z for a circular loop"
            draw={drawAxis}
          />
        </div>
      </div>

      <div className="bs-visualizer__controls">
        <SliderRow
          label="I (current)"
          description="Loop current in amperes."
          min={0.1}
          max={10}
          step={0.1}
          value={state.I}
          onChange={(I) => setState({ ...state, I })}
          format={{ precision: 2, unit: "A" }}
        />
        <SliderRow
          label="R (loop radius)"
          description="Loop radius / half-spacing in metres."
          min={0.1}
          max={2}
          step={0.1}
          value={state.R}
          onChange={(R) => setState({ ...state, R })}
          format={{ precision: 2, unit: "m" }}
        />
        <SliderRow
          label="nSegments"
          description="Number of straight segments approximating curved carriers."
          min={3}
          max={48}
          step={3}
          value={state.nSegments}
          onChange={(nSegments) => setState({ ...state, nSegments })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="grid resolution"
          description="Heatmap grid cells per axis."
          min={10}
          max={30}
          step={2}
          value={state.gridRes}
          onChange={(gridRes) => setState({ ...state, gridRes })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="carrier geometry"
          description={`${state.carrier} (${carrierIndex + 1}/${CARRIERS.length})`}
          min={0}
          max={CARRIERS.length - 1}
          step={1}
          value={carrierIndex}
          onChange={setCarrierByIndex}
          format={{ precision: 0 }}
        />
      </div>

      <div className="bs-visualizer__actions">
        <button
          type="button"
          className="bs-visualizer__btn"
          onClick={() => {
            reset();
            maxBzRef.current = 0;
            setMaxBz(0);
          }}
        >
          ↺ Reset
        </button>
        <span className="bs-visualizer__counter" aria-live="off">
          max |Bz| = {formatBz(maxBz)} · on-axis peak {formatBz(onAxisPeak)}
        </span>
      </div>
    </div>
  );
}
