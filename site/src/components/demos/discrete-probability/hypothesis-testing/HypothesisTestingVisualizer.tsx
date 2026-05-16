import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Alternative, decide, oneSampleZ } from "./algorithm";
import {
  ALPHA_SLUGS,
  ALTERNATIVE_SLUGS,
  type AlphaSlug,
  CRITICAL_Z,
  DEFAULT_STATE,
  type HypothesisDemoState,
  PRESETS,
  SCENARIO_SLUGS,
} from "./presets";
import "./HypothesisTestingVisualizer.css";

/**
 * <HypothesisTestingVisualizer> — one-sample Z-test visualiser.
 *
 * Shows the null distribution N(0,1) with the observed z marked, the
 * p-value tail(s) shaded, and the α rejection region indicated.
 */

const STATE_SCHEMA = {
  scenarioSlug: {
    type: "enum",
    default: DEFAULT_STATE.scenarioSlug,
    values: SCENARIO_SLUGS,
  },
  alternative: {
    type: "enum",
    default: DEFAULT_STATE.alternative,
    values: ALTERNATIVE_SLUGS,
  },
  alpha: {
    type: "enum",
    default: DEFAULT_STATE.alpha,
    values: ALPHA_SLUGS,
  },
  xbar: { type: "number", default: DEFAULT_STATE.xbar },
  mu0: { type: "number", default: DEFAULT_STATE.mu0 },
  sigma: { type: "number", default: DEFAULT_STATE.sigma },
  n: { type: "number", default: DEFAULT_STATE.n },
} as const satisfies Schema;

const X_MIN = -4;
const X_MAX = 4;
const PDF_SAMPLES = 200;
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

function pdf(x: number): number {
  return INV_SQRT_2PI * Math.exp(-(x * x) / 2);
}

function xToCanvas(x: number, width: number): number {
  return ((x - X_MIN) / (X_MAX - X_MIN)) * width;
}

function pdfToCanvas(p: number, height: number): number {
  const padTop = 20;
  const padBottom = 28;
  const usable = height - padTop - padBottom;
  const maxP = INV_SQRT_2PI;
  return padTop + usable * (1 - p / maxP);
}

function getCriticalZ(alpha: AlphaSlug, alt: Alternative): number {
  const entry = CRITICAL_Z[alpha];
  return alt === "two-sided" ? entry.twoSided : entry.oneSided;
}

const narrationTemplate = (state: HypothesisDemoState): string => {
  const result = oneSampleZ({
    xbar: state.xbar,
    mu0: state.mu0,
    sigma: state.sigma,
    n: Math.max(1, Math.round(state.n)),
    alternative: state.alternative,
  });
  const alphaNum = Number.parseFloat(state.alpha);
  const decision = decide(result.pValue, alphaNum);
  return (
    `Testing H₀: μ = ${state.mu0.toFixed(2)} vs ${state.alternative} alternative ` +
    `with x̄ = ${state.xbar.toFixed(2)}, σ = ${state.sigma.toFixed(2)}, sample size ${state.n}. ` +
    `Observed z = ${result.z.toFixed(3)}, p = ${result.pValue.toFixed(4)}. ` +
    `At α = ${state.alpha}, ${decision}.`
  );
};

function paintCurve(
  ctx: CanvasRenderingContext2D,
  zObs: number,
  alpha: AlphaSlug,
  alternative: Alternative,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const baselineY = pdfToCanvas(0, height);

  // x-axis
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(width, baselineY);
  ctx.stroke();

  // x-axis tick labels
  ctx.fillStyle = "#555";
  ctx.font = "11px 'Inter Variable', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const tick of [-3, -2, -1, 0, 1, 2, 3]) {
    const cx = xToCanvas(tick, width);
    ctx.beginPath();
    ctx.moveTo(cx, baselineY);
    ctx.lineTo(cx, baselineY + 4);
    ctx.stroke();
    ctx.fillText(String(tick), cx, baselineY + 6);
  }

  const samples: { x: number; cx: number; cy: number }[] = [];
  for (let i = 0; i <= PDF_SAMPLES; i += 1) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / PDF_SAMPLES;
    samples.push({
      x,
      cx: xToCanvas(x, width),
      cy: pdfToCanvas(pdf(x), height),
    });
  }

  // Shade rejection region (α) — light pink, below curve
  const critZ = getCriticalZ(alpha, alternative);
  const inRejection = (x: number): boolean => {
    if (alternative === "two-sided") return Math.abs(x) >= critZ;
    if (alternative === "greater") return x >= critZ;
    return x <= -critZ;
  };
  ctx.fillStyle = "rgba(255, 192, 203, 0.55)";
  fillRegion(ctx, samples, inRejection, baselineY);

  // Shade p-value region — soft red
  const absZ = Math.abs(zObs);
  const inPValue = (x: number): boolean => {
    if (!Number.isFinite(zObs)) return false;
    if (alternative === "two-sided") return Math.abs(x) >= absZ;
    if (alternative === "greater") return x >= zObs;
    return x <= zObs;
  };
  ctx.fillStyle = "rgba(207, 79, 79, 0.45)";
  fillRegion(ctx, samples, inPValue, baselineY);

  // Curve
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, i) => {
    if (i === 0) ctx.moveTo(s.cx, s.cy);
    else ctx.lineTo(s.cx, s.cy);
  });
  ctx.stroke();

  // Critical boundary markers
  ctx.strokeStyle = "rgba(207, 79, 79, 0.9)";
  ctx.lineWidth = 1.5;
  const drawBoundary = (cz: number): void => {
    if (cz < X_MIN || cz > X_MAX) return;
    const cx = xToCanvas(cz, width);
    ctx.beginPath();
    ctx.moveTo(cx, pdfToCanvas(pdf(cz), height));
    ctx.lineTo(cx, baselineY);
    ctx.stroke();
  };
  if (alternative === "two-sided") {
    drawBoundary(critZ);
    drawBoundary(-critZ);
  } else if (alternative === "greater") {
    drawBoundary(critZ);
  } else {
    drawBoundary(-critZ);
  }

  // Observed z line
  if (Number.isFinite(zObs)) {
    const clampedZ = Math.max(X_MIN, Math.min(X_MAX, zObs));
    const cx = xToCanvas(clampedZ, width);
    ctx.strokeStyle = "#1a3a8a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, 8);
    ctx.lineTo(cx, baselineY);
    ctx.stroke();

    ctx.fillStyle = "#1a3a8a";
    ctx.font = "12px 'JetBrains Mono Variable', monospace";
    ctx.textAlign = clampedZ > 0 ? "right" : "left";
    ctx.textBaseline = "top";
    const labelX = clampedZ > 0 ? cx - 4 : cx + 4;
    ctx.fillText(`z = ${zObs.toFixed(2)}`, labelX, 10);
  }
}

function fillRegion(
  ctx: CanvasRenderingContext2D,
  samples: readonly { x: number; cx: number; cy: number }[],
  predicate: (x: number) => boolean,
  baselineY: number,
): void {
  let inside = false;
  let path: { cx: number; cy: number }[] = [];
  const flush = (): void => {
    if (path.length < 2) {
      path = [];
      return;
    }
    ctx.beginPath();
    const first = path[0];
    if (!first) return;
    ctx.moveTo(first.cx, baselineY);
    for (const pt of path) ctx.lineTo(pt.cx, pt.cy);
    const last = path[path.length - 1];
    if (last) ctx.lineTo(last.cx, baselineY);
    ctx.closePath();
    ctx.fill();
    path = [];
  };
  for (const s of samples) {
    if (predicate(s.x)) {
      path.push({ cx: s.cx, cy: s.cy });
      inside = true;
    } else if (inside) {
      flush();
      inside = false;
    }
  }
  if (inside) flush();
}

export function HypothesisTestingVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "hypothesis-testing",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const nInt = Math.max(1, Math.round(state.n));
  const result = useMemo(
    () =>
      oneSampleZ({
        xbar: state.xbar,
        mu0: state.mu0,
        sigma: state.sigma,
        n: nInt,
        alternative: state.alternative,
      }),
    [state.xbar, state.mu0, state.sigma, nInt, state.alternative],
  );
  const alphaNum = Number.parseFloat(state.alpha);
  const decision = decide(result.pValue, alphaNum);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintCurve(ctx, result.z, state.alpha, state.alternative);
    },
    [result.z, state.alpha, state.alternative],
  );

  const handlePresetSelect = (next: HypothesisDemoState): void => {
    setState(next);
  };

  return (
    <div className="ht-visualizer">
      <div className="ht-visualizer__group" aria-label="Hypothesis test scenarios">
        <span className="ht-visualizer__group-label">Scenario</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.state.scenarioSlug}
            type="button"
            className={
              state.scenarioSlug === preset.state.scenarioSlug
                ? "ht-visualizer__btn ht-visualizer__btn--active"
                : "ht-visualizer__btn"
            }
            onClick={() => handlePresetSelect(preset.state)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="ht-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel="Standard normal distribution with observed z-statistic and rejection region"
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `z = ${result.z.toFixed(3)}`,
            `p = ${result.pValue.toFixed(4)}`,
            `\\text{${decision}}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div
        className="ht-visualizer__group"
        role="radiogroup"
        aria-label="Alternative hypothesis"
      >
        <span className="ht-visualizer__group-label">Alternative</span>
        {ALTERNATIVE_SLUGS.map((alt) => (
          <button
            key={alt}
            type="button"
            role="radio"
            aria-checked={state.alternative === alt}
            className={
              state.alternative === alt
                ? "ht-visualizer__btn ht-visualizer__btn--active"
                : "ht-visualizer__btn"
            }
            onClick={() => setState({ ...state, alternative: alt })}
          >
            {alt}
          </button>
        ))}
      </div>

      <div
        className="ht-visualizer__group"
        role="radiogroup"
        aria-label="Significance level α"
      >
        <span className="ht-visualizer__group-label">α</span>
        {ALPHA_SLUGS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={state.alpha === a}
            className={
              state.alpha === a
                ? "ht-visualizer__btn ht-visualizer__btn--active"
                : "ht-visualizer__btn"
            }
            onClick={() => setState({ ...state, alpha: a })}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="ht-visualizer__controls">
        <SliderRow
          label="x̄"
          description="Observed sample mean of the data."
          min={-3}
          max={3}
          step={0.05}
          value={state.xbar}
          onChange={(xbar) => setState({ ...state, xbar })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="μ₀"
          description="Hypothesised population mean under H₀."
          min={-3}
          max={3}
          step={0.05}
          value={state.mu0}
          onChange={(mu0) => setState({ ...state, mu0 })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="σ"
          description="Known population standard deviation."
          min={0.1}
          max={5}
          step={0.1}
          value={state.sigma}
          onChange={(sigma) => setState({ ...state, sigma })}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="n"
          description="Number of observations. Bigger samples → smaller standard error."
          min={1}
          max={200}
          step={1}
          value={state.n}
          onChange={(n) => setState({ ...state, n })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="ht-visualizer__actions">
        <button type="button" className="ht-visualizer__btn" onClick={() => reset()}>
          ↺ Reset
        </button>
        <span className="ht-visualizer__counter" aria-live="off">
          n = {nInt}
        </span>
      </div>
    </div>
  );
}
