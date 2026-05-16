import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type BiquadType, magnitudeResponse, makeBiquad } from "./algorithm";
import {
  type AudioFilterDemoState,
  DEFAULT_STATE,
  FILTER_TYPES,
  PRESETS,
  SAMPLE_RATE,
  TYPE_COLORS,
  TYPE_DESCRIPTIONS,
  TYPE_LABELS,
} from "./presets";
import "./AudioFilterVisualizer.css";

/**
 * <AudioFilterVisualizer> — Bode-style magnitude response of a biquad filter.
 */

const F_MIN = 20;
const F_MAX = 20000;
const DB_MIN = -60;
const DB_MAX = 20;
const SAMPLES = 200;
const PAD_L = 50;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

const STATE_SCHEMA = {
  filterType: {
    type: "enum",
    default: DEFAULT_STATE.filterType,
    values: FILTER_TYPES,
  },
  cutoffHz: { type: "number", default: DEFAULT_STATE.cutoffHz },
  Q: { type: "number", default: DEFAULT_STATE.Q },
} as const satisfies Schema;

const narrationTemplate = (state: AudioFilterDemoState): string => {
  const label = TYPE_LABELS[state.filterType];
  const verb = TYPE_DESCRIPTIONS[state.filterType];
  return `${label} filter ${verb} ${state.cutoffHz.toFixed(0)} Hz, with quality factor Q = ${state.Q.toFixed(2)}.`;
};

function clampCutoff(hz: number): number {
  return Math.max(F_MIN, Math.min(hz, SAMPLE_RATE / 2 - 1));
}
function clampQ(q: number): number {
  return Math.max(0.01, q);
}

function freqToX(hz: number, width: number): number {
  const lo = Math.log10(F_MIN);
  const hi = Math.log10(F_MAX);
  const t = (Math.log10(hz) - lo) / (hi - lo);
  return PAD_L + t * (width - PAD_L - PAD_R);
}
function dbToY(db: number, height: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  const t = (clamped - DB_MIN) / (DB_MAX - DB_MIN);
  return height - PAD_B - t * (height - PAD_T - PAD_B);
}

function paintAxes(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#666";
  ctx.font = "11px sans-serif";

  // Horizontal dB gridlines every 10 dB.
  for (let db = DB_MIN; db <= DB_MAX; db += 10) {
    const y = dbToY(db, height);
    ctx.strokeStyle = db === 0 ? "#888" : "#e8e8e8";
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(width - PAD_R, y);
    ctx.stroke();
    ctx.fillStyle = "#666";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${db}`, PAD_L - 6, y);
  }

  // Vertical decade gridlines.
  const decades = [20, 100, 1000, 10000, 20000];
  for (const f of decades) {
    if (f < F_MIN || f > F_MAX) continue;
    const x = freqToX(f, width);
    ctx.strokeStyle = "#e8e8e8";
    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, height - PAD_B);
    ctx.stroke();
    const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, height - PAD_B + 6);
  }

  // Axis labels.
  ctx.fillStyle = "#444";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Frequency (Hz, log)", width / 2, height - 2);
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "top";
  ctx.fillText("Magnitude (dB)", 0, 0);
  ctx.restore();
}

function paintResponse(
  ctx: CanvasRenderingContext2D,
  filterType: BiquadType,
  cutoffHz: number,
  Q: number,
): void {
  const { width, height } = ctx.canvas;
  const coeffs = makeBiquad(filterType, cutoffHz, SAMPLE_RATE, Q);
  const nyquist = SAMPLE_RATE / 2;

  ctx.strokeStyle = TYPE_COLORS[filterType];
  ctx.lineWidth = 2;
  ctx.beginPath();

  const loF = Math.log10(F_MIN);
  const hiF = Math.log10(F_MAX);
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = i / (SAMPLES - 1);
    const f = Math.min(nyquist - 1, 10 ** (loF + t * (hiF - loF)));
    const mag = magnitudeResponse(coeffs, f, SAMPLE_RATE);
    const db = mag > 0 ? 20 * Math.log10(mag) : DB_MIN;
    const x = freqToX(f, width);
    const y = dbToY(db, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Cutoff marker.
  const xc = freqToX(cutoffHz, width);
  ctx.strokeStyle = TYPE_COLORS[filterType];
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xc, PAD_T);
  ctx.lineTo(xc, height - PAD_B);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = TYPE_COLORS[filterType];
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`f_c = ${cutoffHz.toFixed(0)} Hz`, xc + 4, PAD_T + 2);
}

export function AudioFilterVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "audio-filter",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const safeCutoff = clampCutoff(state.cutoffHz);
  const safeQ = clampQ(state.Q);

  const cutoffDb = useMemo(() => {
    const coeffs = makeBiquad(state.filterType, safeCutoff, SAMPLE_RATE, safeQ);
    const mag = magnitudeResponse(coeffs, safeCutoff, SAMPLE_RATE);
    return mag > 0 ? 20 * Math.log10(mag) : DB_MIN;
  }, [state.filterType, safeCutoff, safeQ]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintAxes(ctx);
      paintResponse(ctx, state.filterType, safeCutoff, safeQ);
    },
    [state.filterType, safeCutoff, safeQ],
  );

  const handlePresetSelect = (next: AudioFilterDemoState): void => {
    setState(next);
  };

  const handleTypeSelect = (filterType: BiquadType): void => {
    setState({ ...state, filterType });
  };

  return (
    <div className="af-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: AudioFilterDemoState }[] as {
            name: string;
            state: AudioFilterDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Audio filter presets"
      />

      <div
        className="af-visualizer__type-row"
        role="listbox"
        aria-label="Filter type"
        tabIndex={0}
      >
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="option"
            aria-selected={state.filterType === t}
            className="af-visualizer__type-button"
            onClick={() => handleTypeSelect(t)}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="af-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Magnitude response of a ${TYPE_LABELS[state.filterType].toLowerCase()} biquad filter at ${safeCutoff.toFixed(0)} Hz`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `H(f_c) = ${cutoffDb.toFixed(2)}\\,\\text{dB}`,
            `Q = ${safeQ.toFixed(2)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="af-visualizer__controls">
        <SliderRow
          label="Cutoff frequency f_c"
          description="Center / corner frequency of the filter in hertz."
          min={20}
          max={SAMPLE_RATE / 2 - 100}
          step={1}
          value={state.cutoffHz}
          onChange={(cutoffHz) => setState({ ...state, cutoffHz })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Q (quality / resonance)"
          description="Higher Q narrows the band and sharpens the resonance peak."
          min={0.1}
          max={10}
          step={0.1}
          value={state.Q}
          onChange={(Q) => setState({ ...state, Q })}
          format={{ precision: 2 }}
        />
      </div>

      <div className="af-visualizer__actions">
        <button type="button" className="af-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="af-visualizer__counter" aria-live="off">
          f_c = {safeCutoff.toFixed(0)} Hz
        </span>
      </div>
    </div>
  );
}
