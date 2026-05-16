import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type EliminationStep, type SolveResult, solve } from "./algorithm";
import {
  DEFAULT_STATE,
  type GaussianDemoState,
  PRESETS,
  SYSTEM_SLUGS,
  getSystem,
} from "./presets";
import "./GaussianEliminationVisualizer.css";

/**
 * <GaussianEliminationVisualizer> — step-by-step row-operation animation
 * of Gaussian elimination with partial pivoting on a named linear system.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const CELL_W = 60;
const CELL_H = 40;

const STATE_SCHEMA = {
  systemSlug: {
    type: "enum",
    default: DEFAULT_STATE.systemSlug,
    values: SYSTEM_SLUGS,
  },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
} as const satisfies Schema;

const narrationTemplate = (state: GaussianDemoState): string => {
  const sys = getSystem(state.systemSlug);
  const n = sys.A.length;
  const result = solve(sys.A, sys.b);
  const singular = result.singular ? " The system is singular." : "";
  return `Gaussian elimination on the ${sys.name} ${n}x${n} system. ${result.steps.length} row operations (pivot + eliminate) drive the matrix to upper-triangular form.${singular}`;
};

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "NaN";
  if (Math.abs(v) < 1e-10) return "0";
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2);
}

function describeStep(step: EliminationStep): string {
  const { op } = step;
  if (op.kind === "swap") {
    return `Swap R${op.i + 1} \u2194 R${op.j + 1}`;
  }
  if (op.kind === "eliminate") {
    const f = op.factor !== undefined ? formatNumber(op.factor) : "?";
    return `R${op.i + 1} \u2190 R${op.i + 1} \u2212 ${f}\u00b7R${op.j + 1}`;
  }
  return `Scale R${op.i + 1}`;
}

function paintMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: readonly (readonly number[])[],
  rhs: readonly number[],
  highlight: { pivot?: number; modified?: number },
): void {
  const n = matrix.length;
  const cols = n + 1; // +1 for RHS
  const gridW = cols * CELL_W + 20; // 20px gap before RHS
  const gridH = n * CELL_H;
  const originX = (CANVAS_W - gridW) / 2;
  const originY = (CANVAS_H - gridH) / 2 - 30;

  // Highlight rows first (background fill spans the whole row)
  for (let r = 0; r < n; r += 1) {
    let fill: string | null = null;
    if (highlight.pivot === r) fill = "rgba(120, 170, 220, 0.35)";
    if (highlight.modified === r) fill = "rgba(240, 220, 130, 0.55)";
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(originX, originY + r * CELL_H, gridW, CELL_H);
    }
  }

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.font = "16px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111";

  for (let r = 0; r < n; r += 1) {
    const row = matrix[r]!;
    for (let c = 0; c < n; c += 1) {
      const x = originX + c * CELL_W;
      const y = originY + r * CELL_H;
      ctx.strokeRect(x, y, CELL_W, CELL_H);
      ctx.fillStyle = "#111";
      ctx.fillText(formatNumber(row[c]!), x + CELL_W / 2, y + CELL_H / 2);
    }
    // RHS cell
    const rx = originX + n * CELL_W + 20;
    const ry = originY + r * CELL_H;
    ctx.strokeRect(rx, ry, CELL_W, CELL_H);
    ctx.fillStyle = "#111";
    ctx.fillText(formatNumber(rhs[r]!), rx + CELL_W / 2, ry + CELL_H / 2);
  }

  // Augmented bar
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const barX = originX + n * CELL_W + 10;
  ctx.moveTo(barX, originY);
  ctx.lineTo(barX, originY + gridH);
  ctx.stroke();
}

function paintCaption(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.fillStyle = "#222";
  ctx.font = "15px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H - 36);
}

export function GaussianEliminationVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "gaussian-elimination",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const system = useMemo(() => getSystem(state.systemSlug), [state.systemSlug]);
  const result: SolveResult = useMemo(() => solve(system.A, system.b), [system]);
  const totalSteps = result.steps.length;

  const [paused, setPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const accumulatorRef = useRef(0);

  // Reset step counter when system or delay changes.
  useEffect(() => {
    accumulatorRef.current = 0;
    setCurrentStep(0);
  }, [state.systemSlug]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      accumulatorRef.current += deltaMs;
      if (accumulatorRef.current >= state.stepDelay && currentStep < totalSteps - 1) {
        accumulatorRef.current = 0;
        setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      }

      // Pick the matrix/rhs at this step (or the initial state if no steps yet).
      let matrix: readonly (readonly number[])[];
      let rhs: readonly number[];
      let highlight: { pivot?: number; modified?: number } = {};
      let caption = "";

      if (totalSteps === 0) {
        matrix = system.A;
        rhs = system.b;
        caption = result.singular
          ? "Singular system detected — no elimination steps."
          : "System is already upper-triangular.";
      } else {
        const step = result.steps[currentStep]!;
        matrix = step.matrixAfter;
        rhs = step.rhsAfter;
        const op = step.op;
        if (op.kind === "swap") {
          highlight = { pivot: op.i, modified: op.j };
        } else if (op.kind === "eliminate") {
          highlight = { pivot: op.j, modified: op.i };
        }
        caption = describeStep(step);
      }

      paintMatrix(ctx, matrix, rhs, highlight);
      paintCaption(ctx, caption);

      // After last step, show solution.
      if (currentStep >= totalSteps - 1 && totalSteps > 0 && !result.singular) {
        const xStr = result.x.map(formatNumber).join(", ");
        ctx.fillStyle = "#00693e";
        ctx.font = "14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Back-substituted x = [${xStr}]`, CANVAS_W / 2, CANVAS_H - 14);
      } else if (result.singular) {
        ctx.fillStyle = "#cf4f4f";
        ctx.font = "14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Singular: no unique solution.", CANVAS_W / 2, CANVAS_H - 14);
      }
    },
    [state.stepDelay, currentStep, totalSteps, system, result],
  );

  const handleReset = (): void => {
    reset();
    accumulatorRef.current = 0;
    setCurrentStep(0);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const displayStep = totalSteps === 0 ? 1 : currentStep + 1;
  const displayTotal = Math.max(totalSteps, 1);

  return (
    <div className="ge-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Gaussian elimination presets"
      />

      <div className="ge-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Gaussian elimination row-operation animation on the ${system.name} system`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `step ${displayStep} / ${displayTotal}`,
            `singular: ${result.singular ? "yes" : "no"}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ge-visualizer__controls">
        <SliderRow
          label="Step delay"
          description="Milliseconds between row operations. Lower = faster animation."
          min={200}
          max={2000}
          step={100}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0, unit: "ms" }}
        />
      </div>

      <div className="ge-visualizer__actions">
        <button
          type="button"
          className="ge-visualizer__btn ge-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "\u25b6 Resume" : "\u23f8 Pause"}
        </button>
        <button type="button" className="ge-visualizer__btn" onClick={handleReset}>
          {"\u21ba Reset"}
        </button>
        <span className="ge-visualizer__counter" aria-live="off">
          step {displayStep} / {displayTotal}
        </span>
      </div>
    </div>
  );
}
