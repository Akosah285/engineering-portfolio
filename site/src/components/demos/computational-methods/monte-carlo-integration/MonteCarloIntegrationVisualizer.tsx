import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { mulberry32 } from "../../discrete-probability/monte-carlo-pi/algorithm";
import { integrate1D } from "./algorithm";
import {
  DEFAULT_STATE,
  INTEGRAND_SLUGS,
  type MCIntegrationDemoState,
  PRESETS,
  getIntegrand,
} from "./presets";
import "./MonteCarloIntegrationVisualizer.css";

/**
 * <MonteCarloIntegrationVisualizer> — visualises 1D Monte Carlo integration.
 *
 * Draws f(x) on [a, b], scatters the random sample x-values as thin vertical
 * stems up to f(x_i), and reports the running estimate and 95% confidence
 * interval against the known exact value.
 */

const STATE_SCHEMA = {
  integrandSlug: {
    type: "enum",
    default: DEFAULT_STATE.integrandSlug,
    values: INTEGRAND_SLUGS,
  },
  nSamples: { type: "number", default: DEFAULT_STATE.nSamples },
  seed: { type: "number", default: DEFAULT_STATE.seed },
} as const satisfies Schema;

const CURVE_SAMPLES = 400;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

const narrationTemplate = (state: MCIntegrationDemoState): string => {
  const integrand = getIntegrand(state.integrandSlug);
  return `Monte Carlo integration of ${integrand.name} on [${integrand.a.toFixed(2)}, ${integrand.b.toFixed(2)}] using ${state.nSamples} random samples. The exact integral equals ${integrand.exact.toFixed(4)}; each estimate averages f(x) over uniformly drawn x_i.`;
};

interface ComputedRun {
  readonly xs: readonly number[];
  readonly fs: readonly number[];
  readonly estimate: number;
  readonly ci95HalfWidth: number;
  readonly yMax: number;
  readonly yMin: number;
}

function computeRun(
  integrandSlug: MCIntegrationDemoState["integrandSlug"],
  nSamples: number,
  seed: number,
): ComputedRun {
  const integrand = getIntegrand(integrandSlug);
  const rng = mulberry32(seed);
  const xs: number[] = new Array(nSamples);
  const fs: number[] = new Array(nSamples);
  const w = integrand.b - integrand.a;
  for (let i = 0; i < nSamples; i += 1) {
    const x = integrand.a + w * rng();
    xs[i] = x;
    fs[i] = integrand.f(x);
  }

  // Recompute the estimate deterministically with the same seed so the
  // displayed result matches the painted sample positions.
  const result = integrate1D({
    f: integrand.f,
    a: integrand.a,
    b: integrand.b,
    n: nSamples,
    rng: mulberry32(seed),
  });

  // Determine y-range from the analytic curve + samples.
  let yMin = 0;
  let yMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const x = integrand.a + (i / CURVE_SAMPLES) * w;
    const y = integrand.f(x);
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  if (yMax === Number.NEGATIVE_INFINITY) yMax = 1;
  if (yMax <= yMin) yMax = yMin + 1;
  yMax *= 1.2;

  return {
    xs,
    fs,
    estimate: result.estimate,
    ci95HalfWidth: result.ci95HalfWidth,
    yMax,
    yMin,
  };
}

function paintScene(
  ctx: CanvasRenderingContext2D,
  integrandSlug: MCIntegrationDemoState["integrandSlug"],
  run: ComputedRun,
  nSamples: number,
): void {
  const { width, height } = ctx.canvas;
  const integrand = getIntegrand(integrandSlug);

  // Clear background
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, width, height);

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const xToPx = (x: number): number =>
    PAD_LEFT + ((x - integrand.a) / (integrand.b - integrand.a)) * plotW;
  const yToPx = (y: number): number =>
    PAD_TOP + plotH - ((y - run.yMin) / (run.yMax - run.yMin)) * plotH;

  // Axes
  ctx.strokeStyle = "#c8c8c0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, yToPx(0));
  ctx.lineTo(PAD_LEFT + plotW, yToPx(0));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, PAD_TOP);
  ctx.lineTo(PAD_LEFT, PAD_TOP + plotH);
  ctx.stroke();

  // MC sample stems
  ctx.strokeStyle = "rgba(0, 105, 62, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < run.xs.length; i += 1) {
    const cx = xToPx(run.xs[i]!);
    const cy0 = yToPx(0);
    const cy1 = yToPx(run.fs[i]!);
    ctx.moveTo(cx, cy0);
    ctx.lineTo(cx, cy1);
  }
  ctx.stroke();

  // Dots at (x_i, f(x_i))
  ctx.fillStyle = "rgba(0, 105, 62, 0.55)";
  for (let i = 0; i < run.xs.length; i += 1) {
    const cx = xToPx(run.xs[i]!);
    const cy = yToPx(run.fs[i]!);
    ctx.fillRect(cx - 0.75, cy - 0.75, 1.5, 1.5);
  }

  // f(x) curve
  ctx.strokeStyle = "#0b3d2e";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const x = integrand.a + (i / CURVE_SAMPLES) * (integrand.b - integrand.a);
    const y = integrand.f(x);
    const cx = xToPx(x);
    const cy = yToPx(y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Annotations
  ctx.fillStyle = "#222";
  ctx.font = "12px 'JetBrains Mono Variable', monospace";
  ctx.textBaseline = "top";
  const lines = [
    `n = ${nSamples}`,
    `estimate = ${run.estimate.toFixed(4)}`,
    `exact = ${integrand.exact.toFixed(4)}`,
    `CI95 = ±${run.ci95HalfWidth.toFixed(4)}`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, PAD_LEFT + 6, PAD_TOP + 4 + i * 14);
  });
}

export function MonteCarloIntegrationVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "monte-carlo-integration",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const run = useMemo(
    () => computeRun(state.integrandSlug, state.nSamples, state.seed),
    [state.integrandSlug, state.nSamples, state.seed],
  );

  const integrand = getIntegrand(state.integrandSlug);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintScene(ctx, state.integrandSlug, run, state.nSamples);
    },
    [state.integrandSlug, state.nSamples, run],
  );

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="mi-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly {
            name: string;
            state: typeof DEFAULT_STATE;
          }[] as { name: string; state: typeof state }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Monte Carlo integration presets"
      />

      <div className="mi-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Monte Carlo integration of ${integrand.name} on [${integrand.a}, ${integrand.b}]`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `n = ${state.nSamples}`,
            `\\hat{I} = ${run.estimate.toFixed(4)}`,
            `I = ${integrand.exact.toFixed(4)}`,
            `\\pm ${run.ci95HalfWidth.toFixed(4)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="mi-visualizer__controls">
        <SliderRow
          label="n samples"
          description="Number of uniformly random x_i drawn from [a, b]."
          min={10}
          max={5000}
          step={10}
          value={state.nSamples}
          onChange={(nSamples) => setState({ ...state, nSamples })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="seed"
          description="Deterministic PRNG seed — same seed reproduces the same samples."
          min={1}
          max={100000}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="mi-visualizer__actions">
        <button type="button" className="mi-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="mi-visualizer__counter" aria-live="off">
          n = {state.nSamples}
        </span>
      </div>
    </div>
  );
}
