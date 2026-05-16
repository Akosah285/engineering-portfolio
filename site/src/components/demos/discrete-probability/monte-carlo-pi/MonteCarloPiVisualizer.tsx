import { useCallback, useEffect, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { mulberry32 } from "./algorithm";
import { DEFAULT_STATE, type MonteCarloDemoState, PRESETS } from "./presets";
import "./MonteCarloPiVisualizer.css";

/**
 * <MonteCarloPiVisualizer> — π by random sampling (plan §4.x, #74).
 *
 * Scatters seeded (mulberry32) points into the unit square and colours
 * them green when they land inside the quarter-disc x²+y² ≤ 1, grey
 * otherwise. The running estimate π̂ = 4·inside/total and its standard
 * error are surfaced in a corner HUD.
 */

const CANVAS_SIZE = 360;

const STATE_SCHEMA = {
  seed: { type: "number", default: DEFAULT_STATE.seed },
  targetSamples: { type: "number", default: DEFAULT_STATE.targetSamples },
  speed: { type: "number", default: DEFAULT_STATE.speed },
} as const satisfies Schema;

interface Sample {
  readonly x: number;
  readonly y: number;
  readonly inside: boolean;
}

const narrationTemplate = (
  state: MonteCarloDemoState,
  drawn: number,
  estimate: number,
): string =>
  `Monte Carlo π estimation with seed ${state.seed}: ${drawn} of ${state.targetSamples} samples drawn so far, current estimate π̂ ≈ ${estimate.toFixed(4)} (true π ≈ 3.14159).`;

/** Draw the unit square outline + translucent quarter-disc backdrop. */
function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Quarter-disc (centred at bottom-left in canvas pixels, since (0,0) in
  // math-space maps to (0, height) on the canvas — y is flipped).
  ctx.fillStyle = "rgba(0, 105, 62, 0.12)";
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.arc(0, height, width, -Math.PI / 2, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 105, 62, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, height, width, -Math.PI / 2, 0);
  ctx.stroke();

  // Unit square outline
  ctx.strokeStyle = "rgba(60, 60, 60, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

/** Plot the accumulated samples as 1-pixel-ish dots. */
function paintSamples(ctx: CanvasRenderingContext2D, samples: readonly Sample[]): void {
  const { width, height } = ctx.canvas;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    const cx = s.x * width;
    const cy = height - s.y * height;
    ctx.fillStyle = s.inside ? "#00693e" : "rgba(90, 90, 90, 0.7)";
    ctx.fillRect(cx, cy, 1.5, 1.5);
  }
}

export function MonteCarloPiVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "monte-carlo-pi",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const samplesRef = useRef<Sample[]>([]);
  const insideRef = useRef(0);
  const rngRef = useRef<() => number>(mulberry32(state.seed));
  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [drawn, setDrawn] = useState(0);
  const [inside, setInside] = useState(0);

  // Re-seed and clear samples whenever any control changes.
  useEffect(() => {
    samplesRef.current = [];
    insideRef.current = 0;
    rngRef.current = mulberry32(state.seed);
    accumulatorRef.current = 0;
    setDrawn(0);
    setInside(0);
  }, [state.seed, state.targetSamples, state.speed]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      paintBackdrop(ctx);

      // Throw `speed` darts per ~16ms frame.
      const frameMs = 1000 / 60;
      accumulatorRef.current += deltaMs;
      let toAdd = 0;
      while (accumulatorRef.current >= frameMs) {
        accumulatorRef.current -= frameMs;
        toAdd += state.speed;
      }
      if (toAdd > 0 && samplesRef.current.length < state.targetSamples) {
        const remaining = state.targetSamples - samplesRef.current.length;
        const n = Math.min(toAdd, remaining);
        const rand = rngRef.current;
        let addedInside = 0;
        for (let i = 0; i < n; i += 1) {
          const x = rand();
          const y = rand();
          const isIn = x * x + y * y <= 1;
          if (isIn) addedInside += 1;
          samplesRef.current.push({ x, y, inside: isIn });
        }
        insideRef.current += addedInside;
        setDrawn(samplesRef.current.length);
        setInside(insideRef.current);
      }

      paintSamples(ctx, samplesRef.current);
    },
    [state.speed, state.targetSamples],
  );

  const total = drawn;
  const estimate = total > 0 ? (4 * inside) / total : 0;
  const p = total > 0 ? inside / total : 0;
  const standardError = total > 0 ? 4 * Math.sqrt((p * (1 - p)) / total) : 0;

  const handleReset = (): void => {
    reset();
    samplesRef.current = [];
    insideRef.current = 0;
    rngRef.current = mulberry32(DEFAULT_STATE.seed);
    accumulatorRef.current = 0;
    setDrawn(0);
    setInside(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="mc-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Monte Carlo π presets"
      />

      <div className="mc-visualizer__stage">
        <DemoCanvas
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          ariaLabel={`Monte Carlo π scatter: ${drawn} samples drawn, estimate ${estimate.toFixed(4)}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\hat\\pi = ${estimate.toFixed(4)}`,
            `SE = ${standardError.toFixed(4)}`,
            `n = ${drawn}`,
          ]}
        />
      </div>

      <DemoNarration
        state={state}
        template={(s) => narrationTemplate(s, drawn, estimate)}
      />

      <div className="mc-visualizer__controls">
        <SliderRow
          label="Seed"
          description="PRNG seed (mulberry32). Same seed → same sequence of darts."
          min={1}
          max={100000}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Target samples"
          description="How many darts to throw in total."
          min={100}
          max={50000}
          step={100}
          value={state.targetSamples}
          onChange={(targetSamples) => setState({ ...state, targetSamples })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Speed"
          description="Darts thrown per animation frame."
          min={1}
          max={500}
          step={1}
          value={state.speed}
          onChange={(speed) => setState({ ...state, speed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="mc-visualizer__actions">
        <button
          type="button"
          className="mc-visualizer__btn mc-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="mc-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="mc-visualizer__counter" aria-live="off">
          n {drawn} / {state.targetSamples}
        </span>
      </div>
    </div>
  );
}
