import { useMemo } from "react";
import { type Preset, PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Bit, type Sample, compare } from "./algorithm";
import {
  DEFAULT_STATE,
  type LatchVsFfState,
  PATTERN_NAMES,
  PATTERN_SLUGS,
  PRESETS,
  type PatternSlug,
  generateSamples,
} from "./presets";
import "./LatchVsFfVisualizer.css";

const STATE_SCHEMA = {
  cursor: { type: "number", default: DEFAULT_STATE.cursor },
  pattern: { type: "enum", default: DEFAULT_STATE.pattern, values: PATTERN_SLUGS },
} as const satisfies Schema;

const SVG_WIDTH = 640;
const SVG_HEIGHT = 280;
const LABEL_WIDTH = 70;
const LANE_HEIGHT = 50;
const LANE_PAD = 8;
const LANES: readonly { key: "d" | "ctrl" | "latch" | "ff"; label: string }[] = [
  { key: "d", label: "D" },
  { key: "ctrl", label: "ctrl" },
  { key: "latch", label: "Q latch" },
  { key: "ff", label: "Q ff" },
];

function laneY(index: number): number {
  return index * LANE_HEIGHT + LANE_PAD;
}

function bitY(laneIndex: number, bit: Bit): number {
  const top = laneY(laneIndex) + 6;
  const bottom = laneY(laneIndex) + LANE_HEIGHT - 10;
  return bit === 1 ? top : bottom;
}

function buildWavePath(
  laneIndex: number,
  values: readonly Bit[],
  stepWidth: number,
): string {
  if (values.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const x0 = LABEL_WIDTH + i * stepWidth;
    const x1 = LABEL_WIDTH + (i + 1) * stepWidth;
    const v = values[i] ?? 0;
    const y = bitY(laneIndex, v);
    if (i === 0) {
      parts.push(`M ${x0} ${y}`);
    } else {
      const prev = values[i - 1] ?? 0;
      if (prev !== v) parts.push(`V ${y}`);
    }
    parts.push(`H ${x1}`);
  }
  return parts.join(" ");
}

export default function LatchVsFfVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "latch-vs-ff",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const samples: readonly Sample[] = useMemo(
    () => generateSamples(state.pattern),
    [state.pattern],
  );
  const comparison = useMemo(() => compare(samples), [samples]);
  const divergentCount = useMemo(
    () => comparison.reduce((acc, c) => acc + (c.divergent ? 1 : 0), 0),
    [comparison],
  );

  const n = samples.length;
  const maxCursor = Math.max(0, n - 1);
  const cursor = Math.min(Math.max(0, Math.round(state.cursor)), maxCursor);

  const dValues: Bit[] = samples.map((s) => s.d);
  const ctrlValues: Bit[] = samples.map((s) => s.ctrl);
  const latchValues: Bit[] = comparison.map((c) => c.latch);
  const ffValues: Bit[] = comparison.map((c) => c.ff);
  const laneSeries: Record<(typeof LANES)[number]["key"], Bit[]> = {
    d: dValues,
    ctrl: ctrlValues,
    latch: latchValues,
    ff: ffValues,
  };

  const stepWidth = n > 0 ? (SVG_WIDTH - LABEL_WIDTH) / n : 0;

  const patternIndex = Math.max(0, PATTERN_SLUGS.indexOf(state.pattern));

  const handlePreset = (next: LatchVsFfState): void => {
    setState({ ...next, cursor: 0 });
  };

  const handlePatternSlider = (raw: number): void => {
    const idx = Math.min(PATTERN_SLUGS.length - 1, Math.max(0, Math.round(raw)));
    const slug: PatternSlug = PATTERN_SLUGS[idx] ?? "slow-clock";
    setState({ ...state, pattern: slug, cursor: 0 });
  };

  const hud = `${PATTERN_NAMES[state.pattern]} · cursor=${cursor} of ${maxCursor}`;
  const counter = `divergent samples: ${divergentCount} / ${n}`;

  const cursorX = LABEL_WIDTH + (cursor + 0.5) * stepWidth;

  return (
    <div className="lvf-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly {
            name: string;
            state: LatchVsFfState;
          }[] as unknown as Preset<typeof state>[]
        }
        onSelect={(next) => handlePreset(next as LatchVsFfState)}
        ariaLabel="Latch vs flip-flop presets"
      />

      <div className="lvf-visualizer__stage">
        <svg
          className="lvf-visualizer__svg"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label="Timing diagram comparing D latch and D flip-flop outputs"
        >
          {LANES.map((lane, laneIdx) => (
            <g key={lane.key}>
              <rect
                className="lvf-visualizer__lane-bg"
                x={LABEL_WIDTH}
                y={laneY(laneIdx)}
                width={SVG_WIDTH - LABEL_WIDTH}
                height={LANE_HEIGHT - LANE_PAD}
              />
              <text
                className="lvf-visualizer__lane-label"
                x={8}
                y={laneY(laneIdx) + (LANE_HEIGHT - LANE_PAD) / 2 + 4}
              >
                {lane.label}
              </text>
            </g>
          ))}

          {comparison.map((c, i) =>
            c.divergent ? (
              <rect
                key={`div-${i}`}
                className="lvf-visualizer__lane-divergent"
                x={LABEL_WIDTH + i * stepWidth}
                y={laneY(0)}
                width={stepWidth}
                height={LANES.length * LANE_HEIGHT - LANE_PAD}
              />
            ) : null,
          )}

          {LANES.map((lane, laneIdx) => (
            <path
              key={`wave-${lane.key}`}
              className="lvf-visualizer__wave"
              d={buildWavePath(laneIdx, laneSeries[lane.key], stepWidth)}
            />
          ))}

          {n > 0 ? (
            <line
              className="lvf-visualizer__cursor"
              x1={cursorX}
              x2={cursorX}
              y1={laneY(0)}
              y2={laneY(LANES.length - 1) + LANE_HEIGHT - LANE_PAD}
            />
          ) : null}
        </svg>
      </div>

      <div className="lvf-visualizer__hud" aria-live="polite">
        {hud}
      </div>

      <div className="lvf-visualizer__controls">
        <SliderRow
          label="Cursor (sample idx)"
          min={0}
          max={maxCursor}
          step={1}
          value={cursor}
          onChange={(v) => setState({ ...state, cursor: Math.round(v) })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Input pattern"
          description="0=slow-clock, 1=d-changes-mid-enable, 2=clean-edges, 3=glitchy-d"
          min={0}
          max={PATTERN_SLUGS.length - 1}
          step={1}
          value={patternIndex}
          onChange={handlePatternSlider}
          format={{ precision: 0 }}
        />
      </div>

      <div className="lvf-visualizer__actions">
        <button
          type="button"
          className="lvf-visualizer__btn"
          onClick={() => reset()}
          aria-label="Reset latch vs flip-flop"
        >
          ↺ Reset
        </button>
        <span className="lvf-visualizer__counter" aria-live="polite">
          {counter}
        </span>
      </div>
    </div>
  );
}
