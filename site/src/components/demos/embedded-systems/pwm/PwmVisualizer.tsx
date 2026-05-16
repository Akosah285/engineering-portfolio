import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { aggregates, trace } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  PRESET_SLUGS,
  type PwmDemoState,
  USE_CASES,
} from "./presets";
import "./PwmVisualizer.css";

/**
 * <PwmVisualizer> — pulse-width modulation waveform demo (plan §4.x, #127).
 *
 * Plots the square pulse train alongside its DC-equivalent (average) and
 * RMS-equivalent levels — the two derived quantities a microcontroller
 * datasheet cares about for motor control vs heater dimming.
 */

const SAMPLES = 600;

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: PRESET_SLUGS,
  },
  frequency: { type: "number", default: DEFAULT_STATE.frequency },
  duty: { type: "number", default: DEFAULT_STATE.duty },
  vHigh: { type: "number", default: DEFAULT_STATE.vHigh },
  vLow: { type: "number", default: DEFAULT_STATE.vLow },
  nPeriods: { type: "number", default: DEFAULT_STATE.nPeriods },
} as const satisfies Schema;

const narrationTemplate = (state: PwmDemoState): string => {
  const agg = aggregates({
    frequency: state.frequency,
    duty: state.duty,
    vHigh: state.vHigh,
    vLow: state.vLow,
  });
  const useCase = USE_CASES[state.presetSlug];
  const pct = Math.round(state.duty * 100);
  return `PWM pulse train at frequency ${state.frequency} Hz with duty cycle ${pct}%, switching between ${state.vLow.toFixed(1)} V and ${state.vHigh.toFixed(1)} V. The DC average is ${agg.average.toFixed(3)} V and the RMS-equivalent voltage is ${agg.rms.toFixed(3)} V — the levels that matter for ${useCase}.`;
};

interface Axes {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

function toCanvas(
  axes: Axes,
  width: number,
  height: number,
  x: number,
  y: number,
): readonly [number, number] {
  const cx = ((x - axes.xMin) / (axes.xMax - axes.xMin)) * width;
  const cy = height - ((y - axes.yMin) / (axes.yMax - axes.yMin)) * height;
  return [cx, cy];
}

export function PwmVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "pwm",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const params = useMemo(
    () => ({
      frequency: state.frequency,
      duty: state.duty,
      vHigh: state.vHigh,
      vLow: state.vLow,
    }),
    [state.frequency, state.duty, state.vHigh, state.vLow],
  );

  const agg = useMemo(() => aggregates(params), [params]);

  const tEnd = state.nPeriods / state.frequency;
  const samples = useMemo(
    () => trace(params, tEnd, SAMPLES),
    [params, tEnd],
  );

  const axes: Axes = useMemo(
    () => ({
      xMin: 0,
      xMax: tEnd,
      yMin: state.vLow - 0.5,
      yMax: state.vHigh + 0.5,
    }),
    [tEnd, state.vLow, state.vHigh],
  );

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);

      // Axes (grey)
      ctx.strokeStyle = "#bcbcbc";
      ctx.lineWidth = 1;
      // x axis at y=0 if in range, else at the bottom
      const yZero =
        axes.yMin <= 0 && axes.yMax >= 0
          ? toCanvas(axes, width, height, 0, 0)[1]
          : height - 0.5;
      ctx.beginPath();
      ctx.moveTo(0, yZero);
      ctx.lineTo(width, yZero);
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, height);
      ctx.stroke();

      // Waveform as step function
      ctx.strokeStyle = "#00693e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      samples.forEach((p, i) => {
        const [cx, cy] = toCanvas(axes, width, height, p.t, p.v);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      // Helper to paint a dashed horizontal line + label
      const paintLevel = (
        y: number,
        color: string,
        label: string,
      ): void => {
        const [, cy] = toCanvas(axes, width, height, 0, y);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        ctx.font =
          "12px 'JetBrains Mono Variable', ui-monospace, monospace";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, 8, cy - 2);
      };

      paintLevel(agg.average, "#1f6feb", `Avg = ${agg.average.toFixed(3)} V`);
      paintLevel(agg.rms, "#cf6b1e", `RMS = ${agg.rms.toFixed(3)} V`);
    },
    [axes, samples, agg],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: PwmDemoState): void => {
    setState(next);
  };

  // Clamp vHigh >= vLow + 0.1; clamp vLow <= vHigh - 0.1
  const setVHigh = (vHigh: number): void => {
    const clamped = vHigh < state.vLow + 0.1 ? state.vLow + 0.1 : vHigh;
    setState({ ...state, vHigh: clamped });
  };
  const setVLow = (vLow: number): void => {
    const clamped = vLow > state.vHigh - 0.1 ? state.vHigh - 0.1 : vLow;
    setState({ ...state, vLow: clamped });
  };

  const pct = Math.round(state.duty * 100);

  return (
    <div className="pw-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: PwmDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="PWM presets"
      />

      <div className="pw-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`PWM waveform at ${state.frequency} hertz, duty cycle ${pct} percent`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{period} = ${agg.period.toFixed(4)}\\,\\text{s}`,
            `f = ${state.frequency}\\,\\text{Hz}`,
            `D = ${pct}\\%`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="pw-visualizer__controls">
        <SliderRow
          label="Frequency"
          description="Pulse rate in hertz."
          min={1}
          max={10000}
          step={1}
          value={state.frequency}
          onChange={(frequency) => setState({ ...state, frequency })}
          format={{ precision: 0, unit: "Hz" }}
        />
        <SliderRow
          label="Duty cycle"
          description="Fraction of each period spent at V_high."
          min={0}
          max={1}
          step={0.01}
          value={state.duty}
          onChange={(duty) => setState({ ...state, duty })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="V high"
          min={0}
          max={12}
          step={0.5}
          value={state.vHigh}
          onChange={setVHigh}
          format={{ precision: 1, unit: "V" }}
        />
        <SliderRow
          label="V low"
          min={-5}
          max={5}
          step={0.5}
          value={state.vLow}
          onChange={setVLow}
          format={{ precision: 1, unit: "V" }}
        />
        <SliderRow
          label="N periods"
          description="How many periods of the waveform to display."
          min={1}
          max={20}
          step={1}
          value={state.nPeriods}
          onChange={(nPeriods) => setState({ ...state, nPeriods })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="pw-visualizer__actions">
        <button
          type="button"
          className="pw-visualizer__btn"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="pw-visualizer__counter" aria-live="off">
          f = {state.frequency}Hz, D = {pct}%
        </span>
      </div>
    </div>
  );
}
