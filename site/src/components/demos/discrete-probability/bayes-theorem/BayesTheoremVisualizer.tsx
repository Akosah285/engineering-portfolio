import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { bayesTheorem } from "./algorithm";
import {
  type BayesDemoState,
  DEFAULT_STATE,
  POPULATION_SIZES,
  PRESETS,
  type PopulationSize,
} from "./presets";
import "./BayesTheoremVisualizer.css";

/**
 * <BayesTheoremVisualizer> — disease-test framing of Bayes' theorem (#68).
 *
 * Renders a population dot-grid coloured by category (TP / FN / FP / TN)
 * and three probability bars (prior, P(D|+), P(D|-)). No animation — the
 * canvas recomputes on every state change.
 */

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const GRID_TOP = 0;
const GRID_HEIGHT = 250;
const BARS_TOP = 260;
const BARS_HEIGHT = 100;

const COLOR_TP = "#2f9e44"; // green: has disease + positive
const COLOR_FN = "#f59f00"; // yellow: has disease + negative
const COLOR_FP = "#e03131"; // red: no disease + positive
const COLOR_TN = "#dee2e6"; // light grey: no disease + negative

const STATE_SCHEMA = {
  prior: { type: "number", default: DEFAULT_STATE.prior },
  sensitivity: { type: "number", default: DEFAULT_STATE.sensitivity },
  specificity: { type: "number", default: DEFAULT_STATE.specificity },
  populationSize: {
    type: "enum",
    default: DEFAULT_STATE.populationSize,
    values: POPULATION_SIZES,
  },
} as const satisfies Schema;

function parsePopulationSize(s: PopulationSize): number {
  const n = Number.parseInt(s, 10);
  // POPULATION_SIZES is a closed set of valid integer strings — guard for paranoia.
  if (!Number.isFinite(n) || n <= 0) return 10000;
  return n;
}

const narrationTemplate = (state: BayesDemoState): string => {
  const pop = parsePopulationSize(state.populationSize);
  const result = bayesTheorem({
    prior: state.prior,
    sensitivity: state.sensitivity,
    specificity: state.specificity,
  });
  return `Bayes' theorem on a population of ${pop}: with prior P(D) = ${state.prior.toFixed(
    4,
  )}, sensitivity ${state.sensitivity.toFixed(
    3,
  )}, and specificity ${state.specificity.toFixed(
    3,
  )}, the posterior P(D|+) is ${result.posteriorPositive.toFixed(
    4,
  )}. When the prior is small the posterior after a positive test is often much lower than the test's accuracy suggests.`;
};

interface Counts {
  truePositive: number;
  falseNegative: number;
  falsePositive: number;
  trueNegative: number;
}

function computeCounts(
  pop: number,
  prior: number,
  sensitivity: number,
  specificity: number,
): Counts {
  const diseased = Math.round(pop * prior);
  const healthy = pop - diseased;
  const truePositive = Math.round(diseased * sensitivity);
  const falseNegative = diseased - truePositive;
  const falsePositive = Math.round(healthy * (1 - specificity));
  const trueNegative = healthy - falsePositive;
  return { truePositive, falseNegative, falsePositive, trueNegative };
}

function paintDotGrid(ctx: CanvasRenderingContext2D, counts: Counts, pop: number): void {
  const cols = Math.max(1, Math.ceil(Math.sqrt((pop * CANVAS_WIDTH) / GRID_HEIGHT)));
  const rows = Math.max(1, Math.ceil(pop / cols));
  const cellW = CANVAS_WIDTH / cols;
  const cellH = GRID_HEIGHT / rows;
  const radius = Math.max(1, Math.min(cellW, cellH) * 0.38);

  // Fill order: TP → FN → FP → TN so visualization is deterministic.
  const order: { count: number; color: string }[] = [
    { count: counts.truePositive, color: COLOR_TP },
    { count: counts.falseNegative, color: COLOR_FN },
    { count: counts.falsePositive, color: COLOR_FP },
    { count: counts.trueNegative, color: COLOR_TN },
  ];

  let idx = 0;
  for (const { count, color } of order) {
    if (count <= 0) continue;
    ctx.fillStyle = color;
    for (let i = 0; i < count && idx < pop; i += 1, idx += 1) {
      const r = Math.floor(idx / cols);
      const c = idx - r * cols;
      const cx = c * cellW + cellW / 2;
      const cy = GRID_TOP + r * cellH + cellH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintBars(
  ctx: CanvasRenderingContext2D,
  prior: number,
  posteriorPositive: number,
  posteriorNegative: number,
): void {
  const labelW = 150;
  const valueW = 70;
  const barX = labelW;
  const barMaxW = CANVAS_WIDTH - labelW - valueW - 10;
  const rowH = 26;
  const gap = 8;

  const rows: { label: string; value: number; color: string }[] = [
    { label: "Prior P(D)", value: prior, color: "#495057" },
    { label: "Posterior P(D|+)", value: posteriorPositive, color: COLOR_TP },
    { label: "Posterior P(D|-)", value: posteriorNegative, color: COLOR_FN },
  ];

  ctx.font = "13px 'Inter Variable', sans-serif";
  ctx.textBaseline = "middle";

  rows.forEach((row, i) => {
    const y = BARS_TOP + i * (rowH + gap);
    // Label
    ctx.fillStyle = "#212529";
    ctx.textAlign = "left";
    ctx.fillText(row.label, 8, y + rowH / 2);
    // Bar background
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(barX, y, barMaxW, rowH);
    // Bar fill
    const clamped = Math.max(0, Math.min(1, row.value));
    ctx.fillStyle = row.color;
    ctx.fillRect(barX, y, barMaxW * clamped, rowH);
    // Value
    ctx.fillStyle = "#212529";
    ctx.textAlign = "right";
    ctx.fillText(row.value.toFixed(4), CANVAS_WIDTH - 8, y + rowH / 2);
  });

  // Sanity: ensure bars region uses the constant (silences unused warning).
  void BARS_HEIGHT;
}

export function BayesTheoremVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "bayes-theorem",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const pop = useMemo(
    () => parsePopulationSize(state.populationSize),
    [state.populationSize],
  );

  const result = useMemo(
    () =>
      bayesTheorem({
        prior: state.prior,
        sensitivity: state.sensitivity,
        specificity: state.specificity,
      }),
    [state.prior, state.sensitivity, state.specificity],
  );

  const counts = useMemo(
    () => computeCounts(pop, state.prior, state.sensitivity, state.specificity),
    [pop, state.prior, state.sensitivity, state.specificity],
  );

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      paintDotGrid(ctx, counts, pop);
      paintBars(ctx, state.prior, result.posteriorPositive, result.posteriorNegative);
    },
    [counts, pop, state.prior, result.posteriorPositive, result.posteriorNegative],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: BayesDemoState): void => {
    setState(next);
  };

  const setPopulationSize = (size: PopulationSize): void => {
    setState({ ...state, populationSize: size });
  };

  return (
    <div className="bt-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: BayesDemoState }[] as {
            name: string;
            state: BayesDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Bayes theorem presets"
      />

      <div className="bt-visualizer__stage">
        <DemoCanvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          ariaLabel={`Bayes theorem dot grid for a population of ${pop}`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `P(D|+) = ${result.posteriorPositive.toFixed(4)}`,
            `P(D|-) = ${result.posteriorNegative.toFixed(4)}`,
          ]}
        />
      </div>

      <div className="bt-visualizer__legend" aria-hidden="true">
        <span className="bt-visualizer__legend-item">
          <span
            className="bt-visualizer__legend-swatch"
            style={{ background: COLOR_TP }}
          />
          True positive ({counts.truePositive})
        </span>
        <span className="bt-visualizer__legend-item">
          <span
            className="bt-visualizer__legend-swatch"
            style={{ background: COLOR_FN }}
          />
          False negative ({counts.falseNegative})
        </span>
        <span className="bt-visualizer__legend-item">
          <span
            className="bt-visualizer__legend-swatch"
            style={{ background: COLOR_FP }}
          />
          False positive ({counts.falsePositive})
        </span>
        <span className="bt-visualizer__legend-item">
          <span
            className="bt-visualizer__legend-swatch"
            style={{ background: COLOR_TN }}
          />
          True negative ({counts.trueNegative})
        </span>
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="bt-visualizer__controls">
        <SliderRow
          label="Prior P(D)"
          description="Base rate of the condition in the population before testing."
          min={0}
          max={1}
          step={0.001}
          value={state.prior}
          onChange={(prior) => setState({ ...state, prior })}
          format={{ precision: 4 }}
        />
        <SliderRow
          label="Sensitivity P(+|D)"
          description="Probability the test is positive given the person has the condition."
          min={0}
          max={1}
          step={0.001}
          value={state.sensitivity}
          onChange={(sensitivity) => setState({ ...state, sensitivity })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Specificity P(-|¬D)"
          description="Probability the test is negative given the person does not have the condition."
          min={0}
          max={1}
          step={0.001}
          value={state.specificity}
          onChange={(specificity) => setState({ ...state, specificity })}
          format={{ precision: 3 }}
        />
      </div>

      <div className="bt-visualizer__popsize" role="group" aria-label="Population size">
        <span className="bt-visualizer__popsize-label">Population:</span>
        {POPULATION_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={
              state.populationSize === size
                ? "bt-visualizer__popsize-btn bt-visualizer__popsize-btn--active"
                : "bt-visualizer__popsize-btn"
            }
            aria-pressed={state.populationSize === size}
            onClick={() => setPopulationSize(size)}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="bt-visualizer__actions">
        <button type="button" className="bt-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="bt-visualizer__counter" aria-live="off">
          pop = {pop}
        </span>
      </div>
    </div>
  );
}
