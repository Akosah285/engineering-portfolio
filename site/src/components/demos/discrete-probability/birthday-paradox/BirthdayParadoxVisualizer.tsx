import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type CurvePoint,
  curve,
  exactCollisionProbability,
  smallestNForProbability,
} from "./algorithm";
import { type BirthdayDemoState, DEFAULT_STATE, PRESETS } from "./presets";
import "./BirthdayParadoxVisualizer.css";

/**
 * <BirthdayParadoxVisualizer> — plots P(collision) vs n with exact &
 * approximate curves overlaid, a horizontal target line, and an
 * animated marker that sweeps n = 1..maxN.
 */

const STATE_SCHEMA = {
  daysInYear: { type: "number", default: DEFAULT_STATE.daysInYear },
  maxN: { type: "number", default: DEFAULT_STATE.maxN },
  target: { type: "number", default: DEFAULT_STATE.target },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
} as const satisfies Schema;

const narrationTemplate = (state: BirthdayDemoState): string => {
  const nStar = smallestNForProbability({
    target: state.target,
    daysInYear: state.daysInYear,
  });
  return `Birthday paradox with ${state.daysInYear} days in the year: the probability of at least one shared birthday hits ${(state.target * 100).toFixed(0)}% at n = ${nStar} people.`;
};

interface PlotGeometry {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly maxN: number;
  toX(n: number): number;
  toY(p: number): number;
}

function makeGeometry(width: number, height: number, maxN: number): PlotGeometry {
  const left = 48;
  const right = width - 16;
  const top = 16;
  const bottom = height - 32;
  const span = Math.max(1, maxN - 1);
  return {
    left,
    right,
    top,
    bottom,
    maxN,
    toX: (n) => left + ((n - 1) / span) * (right - left),
    toY: (p) => bottom - p * (bottom - top),
  };
}

function paintAxes(ctx: CanvasRenderingContext2D, g: PlotGeometry): void {
  ctx.save();
  ctx.strokeStyle = "rgba(120, 120, 120, 0.35)";
  ctx.lineWidth = 1;
  ctx.font = "11px 'JetBrains Mono Variable', monospace";
  ctx.fillStyle = "rgba(90, 90, 90, 0.9)";

  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const y = g.toY(p);
    ctx.beginPath();
    ctx.moveTo(g.left, y);
    ctx.lineTo(g.right, y);
    ctx.stroke();
    ctx.fillText(p.toFixed(2), 6, y + 4);
  }

  ctx.strokeStyle = "rgba(80, 80, 80, 0.7)";
  ctx.beginPath();
  ctx.moveTo(g.left, g.top);
  ctx.lineTo(g.left, g.bottom);
  ctx.lineTo(g.right, g.bottom);
  ctx.stroke();

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i += 1) {
    const n = Math.round(1 + (i / xTicks) * (g.maxN - 1));
    const x = g.toX(n);
    ctx.fillText(String(n), x - 6, g.bottom + 14);
  }
  ctx.restore();
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  g: PlotGeometry,
  pts: readonly CurvePoint[],
  pick: (pt: CurvePoint) => number,
  color: string,
  dashed: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const x = g.toX(pt.n);
    const y = g.toY(pick(pt));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function paintTargetLine(
  ctx: CanvasRenderingContext2D,
  g: PlotGeometry,
  target: number,
  nStar: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  const y = g.toY(target);
  ctx.beginPath();
  ctx.moveTo(g.left, y);
  ctx.lineTo(g.right, y);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#cf4f4f";
  ctx.font = "12px 'Inter Variable', sans-serif";
  const x = Math.min(g.right - 70, Math.max(g.left + 4, g.toX(nStar) + 6));
  ctx.fillText(`n* = ${nStar}`, x, y - 6);
  ctx.restore();
}

function paintCursor(
  ctx: CanvasRenderingContext2D,
  g: PlotGeometry,
  currentN: number,
  exactP: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#3060c0";
  ctx.lineWidth = 1.5;
  const x = g.toX(currentN);
  ctx.beginPath();
  ctx.moveTo(x, g.top);
  ctx.lineTo(x, g.bottom);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#00693e";
  ctx.beginPath();
  ctx.arc(x, g.toY(exactP), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function BirthdayParadoxVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "birthday-paradox",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const [paused, setPaused] = useState(false);
  const [currentN, setCurrentN] = useState(1);
  const accumulatorRef = useRef(0);
  const currentNRef = useRef(1);

  useEffect(() => {
    currentNRef.current = 1;
    accumulatorRef.current = 0;
    setCurrentN(1);
  }, [state.daysInYear, state.maxN, state.target, state.stepDelay]);

  const points = useMemo(
    () => curve(state.maxN, state.daysInYear),
    [state.maxN, state.daysInYear],
  );

  const nStar = useMemo(
    () =>
      smallestNForProbability({
        target: state.target,
        daysInYear: state.daysInYear,
        nMax: state.maxN,
      }),
    [state.target, state.daysInYear, state.maxN],
  );

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      const g = makeGeometry(width, height, state.maxN);

      paintAxes(ctx, g);
      paintCurve(ctx, g, points, (p) => p.approx, "#d97706", true);
      paintCurve(ctx, g, points, (p) => p.exact, "#00693e", false);
      paintTargetLine(ctx, g, state.target, nStar);

      accumulatorRef.current += deltaMs;
      while (
        accumulatorRef.current >= state.stepDelay &&
        currentNRef.current < state.maxN
      ) {
        accumulatorRef.current -= state.stepDelay;
        currentNRef.current += 1;
      }
      if (currentNRef.current !== currentN) {
        setCurrentN(currentNRef.current);
      }

      const idx = Math.min(points.length - 1, Math.max(0, currentNRef.current - 1));
      const pt = points[idx]!;
      paintCursor(ctx, g, currentNRef.current, pt.exact);
    },
    [points, state.maxN, state.target, state.stepDelay, nStar, currentN],
  );

  const exactProb = exactCollisionProbability({
    n: currentN,
    daysInYear: state.daysInYear,
  });

  const handleReset = (): void => {
    reset();
    currentNRef.current = 1;
    accumulatorRef.current = 0;
    setCurrentN(1);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="bp-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Birthday paradox presets"
      />

      <div className="bp-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Birthday-paradox collision probability vs n, with D = ${state.daysInYear} days in the year`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `n = ${currentN}`,
            `P(\\text{collision}) = ${exactProb.toFixed(3)}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="bp-visualizer__controls">
        <SliderRow
          label="Days in year D"
          description="Size of the birthday alphabet. 365 = real calendar; 256 = one-byte hash."
          min={100}
          max={500}
          step={1}
          value={state.daysInYear}
          onChange={(daysInYear) => setState({ ...state, daysInYear })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Max n"
          description="Upper bound of people swept on the x-axis."
          min={5}
          max={100}
          step={1}
          value={state.maxN}
          onChange={(maxN) => setState({ ...state, maxN })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Target probability"
          description="Horizontal reference line; n* is the smallest n that meets this."
          min={0.05}
          max={0.99}
          step={0.01}
          value={state.target}
          onChange={(target) => setState({ ...state, target })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Step delay (ms)"
          description="Pause between successive n increments in the animation."
          min={50}
          max={500}
          step={50}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="bp-visualizer__actions">
        <button
          type="button"
          className="bp-visualizer__btn bp-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="bp-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="bp-visualizer__counter" aria-live="off">
          n = {currentN}
        </span>
      </div>
    </div>
  );
}
