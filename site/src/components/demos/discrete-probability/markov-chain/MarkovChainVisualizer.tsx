import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { stationary, step } from "./algorithm";
import {
  CHAIN_SLUGS,
  DEFAULT_STATE,
  INITIAL_STATE_SLUGS,
  type MarkovChain,
  type MarkovDemoState,
  PRESETS,
  getChain,
  resolveInitialDistribution,
} from "./presets";
import "./MarkovChainVisualizer.css";

/**
 * <MarkovChainVisualizer> — discrete-time Markov chain demo (plan §4.4, #66).
 *
 * Animates a state distribution converging to its stationary distribution
 * under a chosen transition matrix, with the matrix itself shown as a
 * heatmap below the distribution bars.
 */

const STATE_SCHEMA = {
  chainSlug: {
    type: "enum",
    default: DEFAULT_STATE.chainSlug,
    values: CHAIN_SLUGS,
  },
  initialStateSlug: {
    type: "enum",
    default: DEFAULT_STATE.initialStateSlug,
    values: INITIAL_STATE_SLUGS,
  },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
} as const satisfies Schema;

function l1(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) s += Math.abs(a[i]! - b[i]!);
  return s;
}

const narrationTemplate =
  (chain: MarkovChain, currentStep: number, distance: number) =>
  (_state: MarkovDemoState): string =>
    `Markov chain "${chain.name}" with ${chain.P.length} states; after ${currentStep} step${currentStep === 1 ? "" : "s"}, the distribution is ${distance.toFixed(4)} (L1) away from its stationary distribution.`;

/** Paint the distribution bars (current filled + stationary outline). */
function paintBars(
  ctx: CanvasRenderingContext2D,
  chain: MarkovChain,
  dist: readonly number[],
  stationaryDist: readonly number[],
  height: number,
): void {
  const { width } = ctx.canvas;
  const n = chain.P.length;
  const slot = width / n;
  const barW = slot * 0.7;
  const padX = (slot - barW) / 2;
  const baseY = height;

  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (let i = 0; i < n; i += 1) {
    const p = dist[i] ?? 0;
    const sp = stationaryDist[i] ?? 0;
    const x = i * slot + padX;
    const h = p * (height - 24);
    const sh = sp * (height - 24);

    // Filled bar: current distribution
    ctx.fillStyle = "#00693e";
    ctx.fillRect(x, baseY - h - 18, barW, h);

    // Outlined bar: stationary distribution overlay
    ctx.strokeStyle = "#cf4f4f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, baseY - sh - 18, barW, sh);

    // Probability text + state label
    ctx.fillStyle = "#3a3a3a";
    ctx.fillText(p.toFixed(2), x + barW / 2, baseY - h - 20);
    const label = chain.stateLabels[i] ?? `S${i}`;
    ctx.fillText(label, x + barW / 2, baseY - 2);
  }
}

/** Paint the transition matrix as a heatmap. */
function paintHeatmap(
  ctx: CanvasRenderingContext2D,
  chain: MarkovChain,
  top: number,
  height: number,
): void {
  const { width } = ctx.canvas;
  const n = chain.P.length;
  // Center a square grid inside the bottom half.
  const cellSize = Math.min(width, height - 8) / n;
  const gridW = cellSize * n;
  const offsetX = (width - gridW) / 2;
  const offsetY = top + (height - cellSize * n) / 2;

  ctx.font = "11px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < n; i += 1) {
    const row = chain.P[i]!;
    for (let j = 0; j < n; j += 1) {
      const p = row[j]!;
      // White (p=0) → dark green (p=1).
      const t = Math.max(0, Math.min(1, p));
      const r = Math.round(255 - t * (255 - 0));
      const g = Math.round(255 - t * (255 - 105));
      const b = Math.round(255 - t * (255 - 62));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const x = offsetX + j * cellSize;
      const y = offsetY + i * cellSize;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);
      ctx.fillStyle = t > 0.5 ? "#ffffff" : "#3a3a3a";
      ctx.fillText(p.toFixed(2), x + cellSize / 2, y + cellSize / 2);
    }
  }
}

export function MarkovChainVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "markov-chain",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const chain = useMemo(() => getChain(state.chainSlug), [state.chainSlug]);

  const stationaryDist = useMemo(() => stationary({ P: chain.P }).distribution, [chain]);

  const initialDist = useMemo(
    () => resolveInitialDistribution(chain, state.initialStateSlug),
    [chain, state.initialStateSlug],
  );

  const distRef = useRef<number[]>(initialDist.slice());
  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  // Reset whenever chain or initial state changes (matrix shape may change).
  useEffect(() => {
    distRef.current = initialDist.slice();
    accumulatorRef.current = 0;
    setStepCount(0);
  }, [initialDist]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const halfH = height / 2;

      accumulatorRef.current += deltaMs;
      let advanced = 0;
      // Cap per-frame steps so a long-stalled tab doesn't run thousands.
      while (accumulatorRef.current >= state.stepDelay && advanced < 10) {
        accumulatorRef.current -= state.stepDelay;
        advanced += 1;
        try {
          distRef.current = step(distRef.current, chain.P);
        } catch {
          // Defensive: should never trip thanks to preset validation.
          break;
        }
      }
      if (advanced > 0) setStepCount((s) => s + advanced);

      paintBars(ctx, chain, distRef.current, stationaryDist, halfH);
      paintHeatmap(ctx, chain, halfH, halfH);
    },
    [chain, stationaryDist, state.stepDelay],
  );

  const currentDistance = l1(distRef.current, stationaryDist);

  const handleReset = (): void => {
    reset();
    distRef.current = resolveInitialDistribution(
      getChain(DEFAULT_STATE.chainSlug),
      DEFAULT_STATE.initialStateSlug,
    );
    accumulatorRef.current = 0;
    setStepCount(0);
  };

  const handlePresetSelect = (next: MarkovDemoState): void => {
    setState(next);
  };

  const n = chain.P.length;
  // Only expose initial-state options that index into the current chain.
  const initialStateOptions: {
    slug: (typeof INITIAL_STATE_SLUGS)[number];
    label: string;
  }[] = [
    { slug: "uniform", label: "Uniform" },
    ...Array.from({ length: n }, (_, i) => ({
      slug: `state-${i}` as (typeof INITIAL_STATE_SLUGS)[number],
      label: `Start in ${chain.stateLabels[i] ?? `S${i}`}`,
    })),
  ];

  return (
    <div className="mk-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: MarkovDemoState }[] as {
            name: string;
            state: MarkovDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Markov chain presets"
      />

      <div className="mk-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Markov chain distribution for ${chain.name}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `t = ${stepCount}`,
            `\\|\\pi - \\pi^*\\|_1 = ${currentDistance.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration
        state={state}
        template={narrationTemplate(chain, stepCount, currentDistance)}
      />

      <div className="mk-visualizer__controls">
        <SliderRow
          label="Step delay (ms)"
          description="Time between Markov steps. Lower = faster animation."
          min={100}
          max={2000}
          step={100}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0 }}
        />
        <label className="mk-visualizer__select-row">
          <span>Initial state</span>
          <select
            value={state.initialStateSlug}
            onChange={(e) =>
              setState({
                ...state,
                initialStateSlug: e.target.value as (typeof INITIAL_STATE_SLUGS)[number],
              })
            }
          >
            {initialStateOptions.map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mk-visualizer__actions">
        <button
          type="button"
          className="mk-visualizer__btn mk-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="mk-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="mk-visualizer__counter" aria-live="off">
          step {stepCount}
        </span>
      </div>
    </div>
  );
}
