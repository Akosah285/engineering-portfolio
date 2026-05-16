import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { linearFit, predict } from "./algorithm";
import {
  DEFAULT_STATE,
  type LeastSquaresDemoState,
  PRESETS,
  PRESET_META,
  PRESET_SLUGS,
  generateDataset,
} from "./presets";
import "./LeastSquaresVisualizer.css";

/**
 * <LeastSquaresVisualizer> — scatter + fitted line for the closed-form
 * linear regression brain (#84). The dataset is regenerated deterministically
 * from (preset, noise, n) on every state change; `linearFit` is recomputed
 * via `useMemo` and overlaid on the canvas alongside residual segments.
 */

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: PRESET_SLUGS,
  },
  noise: { type: "number", default: DEFAULT_STATE.noise },
  n: { type: "number", default: DEFAULT_STATE.n },
} as const satisfies Schema;

interface PaintCtx {
  readonly xs: ReadonlyArray<number>;
  readonly ys: ReadonlyArray<number>;
  readonly slope: number;
  readonly intercept: number;
  readonly trueSlope: number;
  readonly trueIntercept: number;
}

/** Compute a padded bounding box covering points + fitted + true line. */
function computeBounds(p: PaintCtx) {
  const xMin = Math.min(...p.xs);
  const xMax = Math.max(...p.xs);
  const fitYAtMin = p.slope * xMin + p.intercept;
  const fitYAtMax = p.slope * xMax + p.intercept;
  const trueYAtMin = p.trueSlope * xMin + p.trueIntercept;
  const trueYAtMax = p.trueSlope * xMax + p.trueIntercept;
  const ysAll = [...p.ys, fitYAtMin, fitYAtMax, trueYAtMin, trueYAtMax];
  const yMin = Math.min(...ysAll);
  const yMax = Math.max(...ysAll);
  const padX = (xMax - xMin) * 0.05 || 1;
  const padY = (yMax - yMin) * 0.05 || 1;
  return {
    xMin: xMin - padX,
    xMax: xMax + padX,
    yMin: yMin - padY,
    yMax: yMax + padY,
  };
}

function paintScene(ctx: CanvasRenderingContext2D, p: PaintCtx): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const { xMin, xMax, yMin, yMax } = computeBounds(p);
  const sx = width / (xMax - xMin);
  const sy = height / (yMax - yMin);
  const toCanvas = (x: number, y: number): readonly [number, number] => [
    (x - xMin) * sx,
    height - (y - yMin) * sy,
  ];

  // Axes (only draw when 0 falls inside bounds; otherwise skip).
  ctx.strokeStyle = "rgba(150, 150, 150, 0.4)";
  ctx.lineWidth = 1;
  if (yMin <= 0 && yMax >= 0) {
    const [, y0] = toCanvas(xMin, 0);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(width, y0);
    ctx.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    const [x0] = toCanvas(0, yMin);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, height);
    ctx.stroke();
  }

  // Residual segments — thin gray verticals from each point to the line.
  ctx.strokeStyle = "rgba(120, 120, 120, 0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < p.xs.length; i += 1) {
    const x = p.xs[i]!;
    const y = p.ys[i]!;
    const yHat = p.slope * x + p.intercept;
    const [cx, cy] = toCanvas(x, y);
    const [, cyHat] = toCanvas(x, yHat);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cyHat);
    ctx.stroke();
  }

  // Ghost the "true" line as a dashed faded line for ground-truth comparison.
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(70, 70, 70, 0.35)";
  ctx.lineWidth = 1;
  {
    const [x0, y0] = toCanvas(xMin, p.trueSlope * xMin + p.trueIntercept);
    const [x1, y1] = toCanvas(xMax, p.trueSlope * xMax + p.trueIntercept);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();

  // Fitted line (crimson, 2 px).
  ctx.strokeStyle = "crimson";
  ctx.lineWidth = 2;
  {
    const leftX = Math.min(...p.xs);
    const rightX = Math.max(...p.xs);
    const [x0, y0] = toCanvas(leftX, p.slope * leftX + p.intercept);
    const [x1, y1] = toCanvas(rightX, p.slope * rightX + p.intercept);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Scatter points on top.
  ctx.fillStyle = "steelblue";
  for (let i = 0; i < p.xs.length; i += 1) {
    const [cx, cy] = toCanvas(p.xs[i]!, p.ys[i]!);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function narrationTemplate(state: LeastSquaresDemoState): string {
  const meta = PRESET_META[state.presetSlug];
  const { xs, ys } = generateDataset(state.presetSlug, state.noise, state.n);
  const fit = linearFit({ xs, ys });
  const r2Display = Number.isNaN(fit.r2) ? "n/a" : fit.r2.toFixed(3);
  return (
    `Fitting y = mx + b to ${state.n} points from preset "${meta.label}" using closed-form normal equations. ` +
    `Estimated slope ${fit.slope.toFixed(3)} vs true ${meta.trueSlope.toFixed(2)}. R² = ${r2Display}.`
  );
}

export function LeastSquaresVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "least-squares",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const meta = PRESET_META[state.presetSlug];

  const { xs, ys } = useMemo(
    () => generateDataset(state.presetSlug, state.noise, state.n),
    [state.presetSlug, state.noise, state.n],
  );

  const fit = useMemo(() => linearFit({ xs, ys }), [xs, ys]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintScene(ctx, {
        xs,
        ys,
        slope: fit.slope,
        intercept: fit.intercept,
        trueSlope: meta.trueSlope,
        trueIntercept: meta.trueIntercept,
      });
    },
    [xs, ys, fit.slope, fit.intercept, meta.trueSlope, meta.trueIntercept],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: LeastSquaresDemoState): void => {
    setState(next);
  };

  const handleApplyPreset = (): void => {
    setState({
      presetSlug: state.presetSlug,
      n: DEFAULT_STATE.n,
      noise: meta.baseNoise,
    });
  };

  // Demonstrate the predict() helper by sampling the fit at the dataset midpoint.
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midYHat = predict(fit, midX);

  return (
    <div className="ls-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: LeastSquaresDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Least squares dataset presets"
      />

      <div className="ls-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Scatter plot of ${state.n} points from the ${meta.label.toLowerCase()} preset with the least-squares fitted line overlaid`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{slope } m = ${fit.slope.toFixed(3)}`,
            `\\text{intercept } b = ${fit.intercept.toFixed(3)}`,
            `R^2 = ${Number.isNaN(fit.r2) ? "\\text{n/a}" : fit.r2.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ls-visualizer__controls">
        <SliderRow
          label="Noise"
          description="Standard deviation of Gaussian noise added to each true y value."
          min={0}
          max={2}
          step={0.05}
          value={state.noise}
          onChange={(noise) => setState({ ...state, noise })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="N points"
          description="How many sample points to draw from the true line."
          min={8}
          max={80}
          step={4}
          value={state.n}
          onChange={(n) => setState({ ...state, n })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="ls-visualizer__actions">
        <button type="button" className="ls-visualizer__btn" onClick={handleApplyPreset}>
          Apply {meta.label} preset defaults
        </button>
        <button type="button" className="ls-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="ls-visualizer__counter" aria-live="off">
          n = {state.n} points (ŷ at x={midX.toFixed(1)} = {midYHat.toFixed(2)})
        </span>
      </div>
    </div>
  );
}
