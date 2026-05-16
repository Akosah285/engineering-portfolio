import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  aliasedFrequency,
  lsb,
  quantize,
  sampleSine,
  willAlias,
} from "./algorithm";
import { type AdcSamplingDemoState, DEFAULT_STATE, PRESETS } from "./presets";
import "./AdcSamplingVisualizer.css";

/**
 * <AdcSamplingVisualizer> — wraps the pure adc-sampling algorithm in a
 * two-panel visualizer (time-domain + quantization staircase).
 */

const STATE_SCHEMA = {
  f: { type: "number", default: DEFAULT_STATE.f },
  fs: { type: "number", default: DEFAULT_STATE.fs },
  bits: { type: "number", default: DEFAULT_STATE.bits },
  amp: { type: "number", default: DEFAULT_STATE.amp },
} as const satisfies Schema;

const CURVE_POINTS = 500;

function paintAxes(ctx: CanvasRenderingContext2D, amp: number): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#f8f8f6";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d6d6d0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.fillStyle = "#888";
  ctx.font = "10px 'JetBrains Mono Variable', monospace";
  ctx.fillText(`+${amp.toFixed(1)}V`, 4, 12);
  ctx.fillText(`-${amp.toFixed(1)}V`, 4, height - 4);
}

function paintTimeDomain(
  ctx: CanvasRenderingContext2D,
  state: AdcSamplingDemoState,
  tMax: number,
): void {
  const { width, height } = ctx.canvas;
  paintAxes(ctx, state.amp);
  const yScale = (height / 2) / state.amp;
  const toX = (t: number) => (t / tMax) * width;
  const toY = (v: number) => height / 2 - v * yScale;

  // True sine curve, densely sampled.
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= CURVE_POINTS; i += 1) {
    const t = (i / CURVE_POINTS) * tMax;
    const v = state.amp * Math.sin(2 * Math.PI * state.f * t);
    const x = toX(t);
    const y = toY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Discrete samples at fs.
  const nSamples = Math.max(1, Math.ceil(tMax * state.fs) + 1);
  const samples = sampleSine({
    amplitude: state.amp,
    frequency: state.f,
    sampleRate: state.fs,
    nSamples,
  });
  ctx.fillStyle = "#cf4f4f";
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    if (s.t > tMax) break;
    const x = toX(s.t);
    const y = toY(s.value);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dashed reconstruction at aliased frequency if aliasing.
  if (willAlias(state.f, state.fs)) {
    const fAlias = aliasedFrequency(state.f, state.fs);
    ctx.strokeStyle = "#cf4f4f";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let i = 0; i <= CURVE_POINTS; i += 1) {
      const t = (i / CURVE_POINTS) * tMax;
      const v = state.amp * Math.sin(2 * Math.PI * fAlias * t);
      const x = toX(t);
      const y = toY(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function paintQuantization(
  ctx: CanvasRenderingContext2D,
  state: AdcSamplingDemoState,
  tMax: number,
): void {
  const { width, height } = ctx.canvas;
  paintAxes(ctx, state.amp);
  const yScale = (height / 2) / state.amp;
  const toX = (t: number) => (t / tMax) * width;
  const toY = (v: number) => height / 2 - v * yScale;

  // True sine.
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= CURVE_POINTS; i += 1) {
    const t = (i / CURVE_POINTS) * tMax;
    const v = state.amp * Math.sin(2 * Math.PI * state.f * t);
    const x = toX(t);
    const y = toY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Quantized staircase: densely sample the continuous signal so the
  // staircase reads as steps rather than aliased dots.
  ctx.strokeStyle = "#2f6f9f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let prevY = toY(
    quantize({
      bits: state.bits,
      vMin: -state.amp,
      vMax: state.amp,
      value: 0,
    }),
  );
  ctx.moveTo(0, prevY);
  for (let i = 1; i <= CURVE_POINTS; i += 1) {
    const t = (i / CURVE_POINTS) * tMax;
    const v = state.amp * Math.sin(2 * Math.PI * state.f * t);
    const q = quantize({
      bits: state.bits,
      vMin: -state.amp,
      vMax: state.amp,
      value: v,
    });
    const x = toX(t);
    const y = toY(q);
    ctx.lineTo(x, prevY);
    ctx.lineTo(x, y);
    prevY = y;
  }
  ctx.stroke();
}

export default function AdcSamplingVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "adc-sampling",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  // Show ~3 cycles of the signal of interest.
  const tMax = useMemo(() => 3 / Math.max(state.f, 1), [state.f]);

  const aliasing = willAlias(state.f, state.fs);
  const fAlias = aliasedFrequency(state.f, state.fs);
  const stepLsb = lsb(state.bits, 2 * state.amp);

  const drawTime: DrawFn = useCallback(
    (ctx) => {
      paintTimeDomain(ctx, state, tMax);
    },
    [state, tMax],
  );

  const drawQuant: DrawFn = useCallback(
    (ctx) => {
      paintQuantization(ctx, state, tMax);
    },
    [state, tMax],
  );

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="adc-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="ADC sampling presets"
      />

      <div className="adc-visualizer__stage">
        <div className="adc-visualizer__panel">
          <DemoCanvas
            width={640}
            height={220}
            ariaLabel="Time-domain sine with discrete samples and aliased reconstruction"
            draw={drawTime}
          />
          <MathHud
            corner="top-right"
            lines={[
              `f = ${state.f.toFixed(0)}\\,\\text{Hz}`,
              `f_s = ${state.fs.toFixed(0)}\\,\\text{Hz}`,
              `f_{Nyq} = ${(state.fs / 2).toFixed(1)}\\,\\text{Hz}`,
              `f_{alias} = ${fAlias.toFixed(2)}\\,\\text{Hz}`,
            ]}
          />
        </div>
        <div className="adc-visualizer__panel">
          <DemoCanvas
            width={640}
            height={220}
            ariaLabel="Quantization staircase reconstruction"
            draw={drawQuant}
          />
          <MathHud
            corner="top-right"
            lines={[
              `\\text{bits} = ${state.bits}`,
              `\\text{LSB} = ${stepLsb.toFixed(4)}\\,\\text{V}`,
            ]}
          />
        </div>
      </div>

      <div className="adc-visualizer__controls">
        <SliderRow
          label="f (signal frequency)"
          description="True frequency of the continuous sine wave, in hertz."
          min={1}
          max={100}
          step={1}
          value={state.f}
          onChange={(f) => setState({ ...state, f })}
          format={{ precision: 0, unit: "Hz" }}
        />
        <SliderRow
          label="fs (ADC rate)"
          description="ADC sample rate. Must exceed 2·f to avoid aliasing."
          min={10}
          max={500}
          step={10}
          value={state.fs}
          onChange={(fs) => setState({ ...state, fs })}
          format={{ precision: 0, unit: "Hz" }}
        />
        <SliderRow
          label="bits (quantizer bits)"
          description="Resolution of the mid-tread uniform quantizer."
          min={1}
          max={12}
          step={1}
          value={state.bits}
          onChange={(bits) => setState({ ...state, bits })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="amp (amplitude)"
          description="Peak amplitude of the sine, in volts. Sets quantizer range."
          min={0.5}
          max={2.0}
          step={0.1}
          value={state.amp}
          onChange={(amp) => setState({ ...state, amp })}
          format={{ precision: 1, unit: "V" }}
        />
      </div>

      <div className="adc-visualizer__actions">
        {aliasing ? (
          <span className="adc-visualizer__badge" role="alert">
            ALIASING
          </span>
        ) : null}
        <button type="button" className="adc-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="adc-visualizer__counter" aria-live="polite">
          f_alias = {fAlias.toFixed(2)} Hz
        </span>
      </div>
    </div>
  );
}
