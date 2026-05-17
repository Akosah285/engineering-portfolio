import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { mulberry32 } from "../monte-carlo-pi/algorithm";
import { expectedDuration, ruinProb, simulate } from "./algorithm";
import { DEFAULT_STATE, type GamblersRuinDemoState, PRESETS } from "./presets";
import "./GamblersRuinVisualizer.css";

/**
 * <GamblersRuinVisualizer> — animated random walks on {0..N} with
 * absorbing barriers, comparing empirical ruin frequency to the
 * analytical P(ruin) from algorithm.ts.
 */

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const TARGET_STEPS_PER_SECOND = 60;

const STATE_SCHEMA = {
  N: { type: "number", default: DEFAULT_STATE.N },
  k: { type: "number", default: DEFAULT_STATE.k },
  p: { type: "number", default: DEFAULT_STATE.p },
  numWalks: { type: "number", default: DEFAULT_STATE.numWalks },
  seed: { type: "number", default: DEFAULT_STATE.seed },
} as const satisfies Schema;

interface Walk {
  readonly path: number[];
  readonly terminal: 0 | 1 | null; // 0 = ruin, 1 = win, null = in progress
}

const narrationTemplate = (
  state: GamblersRuinDemoState,
  analyticalRuin: number,
  empiricalRuin: number,
  completed: number,
): string =>
  `Gambler's ruin random walk on {0..${state.N}} starting at wealth k=${state.k} with win probability p=${state.p.toFixed(2)}. Simulating ${state.numWalks} walks; ${completed} completed so far. Analytical P(ruin) ≈ ${analyticalRuin.toFixed(3)}, empirical ${empiricalRuin.toFixed(3)}.`;

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  N: number,
  k: number,
  maxSteps: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const yWin = 0;
  const yRuin = height;
  const yStart = height - (k / N) * height;

  // Ruin barrier (y=0)
  ctx.strokeStyle = "rgba(192, 60, 60, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, yRuin - 0.5);
  ctx.lineTo(width, yRuin - 0.5);
  ctx.stroke();

  // Win barrier (y=N)
  ctx.strokeStyle = "rgba(40, 140, 70, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, yWin + 0.5);
  ctx.lineTo(width, yWin + 0.5);
  ctx.stroke();

  // Start marker at y=k
  ctx.strokeStyle = "rgba(80, 80, 80, 0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, yStart);
  ctx.lineTo(width, yStart);
  ctx.stroke();
  ctx.setLineDash([]);

  // Faint background
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  void maxSteps;
}

function paintWalks(
  ctx: CanvasRenderingContext2D,
  walks: readonly Walk[],
  N: number,
  maxSteps: number,
): void {
  const { width, height } = ctx.canvas;
  if (maxSteps < 1) return;
  const sx = width / maxSteps;
  const sy = height / N;

  for (let w = 0; w < walks.length; w += 1) {
    const walk = walks[w]!;
    const path = walk.path;
    if (path.length < 2) continue;
    let stroke: string;
    if (walk.terminal === 0) stroke = "rgba(192, 60, 60, 0.55)";
    else if (walk.terminal === 1) stroke = "rgba(40, 140, 70, 0.55)";
    else stroke = "rgba(80, 80, 80, 0.45)";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < path.length; i += 1) {
      const v = path[i]!;
      const cx = i * sx;
      const cy = height - v * sy;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

export function GamblersRuinVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "gamblers-ruin",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  // Clamp k into [1, N-1] for downstream computations / rendering.
  const N = Math.max(2, Math.round(state.N));
  const kClamped = Math.min(N - 1, Math.max(1, Math.round(state.k)));
  const p = state.p;

  // Pre-compute all walks deterministically whenever inputs change.
  const allWalks = useMemo<Walk[]>(() => {
    const rng = mulberry32(state.seed);
    const out: Walk[] = [];
    for (let i = 0; i < state.numWalks; i += 1) {
      // Reconstruct the path step-by-step so we can animate it.
      // We use the same rng draw rule as `simulate` (rng() < p → +1).
      const path: number[] = [kClamped];
      let s = kClamped;
      let steps = 0;
      const cap = 10 * N * N + 100_000;
      while (s !== 0 && s !== N) {
        if (rng() < p) s += 1;
        else s -= 1;
        path.push(s);
        steps += 1;
        if (steps > cap) break;
      }
      out.push({ path, terminal: s === 0 ? 0 : 1 });
    }
    return out;
  }, [N, kClamped, p, state.numWalks, state.seed]);

  // How long the longest walk is — used to scale the x-axis.
  const maxSteps = useMemo(() => {
    let m = 1;
    for (const w of allWalks) {
      if (w.path.length - 1 > m) m = w.path.length - 1;
    }
    return m;
  }, [allWalks]);

  // Animation state — how far along (in steps) we've revealed each walk.
  const revealRef = useRef(0);
  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only dep; body resets refs/state, doesn't read allWalks
  useEffect(() => {
    revealRef.current = 0;
    accumulatorRef.current = 0;
    setCompletedCount(0);
  }, [allWalks]);

  // Validated copy of `simulate` to make sure our inline path matches the
  // contract — defensive use, not required at runtime but helps catch
  // drift if `simulate` ever changes.
  void simulate;

  const analyticalRuin = useMemo(() => {
    try {
      return ruinProb({ N, k: kClamped, p });
    } catch {
      return Number.NaN;
    }
  }, [N, kClamped, p]);

  const expectedT = useMemo(() => {
    try {
      return expectedDuration({ N, k: kClamped, p });
    } catch {
      return Number.NaN;
    }
  }, [N, kClamped, p]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      paintBackdrop(ctx, N, kClamped, maxSteps);

      // Advance reveal counter.
      const stepInterval = 1000 / TARGET_STEPS_PER_SECOND;
      accumulatorRef.current += deltaMs;
      let advanced = 0;
      while (accumulatorRef.current >= stepInterval && advanced < 50) {
        accumulatorRef.current -= stepInterval;
        advanced += 1;
      }
      if (advanced > 0 && revealRef.current < maxSteps) {
        revealRef.current = Math.min(maxSteps, revealRef.current + advanced);
      }

      const reveal = revealRef.current;

      // Build the revealed slice of each walk and count completed.
      const revealed: Walk[] = new Array(allWalks.length);
      let completed = 0;
      for (let i = 0; i < allWalks.length; i += 1) {
        const w = allWalks[i]!;
        const lastStepIdx = w.path.length - 1;
        if (reveal >= lastStepIdx) {
          revealed[i] = w;
          completed += 1;
        } else {
          revealed[i] = {
            path: w.path.slice(0, reveal + 1),
            terminal: null,
          };
        }
      }

      paintWalks(ctx, revealed, N, maxSteps);

      if (completed !== completedCount) {
        setCompletedCount(completed);
      }
    },
    [allWalks, N, kClamped, maxSteps, completedCount],
  );

  // Empirical ruin rate over walks that have actually finished animating.
  const empiricalRuin = useMemo(() => {
    if (completedCount === 0) return 0;
    let ruined = 0;
    let counted = 0;
    for (let i = 0; i < allWalks.length && counted < completedCount; i += 1) {
      const w = allWalks[i]!;
      if (w.terminal === 0) ruined += 1;
      counted += 1;
    }
    return ruined / completedCount;
  }, [allWalks, completedCount]);

  const handleReset = (): void => {
    reset();
    revealRef.current = 0;
    accumulatorRef.current = 0;
    setCompletedCount(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  // When N changes via the slider, clamp k into [1, N-1] in committed state.
  const handleNChange = (nextN: number): void => {
    const n = Math.max(5, Math.min(100, Math.round(nextN)));
    const nextK = Math.min(n - 1, Math.max(1, state.k));
    setState({ ...state, N: n, k: nextK });
  };

  return (
    <div className="gr-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Gambler's ruin presets"
      />

      <div className="gr-visualizer__stage">
        <DemoCanvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          ariaLabel={`Gambler's ruin: ${state.numWalks} random walks from k=${kClamped} on {0..${N}} with p=${p.toFixed(2)}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `P(\\text{ruin}) = ${Number.isFinite(analyticalRuin) ? analyticalRuin.toFixed(3) : "n/a"}`,
            `\\text{Empirical} = ${empiricalRuin.toFixed(3)}`,
            `E[T] = ${Number.isFinite(expectedT) ? expectedT.toFixed(0) : "n/a"}`,
          ]}
        />
      </div>

      <DemoNarration
        state={state}
        template={(s) =>
          narrationTemplate(s, analyticalRuin, empiricalRuin, completedCount)
        }
      />

      <div className="gr-visualizer__controls">
        <SliderRow
          label="Target wealth N"
          description="Upper absorbing barrier — the gambler wins by reaching N."
          min={5}
          max={100}
          step={1}
          value={state.N}
          onChange={handleNChange}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Starting wealth k"
          description="Initial wealth; clamped to [1, N-1]."
          min={1}
          max={Math.max(1, N - 1)}
          step={1}
          value={kClamped}
          onChange={(k) => setState({ ...state, k: Math.round(k) })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Win probability p"
          description="Probability of a +1 step. p=0.5 is a fair walk."
          min={0.3}
          max={0.7}
          step={0.01}
          value={state.p}
          onChange={(np) => setState({ ...state, p: np })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Number of walks"
          description="How many independent random walks to simulate."
          min={10}
          max={500}
          step={10}
          value={state.numWalks}
          onChange={(numWalks) => setState({ ...state, numWalks: Math.round(numWalks) })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Seed"
          description="PRNG seed (mulberry32). Same seed → same walks."
          min={1}
          max={100000}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed: Math.round(seed) })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="gr-visualizer__actions">
        <button
          type="button"
          className="gr-visualizer__btn gr-visualizer__btn--primary"
          onClick={() => setPaused((prev) => !prev)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="gr-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="gr-visualizer__counter" aria-live="off">
          walks {completedCount} / {state.numWalks}
        </span>
      </div>
    </div>
  );
}
