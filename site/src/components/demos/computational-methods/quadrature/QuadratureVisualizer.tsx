import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { midpointRule, rectangleRule, simpsonRule, trapezoidRule } from "./algorithm";
import {
  DEFAULT_STATE,
  FUNCTIONS,
  FUNC_SLUGS,
  PRESETS,
  type QuadFunction,
  type QuadratureDemoState,
  RULE_LABELS,
  RULE_SLUGS,
  type RuleSlug,
} from "./presets";
import "./QuadratureVisualizer.css";

/**
 * <QuadratureVisualizer> — visual shell for the four 1D quadrature rules
 * (#79). Renders f(x) as a curve, shades the chosen rule's geometric
 * approximation, and overlays the running integral estimate + error.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const MIN_N = 1;
const MAX_N = 32;
const CURVE_SAMPLES = 400;

const STATE_SCHEMA = {
  funcSlug: {
    type: "enum",
    default: DEFAULT_STATE.funcSlug,
    values: FUNC_SLUGS,
  },
  rule: {
    type: "enum",
    default: DEFAULT_STATE.rule,
    values: RULE_SLUGS,
  },
  a: { type: "number", default: DEFAULT_STATE.a },
  b: { type: "number", default: DEFAULT_STATE.b },
  n: { type: "number", default: DEFAULT_STATE.n },
} as const satisfies Schema;

/** Round up to nearest even integer (Simpson requires even n). */
function evenN(n: number): number {
  const i = Math.max(2, Math.floor(n));
  return i % 2 === 0 ? i : i + 1;
}

function computeIntegral(
  state: QuadratureDemoState,
  fn: QuadFunction,
): { approx: number; safeN: number } {
  const safeN =
    state.rule === "simpson" ? evenN(state.n) : Math.max(1, Math.floor(state.n));
  const input = { f: fn.f, a: state.a, b: state.b, n: safeN };
  let approx = 0;
  try {
    if (state.rule === "rectangle") approx = rectangleRule(input);
    else if (state.rule === "midpoint") approx = midpointRule(input);
    else if (state.rule === "trapezoid") approx = trapezoidRule(input);
    else approx = simpsonRule(input);
  } catch {
    approx = Number.NaN;
  }
  return { approx, safeN };
}

/** Project (x, y) in function coords → canvas pixels. */
function makeProjector(
  a: number,
  b: number,
  yMin: number,
  yMax: number,
  width: number,
  height: number,
) {
  const padX = 24;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const xSpan = b - a || 1;
  const ySpan = yMax - yMin || 1;
  const toCanvas = (x: number, y: number): readonly [number, number] => [
    padX + ((x - a) / xSpan) * plotW,
    padY + plotH - ((y - yMin) / ySpan) * plotH,
  ];
  const yAxisPx = padY + plotH - ((0 - yMin) / ySpan) * plotH;
  return { toCanvas, padX, padY, plotW, plotH, yAxisPx };
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  proj: ReturnType<typeof makeProjector>,
  width: number,
): void {
  ctx.strokeStyle = "#b8b8b0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(proj.padX, proj.yAxisPx);
  ctx.lineTo(width - proj.padX, proj.yAxisPx);
  ctx.stroke();
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  fn: QuadFunction,
  a: number,
  b: number,
  proj: ReturnType<typeof makeProjector>,
): void {
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const x = a + ((b - a) * i) / CURVE_SAMPLES;
    const y = fn.f(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const [cx, cy] = proj.toCanvas(x, y);
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
}

function paintExactArea(
  ctx: CanvasRenderingContext2D,
  fn: QuadFunction,
  a: number,
  b: number,
  proj: ReturnType<typeof makeProjector>,
): void {
  ctx.fillStyle = "rgba(0, 105, 62, 0.10)";
  ctx.beginPath();
  const [x0, y0] = proj.toCanvas(a, 0);
  ctx.moveTo(x0, y0);
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const x = a + ((b - a) * i) / CURVE_SAMPLES;
    const y = fn.f(x);
    if (!Number.isFinite(y)) continue;
    const [cx, cy] = proj.toCanvas(x, y);
    ctx.lineTo(cx, cy);
  }
  const [xb, yb] = proj.toCanvas(b, 0);
  ctx.lineTo(xb, yb);
  ctx.closePath();
  ctx.fill();
}

function paintRectangles(
  ctx: CanvasRenderingContext2D,
  fn: QuadFunction,
  a: number,
  b: number,
  n: number,
  mode: "left" | "mid",
  proj: ReturnType<typeof makeProjector>,
): void {
  ctx.fillStyle = "rgba(207, 79, 79, 0.28)";
  ctx.strokeStyle = "rgba(207, 79, 79, 0.85)";
  ctx.lineWidth = 1;
  const h = (b - a) / n;
  for (let i = 0; i < n; i += 1) {
    const xLeft = a + i * h;
    const xRight = xLeft + h;
    const xSample = mode === "left" ? xLeft : xLeft + h / 2;
    const y = fn.f(xSample);
    if (!Number.isFinite(y)) continue;
    const [cxL, cyTop] = proj.toCanvas(xLeft, y);
    const [cxR, cyBase] = proj.toCanvas(xRight, 0);
    const x = Math.min(cxL, cxR);
    const w = Math.abs(cxR - cxL);
    const yRect = Math.min(cyTop, cyBase);
    const hRect = Math.abs(cyBase - cyTop);
    ctx.fillRect(x, yRect, w, hRect);
    ctx.strokeRect(x, yRect, w, hRect);
  }
}

function paintTrapezoids(
  ctx: CanvasRenderingContext2D,
  fn: QuadFunction,
  a: number,
  b: number,
  n: number,
  proj: ReturnType<typeof makeProjector>,
): void {
  ctx.fillStyle = "rgba(207, 79, 79, 0.28)";
  ctx.strokeStyle = "rgba(207, 79, 79, 0.85)";
  ctx.lineWidth = 1;
  const h = (b - a) / n;
  for (let i = 0; i < n; i += 1) {
    const xL = a + i * h;
    const xR = xL + h;
    const yL = fn.f(xL);
    const yR = fn.f(xR);
    if (!Number.isFinite(yL) || !Number.isFinite(yR)) continue;
    const [cxL, cyL] = proj.toCanvas(xL, yL);
    const [cxR, cyR] = proj.toCanvas(xR, yR);
    const [, cyBaseL] = proj.toCanvas(xL, 0);
    const [, cyBaseR] = proj.toCanvas(xR, 0);
    ctx.beginPath();
    ctx.moveTo(cxL, cyBaseL);
    ctx.lineTo(cxL, cyL);
    ctx.lineTo(cxR, cyR);
    ctx.lineTo(cxR, cyBaseR);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function paintSimpson(
  ctx: CanvasRenderingContext2D,
  fn: QuadFunction,
  a: number,
  b: number,
  n: number,
  proj: ReturnType<typeof makeProjector>,
): void {
  ctx.fillStyle = "rgba(207, 79, 79, 0.28)";
  ctx.strokeStyle = "rgba(207, 79, 79, 0.85)";
  ctx.lineWidth = 1;
  const h = (b - a) / n;
  // For each pair of subintervals [x0, x2] fit a parabola through
  // (x0, f0), (x1, f1), (x2, f2) and shade the area beneath.
  for (let i = 0; i < n; i += 2) {
    const x0 = a + i * h;
    const x1 = x0 + h;
    const x2 = x0 + 2 * h;
    const y0 = fn.f(x0);
    const y1 = fn.f(x1);
    const y2 = fn.f(x2);
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    // Lagrange-interpolated parabola sampled at the canvas resolution.
    ctx.beginPath();
    const [cxStart, cyBaseStart] = proj.toCanvas(x0, 0);
    ctx.moveTo(cxStart, cyBaseStart);
    const segs = 24;
    for (let k = 0; k <= segs; k += 1) {
      const t = k / segs;
      const x = x0 + t * (x2 - x0);
      // Lagrange basis on nodes (x0, x1, x2)
      const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
      const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
      const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
      const y = y0 * L0 + y1 * L1 + y2 * L2;
      const [cx, cy] = proj.toCanvas(x, y);
      ctx.lineTo(cx, cy);
    }
    const [cxEnd, cyBaseEnd] = proj.toCanvas(x2, 0);
    ctx.lineTo(cxEnd, cyBaseEnd);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

const narrationTemplate = (state: QuadratureDemoState): string => {
  const fn = FUNCTIONS[state.funcSlug];
  const ruleName = RULE_LABELS[state.rule].toLowerCase();
  return `Quadrature: integrating ${fn.name} (${fn.latex}) from ${state.a.toFixed(2)} to ${state.b.toFixed(2)} with ${state.n} subintervals using the ${ruleName} rule.`;
};

export function QuadratureVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "quadrature",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const fn = useMemo(() => FUNCTIONS[state.funcSlug], [state.funcSlug]);

  const { approx, safeN } = useMemo(() => computeIntegral(state, fn), [state, fn]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      const [yMin, yMax] = fn.yRange;
      const proj = makeProjector(state.a, state.b, yMin, yMax, width, height);

      paintExactArea(ctx, fn, state.a, state.b, proj);

      if (state.rule === "rectangle") {
        paintRectangles(ctx, fn, state.a, state.b, safeN, "left", proj);
      } else if (state.rule === "midpoint") {
        paintRectangles(ctx, fn, state.a, state.b, safeN, "mid", proj);
      } else if (state.rule === "trapezoid") {
        paintTrapezoids(ctx, fn, state.a, state.b, safeN, proj);
      } else {
        paintSimpson(ctx, fn, state.a, state.b, safeN, proj);
      }

      paintAxes(ctx, proj, width);
      paintCurve(ctx, fn, state.a, state.b, proj);
    },
    [fn, state.a, state.b, state.rule, safeN],
  );

  const hudLines = useMemo(() => {
    const approxStr = Number.isFinite(approx) ? approx.toFixed(4) : "NaN";
    const lines = [`\\int_a^b f(x)\\,dx \\approx ${approxStr}`];
    if (fn.exact !== undefined && Number.isFinite(approx)) {
      const err = Math.abs(fn.exact - approx);
      lines.push(`\\text{error} = ${err.toExponential(2)}`);
    }
    return lines;
  }, [approx, fn]);

  const handlePresetSelect = (next: QuadratureDemoState): void => {
    setState(next);
  };

  const handleFuncBoundsFix = (slug: typeof state.funcSlug): void => {
    const next = FUNCTIONS[slug];
    setState({
      ...state,
      funcSlug: slug,
      a: next.defaultA,
      b: next.defaultB,
    });
  };

  // When the user picks a preset, the carousel onSelect fires with the
  // full state. When the function changes via preset, bounds are part of
  // that state so they update consistently.

  return (
    <div className="qd-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: QuadratureDemoState }[] as {
            name: string;
            state: QuadratureDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Quadrature presets"
      />

      <div className="qd-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Quadrature approximation of ${fn.name} using the ${RULE_LABELS[state.rule].toLowerCase()} rule`}
          draw={draw}
        />
        <MathHud corner="top-right" lines={hudLines} />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div
        className="qd-visualizer__rules"
        role="listbox"
        aria-label="Quadrature rule"
        tabIndex={0}
      >
        <span className="qd-visualizer__rules-label">Rule:</span>
        {RULE_SLUGS.map((slug) => {
          const isActive = state.rule === slug;
          return (
            <button
              key={slug}
              type="button"
              role="option"
              aria-selected={isActive}
              className={
                isActive
                  ? "qd-visualizer__rule-button qd-visualizer__rule-button--active"
                  : "qd-visualizer__rule-button"
              }
              onClick={() => setState({ ...state, rule: slug as RuleSlug })}
            >
              {RULE_LABELS[slug]}
            </button>
          );
        })}
      </div>

      <div className="qd-visualizer__controls">
        <SliderRow
          label="Lower limit a"
          min={fn.aRange[0]}
          max={fn.aRange[1]}
          step={0.05}
          value={state.a}
          onChange={(a) => setState({ ...state, a })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Upper limit b"
          min={fn.bRange[0]}
          max={fn.bRange[1]}
          step={0.05}
          value={state.b}
          onChange={(b) => setState({ ...state, b })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Steps n"
          description="More steps tighten the estimate. Simpson's rule rounds up to the next even count."
          min={MIN_N}
          max={MAX_N}
          step={1}
          value={state.n}
          onChange={(n) => setState({ ...state, n })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="qd-visualizer__actions">
        <button
          type="button"
          className="qd-visualizer__btn"
          onClick={() => {
            reset();
            handleFuncBoundsFix(DEFAULT_STATE.funcSlug);
          }}
        >
          ↺ Reset
        </button>
        <span className="qd-visualizer__counter" aria-live="off">
          n = {state.n} subintervals
        </span>
      </div>
    </div>
  );
}
