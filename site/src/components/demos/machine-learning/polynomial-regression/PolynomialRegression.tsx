import { useCallback, useMemo, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type Regularization,
  evaluatePolynomial,
  fitPolynomial,
  generateNoisyData,
  meanSquaredError,
  truthFunction,
} from "./algorithm";
import { DEFAULT_STATE, type PolyRegressionState, SAMPLE_PRESETS } from "./presets";
import "./PolynomialRegression.css";

/**
 * <PolynomialRegression> — v1 ML demo #2 (plan §4.1, #25).
 *
 * Scatter plot of noisy data + fitted polynomial curve. Sliders control
 * degree, regularization strength λ (log-scale), noise σ, and sample size n.
 * Three regularization chips toggle between OLS / Ridge / Lasso.
 */

const REG_TYPES = ["none", "ridge", "lasso"] as const;
const X_MIN = -1;
const X_MAX = 1;

const STATE_SCHEMA = {
  degree: { type: "number", default: DEFAULT_STATE.degree },
  lambda: { type: "number", default: DEFAULT_STATE.lambda },
  regularization: {
    type: "enum",
    default: DEFAULT_STATE.regularization,
    values: REG_TYPES,
  },
  noise: { type: "number", default: DEFAULT_STATE.noise },
  seed: { type: "number", default: DEFAULT_STATE.seed },
  n: { type: "number", default: DEFAULT_STATE.n },
} as const satisfies Schema;

const REG_LABEL: Record<PolyRegressionState["regularization"], string> = {
  none: "OLS (no penalty)",
  ridge: "Ridge (L2)",
  lasso: "Lasso (L1)",
};

const narrationTemplate = (s: PolyRegressionState): string => {
  const reg =
    s.regularization === "none"
      ? "no regularization"
      : `${s.regularization === "ridge" ? "Ridge" : "Lasso"} regularization with λ = ${s.lambda.toFixed(3)}`;
  return `Polynomial regression of degree ${s.degree} fitted to ${s.n} noisy samples (σ = ${s.noise.toFixed(2)}) using ${reg}. The orange curve is the underlying truth, the green curve is the model's fit.`;
};

interface AxisScales {
  toX: (px: number) => number;
  toY: (val: number) => number;
  toCanvasX: (val: number) => number;
}

function makeScales(
  width: number,
  height: number,
  yMin: number,
  yMax: number,
): AxisScales {
  const padX = 30;
  const padTop = 16;
  const padBot = 28;
  const xRange = X_MAX - X_MIN;
  const yRange = yMax - yMin || 1;
  return {
    toX: (px: number) => X_MIN + (px - padX) * (xRange / (width - 2 * padX)),
    toCanvasX: (val: number) => padX + ((val - X_MIN) / xRange) * (width - 2 * padX),
    toY: (val: number) =>
      height - padBot - ((val - yMin) / yRange) * (height - padTop - padBot),
  };
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  scales: AxisScales,
  yMin: number,
  yMax: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  // Horizontal gridlines
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    const y = scales.toY(v);
    ctx.beginPath();
    ctx.moveTo(scales.toCanvasX(X_MIN), y);
    ctx.lineTo(scales.toCanvasX(X_MAX), y);
    ctx.stroke();
  }
  // Vertical gridlines
  for (let i = 0; i <= 4; i++) {
    const v = X_MIN + ((X_MAX - X_MIN) * i) / 4;
    const x = scales.toCanvasX(v);
    ctx.beginPath();
    ctx.moveTo(x, scales.toY(yMin));
    ctx.lineTo(x, scales.toY(yMax));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i <= 4; i++) {
    const v = X_MIN + ((X_MAX - X_MIN) * i) / 4;
    ctx.fillText(v.toFixed(1), scales.toCanvasX(v), height - 8);
  }
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    ctx.fillText(v.toFixed(1), scales.toCanvasX(X_MIN) - 4, scales.toY(v) + 4);
  }
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  scales: AxisScales,
  fn: (x: number) => number,
  color: string,
  dashed = false,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const samples = 200;
  for (let i = 0; i <= samples; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / samples;
    const y = fn(x);
    if (!Number.isFinite(y)) continue;
    const cx = scales.toCanvasX(x);
    const cy = scales.toY(y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.restore();
}

function paintScatter(
  ctx: CanvasRenderingContext2D,
  scales: AxisScales,
  xs: readonly number[],
  ys: readonly number[],
): void {
  ctx.fillStyle = "rgba(31, 31, 31, 0.6)";
  for (let i = 0; i < xs.length; i++) {
    const cx = scales.toCanvasX(xs[i]!);
    const cy = scales.toY(ys[i]!);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function PolynomialRegression() {
  const [state, setState, { reset }] = useDemoState(
    "polynomial-regression",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  // Synthesize the dataset deterministically from the seed.
  const data = useMemo(
    () =>
      generateNoisyData({
        seed: Math.round(state.seed),
        n: Math.round(state.n),
        noise: state.noise,
      }),
    [state.seed, state.n, state.noise],
  );

  // Fit the polynomial under the current regularization.
  const reg: Regularization =
    state.regularization === "none"
      ? { type: "none", lambda: 0 }
      : state.regularization === "ridge"
        ? { type: "ridge", lambda: state.lambda }
        : { type: "lasso", lambda: state.lambda };

  // biome-ignore lint/correctness/useExhaustiveDependencies: state.regularization and state.lambda are captured indirectly through the local `reg` object built above; listing both keeps the memo invalidation explicit and surfaces a stable contract
  const coeffs = useMemo(
    () => fitPolynomial(data.xs, data.ys, Math.round(state.degree), reg),
    [data, state.degree, state.regularization, state.lambda],
  );

  const predicted = useMemo(
    () => data.xs.map((x) => evaluatePolynomial(coeffs, x)),
    [coeffs, data.xs],
  );
  const trainMSE = meanSquaredError(predicted, data.ys);

  // Determine y-axis range from data + truth function over [-1, 1]
  const yMin = useMemo(() => {
    let m = Number.POSITIVE_INFINITY;
    for (const y of data.ys) if (y < m) m = y;
    for (let i = 0; i <= 50; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 50;
      const y = truthFunction(x);
      if (y < m) m = y;
    }
    return m - 0.3;
  }, [data]);
  const yMax = useMemo(() => {
    let m = Number.NEGATIVE_INFINITY;
    for (const y of data.ys) if (y > m) m = y;
    for (let i = 0; i <= 50; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 50;
      const y = truthFunction(x);
      if (y > m) m = y;
    }
    return m + 0.3;
  }, [data]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = "#fdfbf6";
      ctx.fillRect(0, 0, width, height);
      const scales = makeScales(width, height, yMin, yMax);
      paintAxes(ctx, scales, yMin, yMax);
      paintCurve(ctx, scales, truthFunction, "#cf6020", true);
      paintCurve(ctx, scales, (x) => evaluatePolynomial(coeffs, x), "#00693e", false);
      paintScatter(ctx, scales, data.xs, data.ys);
    },
    [coeffs, data, yMin, yMax],
  );

  const [paused, setPaused] = useState(false);

  const handleReset = (): void => {
    reset();
  };

  // log-scale slider for lambda: position 0..100 → λ ∈ [1e-4, 1e2]
  const lambdaPos = state.lambda <= 0 ? 0 : ((Math.log10(state.lambda) + 4) / 6) * 100;
  const setLambdaFromPos = (pos: number): void => {
    const lambda = pos === 0 ? 0 : 10 ** ((pos / 100) * 6 - 4);
    setState({ ...state, lambda });
  };

  const nonZero = coeffs.filter((c) => Math.abs(c) > 1e-4).length;

  return (
    <div className="poly-visualizer">
      <PresetCarousel
        presets={SAMPLE_PRESETS as unknown as { name: string; state: typeof state }[]}
        onSelect={(next) => setState(next)}
        ariaLabel="Polynomial regression presets"
      />

      <div className="poly-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Polynomial regression of degree ${Math.round(state.degree)} on ${Math.round(state.n)} noisy samples`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{MSE} = ${trainMSE.toFixed(4)}`,
            `\\text{nonzero coeffs} = ${nonZero}/${coeffs.length}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="poly-visualizer__controls">
        <SliderRow
          label="Polynomial degree"
          description="Higher degree → more flexible curve. Easy to overfit past degree 8."
          min={1}
          max={15}
          step={1}
          value={state.degree}
          onChange={(degree) => setState({ ...state, degree })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Regularization λ (log)"
          description="0 = no penalty. Higher λ shrinks coefficients toward zero."
          min={0}
          max={100}
          step={1}
          value={lambdaPos}
          onChange={setLambdaFromPos}
          format={{
            precision: 4,
            // The slider value isn't lambda — show actual lambda below.
          }}
          disabled={state.regularization === "none"}
        />
        <SliderRow
          label="Noise σ"
          description="How noisy the data is around the truth function."
          min={0}
          max={0.6}
          step={0.01}
          value={state.noise}
          onChange={(noise) => setState({ ...state, noise })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Sample size n"
          description="Number of points sampled from the truth function."
          min={10}
          max={150}
          step={1}
          value={state.n}
          onChange={(n) => setState({ ...state, n })}
          format={{ precision: 0 }}
        />
      </div>

      <fieldset className="poly-visualizer__reg-row">
        <legend>Regularization</legend>
        <div className="poly-visualizer__reg-chips" role="group">
          {REG_TYPES.map((reg) => (
            <button
              key={reg}
              type="button"
              className="poly-visualizer__chip"
              aria-pressed={state.regularization === reg}
              onClick={() => setState({ ...state, regularization: reg })}
            >
              {REG_LABEL[reg]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="poly-visualizer__actions">
        <button
          type="button"
          className="poly-visualizer__btn"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause render"}
        </button>
        <button type="button" className="poly-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="poly-visualizer__counter" aria-live="off">
          λ = {state.lambda < 1e-4 ? "0" : state.lambda.toExponential(2)}
        </span>
      </div>
    </div>
  );
}
