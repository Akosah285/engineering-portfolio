import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { decompose, determinantFromLU, solveWithLU } from "./algorithm";
import {
  DEFAULT_STATE,
  type LuDemoState,
  MATRIX_SLUGS,
  PRESET_META,
  PRESETS,
} from "./presets";
import "./LuDecompositionVisualizer.css";

/**
 * <LuDecompositionVisualizer> — three-panel A / L / U display with
 * pivot highlights and an Ax = b solver overlay.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const PANEL_W = 200;
const PANEL_H = 300;
const PANEL_GAP = 20;
const CELL_SIZE = 60;
const FAINT_THRESHOLD = 1e-9;

const STATE_SCHEMA = {
  matrixSlug: {
    type: "enum",
    default: DEFAULT_STATE.matrixSlug,
    values: MATRIX_SLUGS,
  },
  b0: { type: "number", default: DEFAULT_STATE.b0 },
  b1: { type: "number", default: DEFAULT_STATE.b1 },
  b2: { type: "number", default: DEFAULT_STATE.b2 },
} as const satisfies Schema;

function formatCell(v: number): string {
  if (!Number.isFinite(v)) return "NaN";
  if (Math.abs(v) < FAINT_THRESHOLD) return "0.00";
  return v.toFixed(2);
}

function paintPanel(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  title: string,
  M: readonly (readonly number[])[],
  options: {
    diagonalHighlight?: "pivot" | "unit";
    perm?: readonly number[];
  } = {},
): void {
  ctx.fillStyle = "#222";
  ctx.font = "16px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, originX + (3 * CELL_SIZE) / 2, originY + 14);

  const gridX = originX;
  const gridY = originY + 30;

  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const x = gridX + c * CELL_SIZE;
      const y = gridY + r * CELL_SIZE;
      const value = M[r]?.[c] ?? 0;
      const isDiag = r === c;

      // Background highlight on diagonal
      if (isDiag && options.diagonalHighlight === "pivot") {
        ctx.fillStyle = "rgba(120, 170, 220, 0.35)";
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      } else if (isDiag && options.diagonalHighlight === "unit") {
        ctx.fillStyle = "rgba(200, 200, 200, 0.35)";
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

      const faint = Math.abs(value) < FAINT_THRESHOLD;
      ctx.fillStyle = faint ? "#bbb" : "#111";
      ctx.font = "14px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatCell(value), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    }
  }

  // Row swap indicators for A (perm[i] = original row now at i)
  if (options.perm) {
    ctx.fillStyle = "#cf4f4f";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 3; i += 1) {
      const src = options.perm[i] ?? i;
      const y = gridY + i * CELL_SIZE + CELL_SIZE / 2;
      const label = src === i ? `${i + 1}` : `${src + 1}\u2192${i + 1}`;
      ctx.fillStyle = src === i ? "#999" : "#cf4f4f";
      ctx.fillText(label, gridX - 4, y);
    }
  }
}

const narrationTemplate = (state: LuDemoState): string => {
  const meta = PRESET_META[state.matrixSlug];
  const lu = decompose(meta.A);
  const det = determinantFromLU(lu);
  const x = solveWithLU({ lu, b: [state.b0, state.b1, state.b2] });
  const head = `LU decomposition of "${meta.label}". det(A) = ${det.toFixed(3)}, ${lu.singular ? "singular \u2014 no unique solution" : "factored cleanly"}.`;
  if (lu.singular) return head;
  const xs = x.every((v) => Number.isFinite(v))
    ? `(${x[0]!.toFixed(2)}, ${x[1]!.toFixed(2)}, ${x[2]!.toFixed(2)})`
    : "\u2014";
  return `${head} For b = (${state.b0}, ${state.b1}, ${state.b2}), x = ${xs}.`;
};

export function LuDecompositionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "lu-decomposition",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const meta = useMemo(() => PRESET_META[state.matrixSlug], [state.matrixSlug]);
  const lu = useMemo(() => decompose(meta.A), [meta]);
  const det = useMemo(() => determinantFromLU(lu), [lu]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const totalW = 3 * PANEL_W + 2 * PANEL_GAP;
      const startX = (CANVAS_W - totalW) / 2;
      const startY = (CANVAS_H - PANEL_H) / 2;

      paintPanel(ctx, startX, startY, "A", meta.A, { perm: lu.perm });
      paintPanel(ctx, startX + PANEL_W + PANEL_GAP, startY, "L", lu.L, {
        diagonalHighlight: "unit",
      });
      paintPanel(
        ctx,
        startX + 2 * (PANEL_W + PANEL_GAP),
        startY,
        "U",
        lu.U,
        { diagonalHighlight: "pivot" },
      );
    },
    [meta, lu],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="lu-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="LU decomposition presets"
      />

      <div className="lu-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`LU decomposition of the ${meta.label} matrix`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\det(A) = ${det.toFixed(3)}`,
            `\\text{singular: ${lu.singular ? "yes" : "no"}}`,
            `\\text{sign: ${lu.sign === 1 ? "+1" : "-1"}}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="lu-visualizer__controls">
        <SliderRow
          label="b0"
          min={-10}
          max={10}
          step={0.5}
          value={state.b0}
          onChange={(b0) => setState({ ...state, b0 })}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="b1"
          min={-10}
          max={10}
          step={0.5}
          value={state.b1}
          onChange={(b1) => setState({ ...state, b1 })}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="b2"
          min={-10}
          max={10}
          step={0.5}
          value={state.b2}
          onChange={(b2) => setState({ ...state, b2 })}
          format={{ precision: 1 }}
        />
      </div>

      <div className="lu-visualizer__actions">
        <button type="button" className="lu-visualizer__btn" onClick={handleReset}>
          {"\u21ba Reset"}
        </button>
        <div className="lu-visualizer__counter" aria-live="off">
          det(A) = {det.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
