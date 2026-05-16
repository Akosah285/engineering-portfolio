import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { buildNaturalSpline, evalSpline, lagrange } from "./algorithm";
import {
  DEFAULT_STATE,
  type LagrangeSplineDemoState,
  NODE_SET_SLUGS,
  PRESETS,
  getNodeSet,
} from "./presets";
import "./LagrangeSplineVisualizer.css";

/**
 * <LagrangeSplineVisualizer> — side-by-side comparison of the Lagrange
 * interpolating polynomial and the natural cubic spline on the same node
 * set. Illustrates Runge's phenomenon (oscillation at the endpoints) for
 * equispaced Lagrange and how Chebyshev nodes / splines tame it.
 */

const YES_NO = ["yes", "no"] as const;
const SAMPLE_COUNT = 300;
/** Clamp Lagrange plot range — the polynomial can blow up near endpoints. */
const LAGRANGE_PLOT_THRESHOLD = 100;

const STATE_SCHEMA = {
  nodeSetSlug: {
    type: "enum",
    default: DEFAULT_STATE.nodeSetSlug,
    values: NODE_SET_SLUGS,
  },
  showLagrange: {
    type: "enum",
    default: DEFAULT_STATE.showLagrange,
    values: YES_NO,
  },
  showSpline: {
    type: "enum",
    default: DEFAULT_STATE.showSpline,
    values: YES_NO,
  },
  showOriginal: {
    type: "enum",
    default: DEFAULT_STATE.showOriginal,
    values: YES_NO,
  },
} as const satisfies Schema;

const narrationTemplate = (state: LagrangeSplineDemoState): string => {
  const set = getNodeSet(state.nodeSetSlug);
  const which: string[] = [];
  if (state.showLagrange === "yes") which.push("Lagrange polynomial");
  if (state.showSpline === "yes") which.push("natural cubic spline");
  const curves = which.length > 0 ? which.join(" and ") : "no curves";
  return `Interpolating ${set.name.toLowerCase()} through ${set.nodes.length} nodes with ${curves}.`;
};

interface PlotBounds {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

function computeBounds(
  nodes: readonly { x: number; y: number }[],
  domain: readonly [number, number],
  splineSamples: readonly number[],
): PlotBounds {
  const xMin = domain[0];
  const xMax = domain[1];
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const p of nodes) {
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  for (const v of splineSamples) {
    if (Number.isFinite(v)) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) {
    yMin = -1;
    yMax = 1;
  }
  const pad = (yMax - yMin) * 0.15;
  return { xMin, xMax, yMin: yMin - pad, yMax: yMax + pad };
}

function makeProjector(b: PlotBounds, width: number, height: number) {
  const sx = width / (b.xMax - b.xMin);
  const sy = height / (b.yMax - b.yMin);
  return (x: number, y: number): readonly [number, number] => [
    (x - b.xMin) * sx,
    height - (y - b.yMin) * sy,
  ];
}

function paintGrid(ctx: CanvasRenderingContext2D, b: PlotBounds): void {
  const { width, height } = ctx.canvas;
  const proj = makeProjector(b, width, height);
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e4e4dd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 1) {
    const x = b.xMin + ((b.xMax - b.xMin) * i) / 10;
    const [cx] = proj(x, 0);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
  }
  for (let i = 0; i <= 6; i += 1) {
    const y = b.yMin + ((b.yMax - b.yMin) * i) / 6;
    const [, cy] = proj(0, y);
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
  }
  ctx.stroke();

  if (b.yMin <= 0 && b.yMax >= 0) {
    const [, cy] = proj(0, 0);
    ctx.strokeStyle = "#b8b8ad";
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
  }
}

function paintDashedFunction(
  ctx: CanvasRenderingContext2D,
  b: PlotBounds,
  f: (x: number) => number,
): void {
  const { width, height } = ctx.canvas;
  const proj = makeProjector(b, width, height);
  ctx.save();
  ctx.strokeStyle = "#8a8a80";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const samples = SAMPLE_COUNT;
  for (let i = 0; i <= samples; i += 1) {
    const x = b.xMin + ((b.xMax - b.xMin) * i) / samples;
    const y = f(x);
    if (!Number.isFinite(y)) continue;
    const [cx, cy] = proj(x, y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.restore();
}

function paintClampedPolyline(
  ctx: CanvasRenderingContext2D,
  b: PlotBounds,
  xs: readonly number[],
  ys: readonly number[],
  color: string,
  threshold: number | null,
): void {
  const { width, height } = ctx.canvas;
  const proj = makeProjector(b, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i]!;
    const y = ys[i]!;
    const tooBig = threshold !== null && Math.abs(y) > threshold;
    if (!Number.isFinite(y) || tooBig) {
      pen = false;
      continue;
    }
    const [cx, cy] = proj(x, y);
    if (!pen) {
      ctx.moveTo(cx, cy);
      pen = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
}

function paintNodes(
  ctx: CanvasRenderingContext2D,
  b: PlotBounds,
  nodes: readonly { x: number; y: number }[],
): void {
  const { width, height } = ctx.canvas;
  const proj = makeProjector(b, width, height);
  ctx.fillStyle = "#1a1a17";
  for (const p of nodes) {
    const [cx, cy] = proj(p.x, p.y);
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function LagrangeSplineVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "lagrange-spline",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const nodeSet = useMemo(() => getNodeSet(state.nodeSetSlug), [state.nodeSetSlug]);
  const spline = useMemo(() => buildNaturalSpline(nodeSet.nodes), [nodeSet]);

  // Precompute sample arrays once per (nodeSet, control) change.
  const samples = useMemo(() => {
    const [a, c] = nodeSet.domain;
    const xs = new Array<number>(SAMPLE_COUNT + 1);
    const lagY = new Array<number>(SAMPLE_COUNT + 1);
    const splY = new Array<number>(SAMPLE_COUNT + 1);
    for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
      const x = a + ((c - a) * i) / SAMPLE_COUNT;
      xs[i] = x;
      lagY[i] = lagrange(nodeSet.nodes, x);
      splY[i] = evalSpline(spline, x);
    }
    return { xs, lagY, splY };
  }, [nodeSet, spline]);

  const bounds = useMemo(
    () => computeBounds(nodeSet.nodes, nodeSet.domain, samples.splY),
    [nodeSet, samples],
  );

  // Max-|err| relative to f, only meaningful when f is known. Lagrange
  // error is capped at the plot threshold so the readout doesn't show
  // astronomical values from Runge blow-up.
  const errors = useMemo(() => {
    if (!nodeSet.f) return null;
    const f = nodeSet.f;
    let maxL = 0;
    let maxS = 0;
    for (let i = 0; i < samples.xs.length; i += 1) {
      const x = samples.xs[i]!;
      const fv = f(x);
      const eL = Math.abs(samples.lagY[i]! - fv);
      const eS = Math.abs(samples.splY[i]! - fv);
      if (Number.isFinite(eL) && eL < LAGRANGE_PLOT_THRESHOLD && eL > maxL) maxL = eL;
      if (Number.isFinite(eS) && eS > maxS) maxS = eS;
    }
    return { maxL, maxS };
  }, [nodeSet, samples]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      paintGrid(ctx, bounds);
      if (state.showOriginal === "yes" && nodeSet.f) {
        paintDashedFunction(ctx, bounds, nodeSet.f);
      }
      if (state.showSpline === "yes") {
        paintClampedPolyline(ctx, bounds, samples.xs, samples.splY, "#00693e", null);
      }
      if (state.showLagrange === "yes") {
        paintClampedPolyline(
          ctx,
          bounds,
          samples.xs,
          samples.lagY,
          "#d77a2a",
          LAGRANGE_PLOT_THRESHOLD,
        );
      }
      paintNodes(ctx, bounds, nodeSet.nodes);
    },
    [bounds, nodeSet, samples, state.showLagrange, state.showSpline, state.showOriginal],
  );

  const hudLines: string[] = [`n = ${nodeSet.nodes.length}`];
  if (errors) {
    hudLines.push(`\\max|L - f| = ${errors.maxL.toFixed(3)}`);
    hudLines.push(`\\max|S - f| = ${errors.maxS.toFixed(3)}`);
  }

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const toggle =
    (key: keyof LagrangeSplineDemoState) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setState({ ...state, [key]: e.target.checked ? "yes" : "no" });
    };

  return (
    <div className="ls-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Lagrange vs spline presets"
      />

      <div className="ls-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Lagrange polynomial and natural cubic spline through ${nodeSet.nodes.length} nodes from the ${nodeSet.name} node set`}
          draw={draw}
        />
        <MathHud corner="top-right" lines={hudLines} />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="ls-visualizer__controls">
        <label className="ls-visualizer__toggle">
          <input
            type="checkbox"
            checked={state.showLagrange === "yes"}
            onChange={toggle("showLagrange")}
          />
          Show Lagrange polynomial
        </label>
        <label className="ls-visualizer__toggle">
          <input
            type="checkbox"
            checked={state.showSpline === "yes"}
            onChange={toggle("showSpline")}
          />
          Show natural cubic spline
        </label>
        <label className="ls-visualizer__toggle">
          <input
            type="checkbox"
            checked={state.showOriginal === "yes"}
            onChange={toggle("showOriginal")}
            disabled={!nodeSet.f}
          />
          Show original f(x)
        </label>
      </div>

      <div className="ls-visualizer__actions">
        <button type="button" className="ls-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="ls-visualizer__counter" aria-live="off">
          {nodeSet.nodes.length} nodes
        </span>
      </div>
    </div>
  );
}
