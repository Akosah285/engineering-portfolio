import { useMemo } from "react";
import { PresetCarousel, type Preset } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type AccelSample,
  detectShakes,
  tiltFromAccel,
  toDegrees,
} from "./algorithm";
import {
  type AccelDemoState,
  DEFAULT_STATE,
  PATTERNS,
  PATTERN_NAMES,
  PATTERN_SLUGS,
  type PatternSlug,
  PRESETS,
} from "./presets";
import "./AccelerometerVisualizer.css";

const STATE_SCHEMA = {
  cursor: { type: "number", default: DEFAULT_STATE.cursor },
  thresholdG: { type: "number", default: DEFAULT_STATE.thresholdG },
  pattern: {
    type: "enum",
    default: DEFAULT_STATE.pattern,
    values: PATTERN_SLUGS,
  },
} as const satisfies Schema;

const MIN_SHAKE_SAMPLES = 3;
const G = 9.81;

const PHONE_W = 280;
const PHONE_H = 280;
const PLOT_W = 440;
const PLOT_H = 220;
const PLOT_PAD = 28;

function PhonePanel({ sample }: { sample: AccelSample }) {
  const safeSample =
    sample.ax === 0 && sample.ay === 0 && sample.az === 0
      ? { ax: 0, ay: 0, az: G }
      : sample;
  const tilt = tiltFromAccel(safeSample);
  const deg = toDegrees(tilt);
  const cx = PHONE_W / 2;
  const cy = PHONE_H / 2 + 10;
  const rollDeg = (tilt.roll * 180) / Math.PI;
  const scaleY = Math.max(0.15, Math.abs(Math.cos(tilt.pitch)));

  const rectW = 110;
  const rectH = 180;

  // Gravity arrow in world frame (always points "down" in screen)
  const gravityLen = 90;

  return (
    <svg
      width={PHONE_W}
      height={PHONE_H}
      role="img"
      aria-label="Phone tilt indicator"
      className="accel-visualizer__phone-svg"
    >
      <text
        x={PHONE_W / 2}
        y={18}
        textAnchor="middle"
        fontSize={13}
        fill="#333"
        fontFamily="ui-monospace, monospace"
      >
        {`roll=${deg.roll.toFixed(1)}°  pitch=${deg.pitch.toFixed(1)}°`}
      </text>

      {/* Phone body */}
      <g transform={`translate(${cx} ${cy}) rotate(${rollDeg}) scale(1 ${scaleY})`}>
        <rect
          x={-rectW / 2}
          y={-rectH / 2}
          width={rectW}
          height={rectH}
          rx={14}
          ry={14}
          fill="#1f2a37"
          stroke="#0f1620"
          strokeWidth={2}
        />
        <rect
          x={-rectW / 2 + 8}
          y={-rectH / 2 + 18}
          width={rectW - 16}
          height={rectH - 36}
          rx={6}
          ry={6}
          fill="#374151"
        />
        <circle cx={0} cy={rectH / 2 - 10} r={4} fill="#9ca3af" />
      </g>

      {/* Gravity vector (screen-down) */}
      <g>
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy + gravityLen}
          stroke="#9ca3af"
          strokeWidth={3}
        />
        <polygon
          points={`${cx - 6},${cy + gravityLen - 8} ${cx + 6},${cy + gravityLen - 8} ${cx},${cy + gravityLen + 4}`}
          fill="#9ca3af"
        />
        <text
          x={cx + 10}
          y={cy + gravityLen}
          fontSize={11}
          fill="#6b7280"
          fontFamily="ui-monospace, monospace"
        >
          g
        </text>
      </g>
    </svg>
  );
}

function MagnitudePlot({
  samples,
  thresholdG,
  shakeIndices,
}: {
  samples: readonly AccelSample[];
  thresholdG: number;
  shakeIndices: readonly number[];
}) {
  const mags = samples.map((s) => Math.hypot(s.ax, s.ay, s.az));
  const limit = (1 + thresholdG) * G;
  const maxY = Math.max(limit * 1.1, ...mags, G * 1.1);
  const minY = 0;
  const n = samples.length;

  const innerW = PLOT_W - PLOT_PAD * 2;
  const innerH = PLOT_H - PLOT_PAD * 2;

  const xAt = (i: number): number =>
    PLOT_PAD + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number =>
    PLOT_PAD + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const path = mags
    .map((m, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${yAt(m).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      width={PLOT_W}
      height={PLOT_H}
      role="img"
      aria-label="Acceleration magnitude time series"
      className="accel-visualizer__plot-svg"
    >
      <rect
        x={PLOT_PAD}
        y={PLOT_PAD}
        width={innerW}
        height={innerH}
        fill="#fff"
        stroke="#d1d5db"
      />
      {/* Threshold line */}
      <line
        x1={PLOT_PAD}
        x2={PLOT_PAD + innerW}
        y1={yAt(limit)}
        y2={yAt(limit)}
        stroke="#cf4f4f"
        strokeDasharray="4 4"
        strokeWidth={1.5}
      />
      <text
        x={PLOT_PAD + innerW - 4}
        y={yAt(limit) - 4}
        textAnchor="end"
        fontSize={11}
        fill="#cf4f4f"
        fontFamily="ui-monospace, monospace"
      >
        {`limit=${limit.toFixed(2)} m/s²`}
      </text>
      {/* Magnitude poly-line */}
      <path d={path} fill="none" stroke="#00693e" strokeWidth={2} />
      {/* Shake event dots */}
      {shakeIndices.map((i) => {
        const m = mags[i] ?? 0;
        return (
          <circle
            key={`shake-${i}`}
            cx={xAt(i)}
            cy={yAt(m)}
            r={5}
            fill="#cf4f4f"
            stroke="#fff"
            strokeWidth={1.5}
          />
        );
      })}
      {/* Axis labels */}
      <text
        x={PLOT_PAD}
        y={PLOT_PAD - 8}
        fontSize={11}
        fill="#6b7280"
        fontFamily="ui-monospace, monospace"
      >
        |a| (m/s²)
      </text>
      <text
        x={PLOT_PAD + innerW}
        y={PLOT_H - 6}
        textAnchor="end"
        fontSize={11}
        fill="#6b7280"
        fontFamily="ui-monospace, monospace"
      >
        sample idx
      </text>
    </svg>
  );
}

function AccelerometerVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "accelerometer",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const samples = PATTERNS[state.pattern];
  const maxCursor = Math.max(0, samples.length - 1);
  const cursor = Math.min(Math.max(0, Math.round(state.cursor)), maxCursor);
  const current: AccelSample = samples[cursor] ?? { ax: 0, ay: 0, az: G };

  const shakeIndices = useMemo(
    () => detectShakes(samples, state.thresholdG, MIN_SHAKE_SAMPLES),
    [samples, state.thresholdG],
  );

  const tilt = useMemo(() => {
    const safe =
      current.ax === 0 && current.ay === 0 && current.az === 0
        ? { ax: 0, ay: 0, az: G }
        : current;
    return toDegrees(tiltFromAccel(safe));
  }, [current]);

  const patternIndex = PATTERN_SLUGS.indexOf(state.pattern);

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: AccelDemoState): void => {
    setState((prev) => ({
      ...prev,
      pattern: next.pattern,
      cursor: 0,
    }));
  };

  const handlePatternSliderChange = (idx: number): void => {
    const clamped = Math.min(
      Math.max(0, Math.round(idx)),
      PATTERN_SLUGS.length - 1,
    );
    const slug: PatternSlug = PATTERN_SLUGS[clamped] ?? DEFAULT_STATE.pattern;
    setState((prev) => ({ ...prev, pattern: slug, cursor: 0 }));
  };

  const hud =
    `${PATTERN_NAMES[state.pattern]} · sample ${cursor + 1} of ${samples.length}` +
    ` · roll=${tilt.roll.toFixed(1)}° · pitch=${tilt.pitch.toFixed(1)}°`;

  return (
    <div className="accel-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly Preset<AccelDemoState>[] as unknown as Preset<AccelDemoState>[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Accelerometer presets"
      />

      <div className="accel-visualizer__stage">
        <div className="accel-visualizer__panel">
          <p className="accel-visualizer__panel-title">Phone tilt</p>
          <PhonePanel sample={current} />
        </div>
        <div className="accel-visualizer__panel">
          <p className="accel-visualizer__panel-title">|a| over time</p>
          <MagnitudePlot
            samples={samples}
            thresholdG={state.thresholdG}
            shakeIndices={shakeIndices}
          />
        </div>
      </div>

      <p className="accel-visualizer__hud" aria-live="polite">
        {hud}
      </p>

      <div className="accel-visualizer__controls">
        <SliderRow
          label="Cursor (sample idx)"
          min={0}
          max={maxCursor}
          step={1}
          value={cursor}
          onChange={(next) => setState((prev) => ({ ...prev, cursor: next }))}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Shake threshold (g)"
          min={0.1}
          max={3.0}
          step={0.1}
          value={state.thresholdG}
          onChange={(next) =>
            setState((prev) => ({ ...prev, thresholdG: next }))
          }
          format={{ precision: 1, unit: "g" }}
        />
        <SliderRow
          label="Motion pattern"
          min={0}
          max={PATTERN_SLUGS.length - 1}
          step={1}
          value={patternIndex < 0 ? 0 : patternIndex}
          onChange={handlePatternSliderChange}
          format={{ precision: 0 }}
        />
      </div>

      <div className="accel-visualizer__actions">
        <button
          type="button"
          className="accel-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset accelerometer"
        >
          ↺ Reset
        </button>
        <span className="accel-visualizer__counter" aria-live="polite">
          shakes detected: {shakeIndices.length}
        </span>
      </div>
    </div>
  );
}

export default AccelerometerVisualizer;
