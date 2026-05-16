import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Complex, type SignalKind, magnitude, sampleFT } from "./algorithm";
import {
  DEFAULT_STATE,
  type FtSignalsDemoState,
  PRESETS,
  SIGNAL_KINDS,
  SIGNAL_META,
} from "./presets";
import "./FtSignalsVisualizer.css";

/**
 * <FtSignalsVisualizer> — closed-form Fourier transforms of canonical signals.
 *
 * Top half of the canvas plots f(t); bottom half plots |F(ω)|. For complex
 * spectra (causal exponential), Re/Im components are overlaid as dashed lines.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const OMEGA_SAMPLES = 200;
const TIME_SAMPLES = 400;

const STATE_SCHEMA = {
  signalKind: {
    type: "enum",
    default: DEFAULT_STATE.signalKind,
    values: SIGNAL_KINDS,
  },
  param: { type: "number", default: DEFAULT_STATE.param },
  omegaMax: { type: "number", default: DEFAULT_STATE.omegaMax },
} as const satisfies Schema;

function timeDomain(kind: SignalKind, param: number, t: number): number {
  if (kind === "rect") return Math.abs(t) < param / 2 ? 1 : 0;
  if (kind === "triangle") {
    const v = 1 - Math.abs((2 * t) / param);
    return v > 0 ? v : 0;
  }
  if (kind === "exp-two-sided") return Math.exp(-param * Math.abs(t));
  if (kind === "exp-causal") return t > 0 ? Math.exp(-param * t) : 0;
  return Math.exp(-param * t * t);
}

function timeWindow(kind: SignalKind, param: number): number {
  if (kind === "rect" || kind === "triangle") return Math.max(param, 1) * 1.5;
  if (kind === "gaussian") return 5 / Math.sqrt(param);
  return 5 / param;
}

const narrationTemplate = (state: FtSignalsDemoState): string => {
  const meta = SIGNAL_META[state.signalKind];
  return `Fourier transform of the ${meta.label.toLowerCase()} signal with ${meta.paramLabel} = ${state.param.toFixed(2)}, plotted over frequencies |ω| ≤ ${state.omegaMax.toFixed(0)}. Note the time-frequency duality: narrower pulses in time spread wider in frequency.`;
};

interface PanelBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function drawAxes(ctx: CanvasRenderingContext2D, box: PanelBox, title: string): void {
  ctx.strokeStyle = "#bbbbbb";
  ctx.lineWidth = 1;
  // Horizontal baseline (x-axis at vertical centre)
  const midY = box.y + box.h / 2;
  ctx.beginPath();
  ctx.moveTo(box.x, midY);
  ctx.lineTo(box.x + box.w, midY);
  ctx.stroke();
  // Vertical axis at centre
  const midX = box.x + box.w / 2;
  ctx.beginPath();
  ctx.moveTo(midX, box.y);
  ctx.lineTo(midX, box.y + box.h);
  ctx.stroke();
  // Title
  ctx.fillStyle = "#444";
  ctx.font = "13px 'Inter Variable', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(title, box.x + 6, box.y + 4);
}

function drawTimePanel(
  ctx: CanvasRenderingContext2D,
  box: PanelBox,
  kind: SignalKind,
  param: number,
): void {
  drawAxes(ctx, box, "f(t)");
  const tMax = timeWindow(kind, param);
  const samples: number[] = new Array(TIME_SAMPLES);
  let maxAbs = 1e-9;
  for (let i = 0; i < TIME_SAMPLES; i += 1) {
    const t = -tMax + (2 * tMax * i) / (TIME_SAMPLES - 1);
    const v = timeDomain(kind, param, t);
    samples[i] = v;
    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }
  const midY = box.y + box.h / 2;
  const scaleY = (box.h / 2) * 0.85;

  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < TIME_SAMPLES; i += 1) {
    const px = box.x + (i / (TIME_SAMPLES - 1)) * box.w;
    const v = samples[i]!;
    const py = midY - (v / maxAbs) * scaleY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawFreqPanel(
  ctx: CanvasRenderingContext2D,
  box: PanelBox,
  kind: SignalKind,
  param: number,
  omegaMax: number,
): void {
  drawAxes(ctx, box, "|F(ω)|");
  const omegas: number[] = new Array(OMEGA_SAMPLES);
  for (let i = 0; i < OMEGA_SAMPLES; i += 1) {
    omegas[i] = -omegaMax + (2 * omegaMax * i) / (OMEGA_SAMPLES - 1);
  }
  const spectrum: Complex[] = sampleFT(kind, param, omegas);
  const mags = spectrum.map(magnitude);
  let maxAbs = 1e-9;
  for (const m of mags) if (m > maxAbs) maxAbs = m;
  for (const c of spectrum) {
    if (Math.abs(c.re) > maxAbs) maxAbs = Math.abs(c.re);
    if (Math.abs(c.im) > maxAbs) maxAbs = Math.abs(c.im);
  }

  const midY = box.y + box.h / 2;
  const scaleY = (box.h / 2) * 0.85;
  const xAt = (i: number): number => box.x + (i / (OMEGA_SAMPLES - 1)) * box.w;

  // Magnitude — solid
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < OMEGA_SAMPLES; i += 1) {
    const py = midY - (mags[i]! / maxAbs) * scaleY;
    if (i === 0) ctx.moveTo(xAt(i), py);
    else ctx.lineTo(xAt(i), py);
  }
  ctx.stroke();

  if (kind === "exp-causal") {
    // Re — dashed blue
    ctx.strokeStyle = "#2b6cb0";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < OMEGA_SAMPLES; i += 1) {
      const py = midY - (spectrum[i]!.re / maxAbs) * scaleY;
      if (i === 0) ctx.moveTo(xAt(i), py);
      else ctx.lineTo(xAt(i), py);
    }
    ctx.stroke();

    // Im — dashed orange
    ctx.strokeStyle = "#dd6b20";
    ctx.beginPath();
    for (let i = 0; i < OMEGA_SAMPLES; i += 1) {
      const py = midY - (spectrum[i]!.im / maxAbs) * scaleY;
      if (i === 0) ctx.moveTo(xAt(i), py);
      else ctx.lineTo(xAt(i), py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function FtSignalsVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "ft-signals",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const meta = useMemo(() => SIGNAL_META[state.signalKind], [state.signalKind]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const timeBox: PanelBox = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H / 2 };
      const freqBox: PanelBox = {
        x: 0,
        y: CANVAS_H / 2,
        w: CANVAS_W,
        h: CANVAS_H / 2,
      };
      drawTimePanel(ctx, timeBox, state.signalKind, state.param);
      drawFreqPanel(ctx, freqBox, state.signalKind, state.param, state.omegaMax);
      // Divider
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H / 2);
      ctx.lineTo(CANVAS_W, CANVAS_H / 2);
      ctx.stroke();
    },
    [state.signalKind, state.param, state.omegaMax],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: FtSignalsDemoState): void => {
    setState(next);
  };

  return (
    <div className="ft-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: FtSignalsDemoState }[] as {
            name: string;
            state: FtSignalsDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Fourier transform signal presets"
      />

      <div className="ft-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Time- and frequency-domain plot of ${meta.label.toLowerCase()} signal`}
          draw={draw}
        />
        <MathHud corner="top-right" lines={[meta.label, meta.timeExpr, meta.freqExpr]} />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ft-visualizer__controls">
        <SliderRow
          label={`Parameter (${meta.paramLabel})`}
          description="T (width) for rect/triangle; a (decay/spread) for exp/gaussian."
          min={0.1}
          max={5.0}
          step={0.1}
          value={state.param}
          onChange={(param) => setState({ ...state, param })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Omega max"
          description="Maximum angular frequency plotted on the spectrum panel."
          min={5}
          max={50}
          step={1}
          value={state.omegaMax}
          onChange={(omegaMax) => setState({ ...state, omegaMax })}
          format={{ precision: 0, unit: "rad/s" }}
        />
      </div>

      <div className="ft-visualizer__actions">
        <button type="button" className="ft-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="ft-visualizer__counter" aria-live="off">
          param = {state.param.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
