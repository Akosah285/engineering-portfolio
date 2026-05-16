import { useEffect, useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { projectSignal, risingEdges, simulate, type TraceFrame } from "./algorithm";
import {
  DEFAULT_STATE,
  getPattern,
  PATTERNS,
  PATTERN_SLUGS,
  PRESETS,
  type PatternSlug,
} from "./presets";
import "./VhdlWaveformVisualizer.css";

const STATE_SCHEMA = {
  cursor: { type: "number", default: DEFAULT_STATE.cursor },
  pattern: {
    type: "enum",
    default: DEFAULT_STATE.pattern,
    values: PATTERN_SLUGS,
  },
} as const satisfies Schema;

const SVG_WIDTH = 720;
const LANE_HEIGHT = 40;
const LABEL_WIDTH = 60;

function VhdlWaveformVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "vhdl-waveform",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const pattern = useMemo(() => getPattern(state.pattern), [state.pattern]);

  const frames: TraceFrame[] = useMemo(
    () =>
      simulate({
        clock: { cycles: pattern.cycles },
        initial: pattern.initial,
        transition: pattern.transition,
      }),
    [pattern],
  );

  const maxCursor = Math.max(0, frames.length - 1);

  // Clamp cursor if pattern shortened the trace.
  useEffect(() => {
    if (state.cursor > maxCursor) {
      setState({ ...state, cursor: maxCursor });
    }
  }, [maxCursor, state, setState]);

  const q0Edges = useMemo(() => risingEdges(frames, "q0"), [frames]);

  const laneCount = pattern.signalNames.length + 1;
  const svgHeight = laneCount * LANE_HEIGHT;
  const plotWidth = SVG_WIDTH - LABEL_WIDTH;
  const stepWidth = frames.length > 0 ? plotWidth / frames.length : 0;

  const laneY = (laneIndex: number): number => laneIndex * LANE_HEIGHT;
  const highY = (laneIndex: number): number => laneY(laneIndex) + 8;
  const lowY = (laneIndex: number): number => laneY(laneIndex) + LANE_HEIGHT - 8;

  function buildPath(bits: readonly (0 | 1)[], laneIndex: number): string {
    if (bits.length === 0) return "";
    const segs: string[] = [];
    let prevBit = bits[0] ?? 0;
    segs.push(`M ${LABEL_WIDTH} ${prevBit === 1 ? highY(laneIndex) : lowY(laneIndex)}`);
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i] ?? 0;
      const x0 = LABEL_WIDTH + i * stepWidth;
      const x1 = LABEL_WIDTH + (i + 1) * stepWidth;
      if (b !== prevBit) {
        segs.push(`L ${x0} ${b === 1 ? highY(laneIndex) : lowY(laneIndex)}`);
      }
      segs.push(`L ${x1} ${b === 1 ? highY(laneIndex) : lowY(laneIndex)}`);
      prevBit = b;
    }
    return segs.join(" ");
  }

  const clockBits: (0 | 1)[] = frames.map((f) => f.clock);
  const cursorX = LABEL_WIDTH + Math.min(state.cursor, maxCursor) * stepWidth;

  const patternIndex = Math.max(
    0,
    PATTERN_SLUGS.findIndex((s) => s === state.pattern),
  );

  const handlePatternSlider = (idx: number): void => {
    const clamped = Math.max(0, Math.min(PATTERN_SLUGS.length - 1, Math.round(idx)));
    const nextSlug = PATTERN_SLUGS[clamped] ?? DEFAULT_STATE.pattern;
    setState({ cursor: 0, pattern: nextSlug as PatternSlug });
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState({ ...next, cursor: 0 });
  };

  const handleReset = (): void => {
    reset();
  };

  return (
    <div className="vhdl-visualizer">
      <PresetCarousel
        presets={PRESETS as unknown as { name: string; state: typeof state }[]}
        onSelect={handlePresetSelect}
        ariaLabel="VHDL waveform presets"
      />

      <div className="vhdl-visualizer__stage">
        <svg
          className="vhdl-visualizer__svg"
          width={SVG_WIDTH}
          height={svgHeight}
          viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
          role="img"
          aria-label={`VHDL waveform for ${pattern.displayName}`}
        >
          {/* lane backgrounds + labels */}
          {Array.from({ length: laneCount }, (_, i) => (
            <g key={`lane-${i}`}>
              <rect
                className="vhdl-visualizer__lane-bg"
                x={LABEL_WIDTH}
                y={laneY(i)}
                width={plotWidth}
                height={LANE_HEIGHT}
              />
              <text
                className="vhdl-visualizer__lane-label"
                x={8}
                y={laneY(i) + LANE_HEIGHT / 2 + 4}
              >
                {i === 0 ? "clk" : pattern.signalNames[i - 1]}
              </text>
            </g>
          ))}

          {/* clock waveform */}
          <path
            className="vhdl-visualizer__wave vhdl-visualizer__wave--clock"
            d={buildPath(clockBits, 0)}
          />

          {/* signal waveforms */}
          {pattern.signalNames.map((name, i) => {
            const bits = projectSignal(frames, name);
            return (
              <path
                key={name}
                className="vhdl-visualizer__wave"
                d={buildPath(bits, i + 1)}
              />
            );
          })}

          {/* rising-edge dots on q0 lane (lane index = 1) */}
          {pattern.signalNames.includes("q0") &&
            q0Edges.map((half) => (
              <circle
                key={`edge-${half}`}
                className="vhdl-visualizer__edge-dot"
                cx={LABEL_WIDTH + half * stepWidth}
                cy={highY(1)}
                r={3}
              />
            ))}

          {/* cursor */}
          <line
            className="vhdl-visualizer__cursor"
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={svgHeight}
          />
        </svg>
      </div>

      <div className="vhdl-visualizer__hud" aria-live="polite">
        {pattern.displayName} · half-cycle {Math.min(state.cursor, maxCursor)} of{" "}
        {maxCursor}
      </div>

      <div className="vhdl-visualizer__controls">
        <SliderRow
          label="Cursor (half-cycle)"
          min={0}
          max={maxCursor}
          step={1}
          value={Math.min(state.cursor, maxCursor)}
          onChange={(cursor) => setState({ ...state, cursor })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="VHDL pattern"
          description="Switch between counter, shift-register, and toggle flip-flop patterns."
          min={0}
          max={PATTERNS.length - 1}
          step={1}
          value={patternIndex}
          onChange={handlePatternSlider}
          format={{ precision: 0 }}
        />
      </div>

      <div className="vhdl-visualizer__actions">
        <button
          type="button"
          className="vhdl-visualizer__btn"
          aria-label="Reset vhdl waveform"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="vhdl-visualizer__counter" aria-live="off">
          rising edges (q0): {q0Edges.length}
        </span>
      </div>
    </div>
  );
}

export default VhdlWaveformVisualizer;
