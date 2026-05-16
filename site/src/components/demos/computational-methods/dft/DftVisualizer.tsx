import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { binFrequency, dft, magnitudes, realToComplex } from "./algorithm";
import {
  DEFAULT_STATE,
  type DftDemoState,
  PRESETS,
  SIGNAL_LABELS,
  SIGNAL_SLUGS,
  getSignalGenerator,
} from "./presets";
import "./DftVisualizer.css";

/**
 * <DftVisualizer> — visualise a real signal in time + frequency domains.
 *
 * Top panel: time-domain samples. Bottom panel: one-sided magnitude
 * spectrum (k = 0..N/2). Recomputes on every control change — no
 * animation loop.
 */

const STATE_SCHEMA = {
  signalSlug: {
    type: "enum",
    default: DEFAULT_STATE.signalSlug,
    values: SIGNAL_SLUGS,
  },
  N: { type: "number", default: DEFAULT_STATE.N },
  sampleRate: { type: "number", default: DEFAULT_STATE.sampleRate },
} as const satisfies Schema;

const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 28;
const GAP = 24;

const TIME_COLOR = "#0b6bcb";
const SPEC_COLOR = "#00693e";

const narrationTemplate = (
  state: DftDemoState & { kPeak: number; fPeak: number },
): string => {
  const label = SIGNAL_LABELS[state.signalSlug];
  return `Discrete Fourier transform of the ${label.toLowerCase()} signal sampled at N = ${state.N} points (sample rate ${state.sampleRate} Hz). Peak frequency component sits at bin k = ${state.kPeak}, or about ${state.fPeak.toFixed(2)} Hz.`;
};

function clearStage(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function paintTimePanel(
  ctx: CanvasRenderingContext2D,
  rect: PanelRect,
  signal: readonly number[],
): void {
  const { x, y, w, h } = rect;
  let maxAbs = 0;
  for (const v of signal) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs === 0) maxAbs = 1;

  // Frame + gridlines
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.strokeStyle = "#cfcfcf";
  ctx.stroke();

  // Y-axis labels
  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(maxAbs.toFixed(2), x - 4, y + 2);
  ctx.fillText("0", x - 4, y + h / 2);
  ctx.fillText((-maxAbs).toFixed(2), x - 4, y + h - 2);

  const N = signal.length;
  const xAt = (n: number): number => x + (N <= 1 ? 0 : (n / (N - 1)) * w);
  const yAt = (v: number): number => y + h / 2 - (v / maxAbs) * (h / 2 - 4);

  // Connected line
  ctx.strokeStyle = TIME_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let n = 0; n < N; n += 1) {
    const cx = xAt(n);
    const cy = yAt(signal[n]!);
    if (n === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Dots (skip on dense N to keep readable)
  const dotEvery = Math.max(1, Math.ceil(N / 96));
  ctx.fillStyle = TIME_COLOR;
  for (let n = 0; n < N; n += dotEvery) {
    ctx.beginPath();
    ctx.arc(xAt(n), yAt(signal[n]!), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // X-axis label
  ctx.fillStyle = "#444";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "11px sans-serif";
  ctx.fillText("sample index n", x + w / 2, y + h + 6);
  ctx.fillText("0", x, y + h + 6);
  ctx.fillText(String(N - 1), x + w, y + h + 6);

  // Panel title
  ctx.textAlign = "left";
  ctx.fillStyle = "#222";
  ctx.font = "11px sans-serif";
  ctx.fillText("Time domain  x[n]", x, y - 12);
}

function paintSpectrumPanel(
  ctx: CanvasRenderingContext2D,
  rect: PanelRect,
  mags: readonly number[],
  N: number,
  sampleRate: number,
): void {
  const { x, y, w, h } = rect;
  const half = Math.floor(N / 2);
  const bins = half + 1;
  let maxMag = 0;
  for (let k = 0; k < bins; k += 1) {
    const m = (mags[k] ?? 0) / N;
    if (m > maxMag) maxMag = m;
  }
  if (maxMag === 0) maxMag = 1;

  // Frame
  ctx.strokeStyle = "#e8e8e8";
  ctx.strokeRect(x, y, w, h);

  // Y-axis labels
  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(maxMag.toFixed(2), x - 4, y + 2);
  ctx.fillText("0", x - 4, y + h - 2);

  const barW = w / bins;
  ctx.fillStyle = SPEC_COLOR;
  for (let k = 0; k < bins; k += 1) {
    const m = (mags[k] ?? 0) / N;
    const bh = (m / maxMag) * (h - 6);
    const bx = x + k * barW;
    ctx.fillRect(bx + 0.5, y + h - bh, Math.max(1, barW - 1), bh);
  }

  // X-axis: frequency labels at 0, N/4, N/2
  ctx.fillStyle = "#444";
  ctx.textBaseline = "top";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${binFrequency(0, N, sampleRate).toFixed(1)}`, x, y + h + 6);
  ctx.textAlign = "center";
  ctx.fillText(
    `${binFrequency(half / 2, N, sampleRate).toFixed(1)}`,
    x + w / 2,
    y + h + 6,
  );
  ctx.textAlign = "right";
  ctx.fillText(`${binFrequency(half, N, sampleRate).toFixed(1)}`, x + w, y + h + 6);
  ctx.textAlign = "center";
  ctx.fillText("frequency (Hz)", x + w / 2, y + h + 18);

  // Panel title
  ctx.textAlign = "left";
  ctx.fillStyle = "#222";
  ctx.font = "11px sans-serif";
  ctx.fillText("Magnitude spectrum  |X[k]| / N", x, y - 12);
}

export function DftVisualizer() {
  const [state, setState, { reset }] = useDemoState("dft", STATE_SCHEMA, DEFAULT_STATE);

  // Snap N to a multiple of 8 within bounds.
  const N = Math.max(8, Math.min(256, Math.round(state.N / 8) * 8));
  const sampleRate = Math.max(1, Math.min(1000, Math.round(state.sampleRate)));

  const { signal, mags, kPeak, fPeak } = useMemo(() => {
    const gen = getSignalGenerator(state.signalSlug);
    const sig = gen(N);
    const spectrum = dft(realToComplex(sig));
    const mag = magnitudes(spectrum);
    // Peak over one-sided bins, skipping DC.
    const half = Math.floor(N / 2);
    let kp = 0;
    let best = Number.NEGATIVE_INFINITY;
    for (let k = 1; k <= half; k += 1) {
      const m = mag[k] ?? 0;
      if (m > best) {
        best = m;
        kp = k;
      }
    }
    return {
      signal: sig,
      mags: mag,
      kPeak: kp,
      fPeak: binFrequency(kp, N, sampleRate),
    };
  }, [state.signalSlug, N, sampleRate]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      clearStage(ctx);
      const innerW = width - PAD_L - PAD_R;
      const panelH = (height - PAD_T - PAD_B - GAP) / 2;
      const top: PanelRect = { x: PAD_L, y: PAD_T, w: innerW, h: panelH };
      const bot: PanelRect = {
        x: PAD_L,
        y: PAD_T + panelH + GAP,
        w: innerW,
        h: panelH,
      };
      paintTimePanel(ctx, top, signal);
      paintSpectrumPanel(ctx, bot, mags, N, sampleRate);
    },
    [signal, mags, N, sampleRate],
  );

  const narrationState = { ...state, N, sampleRate, kPeak, fPeak };

  const handlePresetSelect = (next: DftDemoState): void => {
    setState(next);
  };

  return (
    <div className="df-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: DftDemoState }[] as {
            name: string;
            state: DftDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="DFT signal presets"
      />

      <div className="df-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`DFT of ${SIGNAL_LABELS[state.signalSlug].toLowerCase()} at N = ${N} samples`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `N = ${N}`,
            `\\text{peak bin} = ${kPeak}`,
            `f_{\\text{peak}} = ${fPeak.toFixed(2)}\\,\\text{Hz}`,
          ]}
        />
      </div>

      <DemoNarration state={narrationState} template={narrationTemplate} />

      <div className="df-visualizer__controls">
        <SliderRow
          label="N (sample count)"
          description="Number of samples in the signal. Snaps to a multiple of 8; powers of 2 preferred."
          min={8}
          max={256}
          step={8}
          value={N}
          onChange={(next) => setState({ ...state, N: next })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Sample rate"
          description="Sampling rate in hertz; used to label the spectrum's frequency axis."
          min={1}
          max={1000}
          step={1}
          value={sampleRate}
          onChange={(next) => setState({ ...state, sampleRate: next })}
          format={{ precision: 0, unit: "Hz" }}
        />
      </div>

      <div className="df-visualizer__actions">
        <button type="button" className="df-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="df-visualizer__counter" aria-live="off">
          N = {N}
        </span>
      </div>
    </div>
  );
}
