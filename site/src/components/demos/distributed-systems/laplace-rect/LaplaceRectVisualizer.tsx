import { useEffect, useMemo, useRef } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type LaplaceResult, solve } from "./algorithm";
import { DEFAULT_STATE, type LaplaceRectDemoState, PRESETS } from "./presets";
import "./LaplaceRectVisualizer.css";

/**
 * <LaplaceRectVisualizer> — heatmap of the steady-state solution to
 * Laplace's equation on a rectangle with Dirichlet boundary conditions.
 *
 * The solver runs synchronously (SOR converges in ~hundreds of
 * iterations for the grid sizes we expose) so we just re-`solve()`
 * whenever any control changes and paint the result into a canvas.
 */

const CANVAS_W = 480;
const CANVAS_H = 360;

const STATE_SCHEMA = {
  nGrid: { type: "number", default: DEFAULT_STATE.nGrid },
  top: { type: "number", default: DEFAULT_STATE.top },
  bottom: { type: "number", default: DEFAULT_STATE.bottom },
  left: { type: "number", default: DEFAULT_STATE.left },
  right: { type: "number", default: DEFAULT_STATE.right },
  omega: { type: "number", default: DEFAULT_STATE.omega },
} as const satisfies Schema;

/** Blue → white → red diverging colour ramp on t ∈ [0, 1]. */
function ramp(t: number): readonly [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.5) {
    const k = clamped * 2;
    return [
      Math.round(40 + (245 - 40) * k),
      Math.round(80 + (245 - 80) * k),
      Math.round(200 + (245 - 200) * k),
    ];
  }
  const k = (clamped - 0.5) * 2;
  return [
    Math.round(245 + (200 - 245) * k),
    Math.round(245 + (40 - 245) * k),
    Math.round(245 + (40 - 245) * k),
  ];
}

function paintHeatmap(
  ctx: CanvasRenderingContext2D,
  result: LaplaceResult,
  state: LaplaceRectDemoState,
): void {
  const { width, height } = ctx.canvas;
  const u = result.u;
  const ny = u.length;
  const nx = u[0]?.length ?? 0;
  if (nx === 0 || ny === 0) return;

  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < ny; i += 1) {
    for (let j = 0; j < nx; j += 1) {
      const v = u[i]![j]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const range = hi - lo || 1;

  // Bilinear-ish interpolation by sampling at pixel level.
  const img = ctx.createImageData(width, height);
  for (let py = 0; py < height; py += 1) {
    const fy = (py / (height - 1)) * (ny - 1);
    const i0 = Math.floor(fy);
    const i1 = Math.min(ny - 1, i0 + 1);
    const ty = fy - i0;
    for (let px = 0; px < width; px += 1) {
      const fx = (px / (width - 1)) * (nx - 1);
      const j0 = Math.floor(fx);
      const j1 = Math.min(nx - 1, j0 + 1);
      const tx = fx - j0;
      const v00 = u[i0]![j0]!;
      const v01 = u[i0]![j1]!;
      const v10 = u[i1]![j0]!;
      const v11 = u[i1]![j1]!;
      const v0 = v00 * (1 - tx) + v01 * tx;
      const v1 = v10 * (1 - tx) + v11 * tx;
      const v = v0 * (1 - ty) + v1 * ty;
      const [r, g, b] = ramp((v - lo) / range);
      const idx = (py * width + px) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Equipotential isolines every 10% of range (marching-squares lite:
  // for each cell, if the target value lies between min/max of the
  // four corners, stamp a pixel at the cell centre — cheap and reads
  // as a contour at the grid scale).
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  const cellW = width / (nx - 1);
  const cellH = height / (ny - 1);
  for (let step = 1; step < 10; step += 1) {
    const target = lo + (range * step) / 10;
    for (let i = 0; i < ny - 1; i += 1) {
      for (let j = 0; j < nx - 1; j += 1) {
        const a = u[i]![j]!;
        const b = u[i]![j + 1]!;
        const c = u[i + 1]![j]!;
        const d = u[i + 1]![j + 1]!;
        const mn = Math.min(a, b, c, d);
        const mx = Math.max(a, b, c, d);
        if (mn <= target && target <= mx) {
          const cx = (j + 0.5) * cellW;
          const cy = (i + 0.5) * cellH;
          ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
        }
      }
    }
  }

  // Boundary labels.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 3;
  ctx.font = "600 12px 'JetBrains Mono Variable', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labels: ReadonlyArray<readonly [string, number, number]> = [
    [`top = ${state.top}`, width / 2, 12],
    [`bottom = ${state.bottom}`, width / 2, height - 12],
    [`left = ${state.left}`, 36, height / 2],
    [`right = ${state.right}`, width - 36, height / 2],
  ];
  for (const [text, x, y] of labels) {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
}

export function LaplaceRectVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "laplace-rect",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const result = useMemo<LaplaceResult>(
    () =>
      solve({
        nx: state.nGrid,
        ny: state.nGrid,
        top: state.top,
        bottom: state.bottom,
        left: state.left,
        right: state.right,
        omega: state.omega,
      }),
    [state.nGrid, state.top, state.bottom, state.left, state.right, state.omega],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintHeatmap(ctx, result, state);
  }, [result, state]);

  const handlePresetSelect = (next: LaplaceRectDemoState): void => {
    setState(next);
  };

  return (
    <div className="lp-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: LaplaceRectDemoState }[] as {
            name: string;
            state: LaplaceRectDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Laplace boundary presets"
      />

      <div className="lp-visualizer__stage">
        <canvas
          ref={canvasRef}
          className="lp-visualizer__canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          aria-label="Heatmap of the Laplace solution on the rectangle"
        />
      </div>

      <div className="lp-visualizer__hud" aria-live="polite">
        <span>iterations: {result.iterations}</span>
        <span>converged: {result.converged ? "✓" : "✗"}</span>
        <span>residual: {result.finalResidual.toExponential(2)}</span>
        <span>ω: {state.omega.toFixed(2)}</span>
      </div>

      <div className="lp-visualizer__controls">
        <SliderRow
          label="nGrid"
          description="Grid resolution (used for both nx and ny)."
          min={10}
          max={60}
          step={5}
          value={state.nGrid}
          onChange={(nGrid) => setState({ ...state, nGrid })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="ω (omega, SOR factor)"
          description="Successive over-relaxation: 1 = Gauss-Seidel; ≈1.7 often fastest."
          min={1.0}
          max={1.9}
          step={0.05}
          value={state.omega}
          onChange={(omega) => setState({ ...state, omega })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="top (boundary)"
          min={-100}
          max={100}
          step={5}
          value={state.top}
          onChange={(top) => setState({ ...state, top })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="bottom (boundary)"
          min={-100}
          max={100}
          step={5}
          value={state.bottom}
          onChange={(bottom) => setState({ ...state, bottom })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="left (boundary)"
          min={-100}
          max={100}
          step={5}
          value={state.left}
          onChange={(left) => setState({ ...state, left })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="right (boundary)"
          min={-100}
          max={100}
          step={5}
          value={state.right}
          onChange={(right) => setState({ ...state, right })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="lp-visualizer__actions">
        <button type="button" className="lp-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="lp-visualizer__counter" aria-live="off">
          iter {result.iterations} · residual {result.finalResidual.toExponential(2)} ·{" "}
          {result.converged ? "converged ✓" : "converged ✗"}
        </span>
      </div>
    </div>
  );
}

export default LaplaceRectVisualizer;
