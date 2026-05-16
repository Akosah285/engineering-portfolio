import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { mulberry32, sampleMeans } from "./algorithm";
import {
  type CltDemoState,
  DEFAULT_STATE,
  DIST_LABELS,
  DIST_SLUGS,
  DISTRIBUTIONS,
  PRESETS,
} from "./presets";
import "./CentralLimitVisualizer.css";

/**
 * <CentralLimitVisualizer> — v4 Discrete & Probability hero demo (#69).
 *
 * Draws `nSamples` sample means of size `n` from a chosen underlying
 * distribution and plots their histogram against the theoretical normal
 * N(μ, σ/√n) predicted by the Central Limit Theorem.  Recomputes on
 * any control change (no animation loop is needed).
 */

const BIN_COUNT = 40;

const STATE_SCHEMA = {
  distSlug: {
    type: "enum",
    default: DEFAULT_STATE.distSlug,
    values: DIST_SLUGS,
  },
  n: { type: "number", default: DEFAULT_STATE.n },
  nSamples: { type: "number", default: DEFAULT_STATE.nSamples },
  seed: { type: "number", default: DEFAULT_STATE.seed },
} as const satisfies Schema;

const narrationTemplate = (state: CltDemoState): string => {
  return `Central Limit Theorem demo: drawing ${state.nSamples} sample means of size n = ${state.n} from a ${DIST_LABELS[state.distSlug]} distribution. As n grows the histogram of sample means approaches a normal curve regardless of the underlying distribution.`;
};

interface ComputedFrame {
  readonly bins: number[];
  readonly binEdges: number[];
  readonly binWidth: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMax: number;
  readonly empiricalMean: number;
  readonly empiricalStd: number;
  readonly theoreticalMean: number;
  readonly theoreticalStd: number;
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-(z * z) / 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function computeFrame(state: CltDemoState): ComputedFrame {
  const distribution = DISTRIBUTIONS[state.distSlug];
  const random = mulberry32(state.seed);
  const result = sampleMeans({
    distribution,
    n: state.n,
    nSamples: state.nSamples,
    random,
  });

  const { means, empiricalMean, empiricalStd, theoreticalMean, theoreticalStd } = result;

  // Fixed range centred on the theoretical mean ±4σ/√n, but widened
  // to also cover the empirical extremes so degenerate cases (n=1 on
  // Bernoulli) still render visibly.
  const sigma = Math.max(theoreticalStd, 1e-6);
  let xMin = theoreticalMean - 4 * sigma;
  let xMax = theoreticalMean + 4 * sigma;
  for (const m of means) {
    if (m < xMin) xMin = m;
    if (m > xMax) xMax = m;
  }
  if (!(xMax > xMin)) {
    xMin = theoreticalMean - 1;
    xMax = theoreticalMean + 1;
  }
  const pad = (xMax - xMin) * 0.02;
  xMin -= pad;
  xMax += pad;

  const binWidth = (xMax - xMin) / BIN_COUNT;
  const bins = new Array<number>(BIN_COUNT).fill(0);
  const binEdges = new Array<number>(BIN_COUNT + 1);
  for (let i = 0; i <= BIN_COUNT; i += 1) {
    binEdges[i] = xMin + i * binWidth;
  }

  for (const m of means) {
    let idx = Math.floor((m - xMin) / binWidth);
    if (idx < 0) idx = 0;
    if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
    bins[idx] = (bins[idx] ?? 0) + 1;
  }

  // Normalise to density (so heights are comparable to the normal pdf).
  const total = means.length;
  const densities = bins.map((c) => c / (total * binWidth));
  const pdfMax = normalPdf(theoreticalMean, theoreticalMean, sigma);
  let yMax = pdfMax;
  for (const d of densities) if (d > yMax) yMax = d;
  yMax *= 1.1;

  return {
    bins: densities,
    binEdges,
    binWidth,
    xMin,
    xMax,
    yMax,
    empiricalMean,
    empiricalStd,
    theoreticalMean,
    theoreticalStd,
  };
}

function paintFrame(ctx: CanvasRenderingContext2D, frame: ComputedFrame): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 8;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xToCanvas = (x: number): number =>
    padL + ((x - frame.xMin) / (frame.xMax - frame.xMin)) * plotW;
  const yToCanvas = (y: number): number => padT + plotH - (y / frame.yMax) * plotH;

  // Histogram bars (filled blue, normalised to density).
  ctx.fillStyle = "rgba(58, 110, 165, 0.7)";
  ctx.strokeStyle = "rgba(58, 110, 165, 1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < frame.bins.length; i += 1) {
    const d = frame.bins[i] ?? 0;
    const x0 = xToCanvas(frame.binEdges[i] ?? frame.xMin);
    const x1 = xToCanvas(frame.binEdges[i + 1] ?? frame.xMax);
    const y0 = yToCanvas(d);
    const yBase = yToCanvas(0);
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0 - 0.5), yBase - y0);
  }

  // Normal curve overlay (red line).
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sigma = Math.max(frame.theoreticalStd, 1e-6);
  const steps = 200;
  for (let i = 0; i <= steps; i += 1) {
    const x = frame.xMin + (i / steps) * (frame.xMax - frame.xMin);
    const y = normalPdf(x, frame.theoreticalMean, sigma);
    const cx = xToCanvas(x);
    const cy = yToCanvas(y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Vertical line at theoretical mean (red dashed).
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const tx = xToCanvas(frame.theoreticalMean);
  ctx.moveTo(tx, padT);
  ctx.lineTo(tx, padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Vertical line at empirical mean (green solid).
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const ex = xToCanvas(frame.empiricalMean);
  ctx.moveTo(ex, padT);
  ctx.lineTo(ex, padT + plotH);
  ctx.stroke();
}

export function CentralLimitVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "central-limit",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const frame = useMemo(() => computeFrame(state), [state]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintFrame(ctx, frame);
    },
    [frame],
  );

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="cl-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Central Limit Theorem presets"
      />

      <div className="cl-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Histogram of ${state.nSamples} sample means of size n = ${state.n} from ${DIST_LABELS[state.distSlug]} with theoretical normal overlay`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\mu = ${frame.theoreticalMean.toFixed(3)}`,
            `\\sigma/\\sqrt{n} = ${frame.theoreticalStd.toFixed(3)}`,
            `\\text{empirical } \\sigma = ${frame.empiricalStd.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div
        className="cl-visualizer__dist-row"
        role="radiogroup"
        aria-label="Underlying distribution"
      >
        <span className="cl-visualizer__dist-label">Distribution</span>
        {DIST_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            role="radio"
            aria-checked={state.distSlug === slug}
            className={
              state.distSlug === slug
                ? "cl-visualizer__btn cl-visualizer__btn--active"
                : "cl-visualizer__btn"
            }
            onClick={() => setState({ ...state, distSlug: slug })}
          >
            {DIST_LABELS[slug]}
          </button>
        ))}
      </div>

      <div className="cl-visualizer__controls">
        <SliderRow
          label="n (sample size)"
          description="How many i.i.d. draws are averaged into each sample mean. CLT predicts the distribution of means approaches normal as n grows."
          min={1}
          max={200}
          step={1}
          value={state.n}
          onChange={(n) => setState({ ...state, n })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Number of samples"
          description="How many sample means are drawn for the histogram. More samples → smoother histogram."
          min={100}
          max={5000}
          step={100}
          value={state.nSamples}
          onChange={(nSamples) => setState({ ...state, nSamples })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Seed"
          description="Seed for the deterministic PRNG so runs are reproducible and shareable."
          min={1}
          max={100000}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="cl-visualizer__actions">
        <button type="button" className="cl-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="cl-visualizer__counter" aria-live="off">
          n = {state.n}, samples = {state.nSamples}
        </span>
      </div>
    </div>
  );
}
