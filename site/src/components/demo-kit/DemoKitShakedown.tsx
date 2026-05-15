import { useState } from "react";
import { DemoCanvas, type DrawFn } from "./DemoCanvas";
import { DemoNarration } from "./DemoNarration";
import { MathHud } from "./MathHud";
import { SliderRow } from "./SliderRow";
import "./DemoKitShakedown.css";

interface OscillatorState {
  freq: number;
  amplitude: number;
}

const template = (s: OscillatorState): string =>
  `Oscillator running at ${s.freq.toFixed(0)} Hz with amplitude ${s.amplitude.toFixed(2)}.`;

/**
 * Shakedown consumer that exercises all four #15 primitives end-to-end:
 *   - <SliderRow> for two parameters
 *   - <DemoCanvas> with a draw fn that animates a sine wave
 *   - <MathHud> overlaying the current parameters
 *   - <DemoNarration> mirroring the same state in an aria-live region
 */
export function DemoKitShakedown() {
  const [state, setState] = useState<OscillatorState>({
    freq: 2,
    amplitude: 0.7,
  });

  const draw: DrawFn = (ctx, _delta, total) => {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = "rgba(115, 115, 115, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += width / 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Centred sine wave
    ctx.strokeStyle = "#00693e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const midY = height / 2;
    const amp = state.amplitude * (height / 2 - 8);
    const phase = (total / 1000) * state.freq * Math.PI * 2;
    for (let x = 0; x <= width; x += 2) {
      const t = x / width;
      const y = midY + amp * Math.sin(t * Math.PI * 2 * state.freq + phase);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  return (
    <div className="demo-kit-shakedown">
      <div className="demo-kit-shakedown__stage">
        <DemoCanvas
          width={640}
          height={240}
          ariaLabel="Live sine-wave oscillator"
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `f = ${state.freq.toFixed(1)}\\,\\text{Hz}`,
            `A = ${state.amplitude.toFixed(2)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={template} />

      <div className="demo-kit-shakedown__controls">
        <SliderRow
          label="Frequency"
          min={0.5}
          max={8}
          step={0.5}
          value={state.freq}
          onChange={(freq) => setState((s) => ({ ...s, freq }))}
          format={{ unit: "Hz", precision: 1 }}
        />
        <SliderRow
          label="Amplitude"
          min={0.1}
          max={1}
          step={0.05}
          value={state.amplitude}
          onChange={(amplitude) => setState((s) => ({ ...s, amplitude }))}
          format={{ precision: 2 }}
        />
      </div>
    </div>
  );
}
