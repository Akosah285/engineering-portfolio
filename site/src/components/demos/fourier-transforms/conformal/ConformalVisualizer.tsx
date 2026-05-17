import { useCallback, useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Complex, applyMap, sampleUnitCircle } from "./algorithm";
import {
  type ComplexFn,
  type ConformalDemoState,
  DEFAULT_MAP,
  DEFAULT_STATE,
  MAP_FNS,
  MAP_LABEL,
  MAP_SLUGS,
  type MapSlug,
  PRESETS,
} from "./presets";
import "./ConformalVisualizer.css";

/**
 * <ConformalVisualizer> — visualises a conformal map f: C -> C by mapping
 * a small probe circle (and a faint reference grid) from the z-plane to
 * the w-plane.
 */

const SVG_PX = 340;
const VIEW = 3; // viewport: x,y ∈ [-VIEW, VIEW]
const PROBE_N = 64;
const PROBE_RADIUS = 0.5;
const GRID_N = 10;

const STATE_SCHEMA = {
  centerRe: { type: "number", default: DEFAULT_STATE.centerRe },
  centerIm: { type: "number", default: DEFAULT_STATE.centerIm },
  map: { type: "enum", default: DEFAULT_MAP, values: MAP_SLUGS },
} as const satisfies Schema;

function toSvgX(x: number): number {
  return ((x + VIEW) / (2 * VIEW)) * SVG_PX;
}
function toSvgY(y: number): number {
  return ((VIEW - y) / (2 * VIEW)) * SVG_PX;
}

function inView(z: Complex): boolean {
  return (
    Number.isFinite(z.re) &&
    Number.isFinite(z.im) &&
    Math.abs(z.re) <= VIEW &&
    Math.abs(z.im) <= VIEW
  );
}

function safeApply(points: readonly Complex[], f: ComplexFn): Complex[] {
  const out: Complex[] = [];
  for (const p of points) {
    try {
      out.push(f(p));
    } catch {
      out.push({ re: Number.NaN, im: Number.NaN });
    }
  }
  return out;
}

function buildReferenceGrid(): Complex[] {
  const pts: Complex[] = [];
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = -2 + (4 * i) / (GRID_N - 1);
      const y = -2 + (4 * j) / (GRID_N - 1);
      if (x === 0 && y === 0) continue; // skip origin (joukowski/log explode)
      pts.push({ re: x, im: y });
    }
  }
  return pts;
}

function Axes() {
  const ticks: number[] = [];
  for (let v = -Math.floor(VIEW); v <= Math.floor(VIEW); v++) {
    if (v !== 0) ticks.push(v);
  }
  return (
    <g>
      {ticks.map((v) => (
        <g key={`g-${v}`}>
          <line
            x1={toSvgX(v)}
            x2={toSvgX(v)}
            y1={0}
            y2={SVG_PX}
            stroke="#e6e2d4"
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={SVG_PX}
            y1={toSvgY(v)}
            y2={toSvgY(v)}
            stroke="#e6e2d4"
            strokeWidth={1}
          />
        </g>
      ))}
      <line
        x1={toSvgX(0)}
        x2={toSvgX(0)}
        y1={0}
        y2={SVG_PX}
        stroke="#7a7a7a"
        strokeWidth={1}
      />
      <line
        x1={0}
        x2={SVG_PX}
        y1={toSvgY(0)}
        y2={toSvgY(0)}
        stroke="#7a7a7a"
        strokeWidth={1}
      />
    </g>
  );
}

function ConformalVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "conformal",
    STATE_SCHEMA,
    DEFAULT_STATE as unknown as {
      centerRe: number;
      centerIm: number;
      map: "identity";
    },
  );
  const state = rawState as unknown as ConformalDemoState;

  const probe = useMemo<Complex[]>(
    () =>
      sampleUnitCircle(PROBE_N, { re: state.centerRe, im: state.centerIm }, PROBE_RADIUS),
    [state.centerRe, state.centerIm],
  );

  const grid = useMemo<Complex[]>(() => buildReferenceGrid(), []);

  const f = useMemo<ComplexFn>(() => MAP_FNS[state.map], [state.map]);

  const mappedProbe = useMemo<Complex[]>(() => safeApply(probe, f), [probe, f]);
  const mappedGrid = useMemo<Complex[]>(() => safeApply(grid, f), [grid, f]);

  const sampled = mappedProbe.length;
  const finite = mappedProbe.filter(
    (z) => Number.isFinite(z.re) && Number.isFinite(z.im),
  ).length;

  const mapIndex = MAP_SLUGS.indexOf(state.map);

  const probePolygon = applyMap(probe, (z) => z) // identity copy
    .filter(inView)
    .map((z) => `${toSvgX(z.re).toFixed(2)},${toSvgY(z.im).toFixed(2)}`)
    .join(" ");

  const mappedPolygon = mappedProbe
    .filter(inView)
    .map((z) => `${toSvgX(z.re).toFixed(2)},${toSvgY(z.im).toFixed(2)}`)
    .join(" ");

  // biome-ignore lint/correctness/useExhaustiveDependencies: rawState is the source-of-truth shape that setState requires; state is the deserialized projection used in the spread; keeping both in deps documents the dual identity
  const handlePreset = useCallback(
    (next: { map: MapSlug }) => {
      setState({ ...state, map: next.map } as unknown as typeof rawState);
    },
    [setState, state, rawState],
  );

  const hud =
    `${MAP_LABEL[state.map]} · centre=(` +
    `${state.centerRe.toFixed(2)}, ${state.centerIm.toFixed(2)})`;

  return (
    <div className="cm-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: { map: MapSlug } }[] as unknown as {
            name: string;
            state: { map: MapSlug };
          }[]
        }
        onSelect={handlePreset}
        ariaLabel="Conformal map presets"
      />

      <div className="cm-visualizer__stage">
        <div className="cm-visualizer__panel">
          <span className="cm-visualizer__panel-title">Input z-plane</span>
          <svg
            className="cm-visualizer__svg"
            width={SVG_PX}
            height={SVG_PX}
            viewBox={`0 0 ${SVG_PX} ${SVG_PX}`}
            role="img"
            aria-label="Input domain in the z-plane"
          >
            <Axes />
            {grid.filter(inView).map((z, i) => (
              <circle
                key={`gz-${i}`}
                cx={toSvgX(z.re)}
                cy={toSvgY(z.im)}
                r={1.4}
                fill="#b5b099"
              />
            ))}
            <polygon
              points={probePolygon}
              fill="rgba(0, 105, 62, 0.18)"
              stroke="#00693e"
              strokeWidth={1.5}
            />
          </svg>
        </div>

        <div className="cm-visualizer__panel">
          <span className="cm-visualizer__panel-title">Output w-plane</span>
          <svg
            className="cm-visualizer__svg"
            width={SVG_PX}
            height={SVG_PX}
            viewBox={`0 0 ${SVG_PX} ${SVG_PX}`}
            role="img"
            aria-label={`Mapped output under ${MAP_LABEL[state.map]}`}
          >
            <Axes />
            {mappedGrid.filter(inView).map((z, i) => (
              <circle
                key={`mw-${i}`}
                cx={toSvgX(z.re)}
                cy={toSvgY(z.im)}
                r={1.4}
                fill="#cf4f4f"
              />
            ))}
            <polygon
              points={mappedPolygon}
              fill="rgba(207, 79, 79, 0.18)"
              stroke="#cf4f4f"
              strokeWidth={1.5}
            />
          </svg>
        </div>
      </div>

      <div className="cm-visualizer__hud" role="group" aria-label="Current parameters">
        {hud}
      </div>

      <div className="cm-visualizer__controls">
        <SliderRow
          label="Probe centre Re(z)"
          min={-2}
          max={2}
          step={0.05}
          value={state.centerRe}
          onChange={(centerRe) =>
            setState({ ...state, centerRe } as unknown as typeof rawState)
          }
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Probe centre Im(z)"
          min={-2}
          max={2}
          step={0.05}
          value={state.centerIm}
          onChange={(centerIm) =>
            setState({ ...state, centerIm } as unknown as typeof rawState)
          }
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Conformal map"
          min={0}
          max={MAP_SLUGS.length - 1}
          step={1}
          value={mapIndex}
          onChange={(idx) => {
            const i = Math.max(0, Math.min(MAP_SLUGS.length - 1, Math.round(idx)));
            const slug = MAP_SLUGS[i] ?? DEFAULT_MAP;
            setState({ ...state, map: slug } as unknown as typeof rawState);
          }}
          format={{ precision: 0 }}
          hideTicks
        />
      </div>

      <div className="cm-visualizer__actions">
        <button
          type="button"
          className="cm-visualizer__btn"
          onClick={reset}
          aria-label="Reset conformal map"
        >
          ↺ Reset
        </button>
        <span className="cm-visualizer__counter" aria-live="off">
          sampled {sampled} points · finite {finite}
        </span>
      </div>
    </div>
  );
}

export default ConformalVisualizer;
export { ConformalVisualizer };
