import { useCallback, useEffect, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { analyticalMode, ftcsStep, stabilityRatio } from "./algorithm";
import {
  DEFAULT_STATE,
  HEAT_PRESET_SLUGS,
  type HeatDemoState,
  PRESETS,
  PRESET_META,
} from "./presets";
import "./HeatEquationVisualizer.css";

/**
 * <HeatEquationVisualizer> — animated 1D heat-diffusion explorer.
 *
 * Runs explicit FTCS time-stepping on a user-chosen initial condition
 * and overlays the analytical single-mode reference where applicable.
 */

const L = 1.0;
const FRAME_MS = 16;
const STEPS_PER_FRAME_CAP = 100;

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: HEAT_PRESET_SLUGS,
  },
  alpha: { type: "number", default: DEFAULT_STATE.alpha },
  dt: { type: "number", default: DEFAULT_STATE.dt },
  nGrid: { type: "number", default: DEFAULT_STATE.nGrid },
} as const satisfies Schema;

const narrationTemplate = (state: HeatDemoState): string => {
  const meta = PRESET_META[state.presetSlug];
  const dx = L / (state.nGrid - 1);
  const r = stabilityRatio(state.alpha, dx, state.dt);
  return `1D heat equation with initial condition "${meta.name}". α = ${state.alpha.toFixed(3)}, dt = ${state.dt.toFixed(4)} s, stability r = ${r.toFixed(3)}.`;
};

/** Color-map a value in [-1, 1] to a hot/cold rgb string. */
function hotColdColor(v: number): string {
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    // 0 → white-ish, +1 → red
    const g = Math.round(240 - t * 200);
    const b = Math.round(240 - t * 220);
    return `rgb(220, ${g}, ${b})`;
  }
  // 0 → white-ish, -1 → blue
  const a = -t;
  const r = Math.round(240 - a * 220);
  const g = Math.round(240 - a * 160);
  return `rgb(${r}, ${g}, 220)`;
}

interface PlotGeom {
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotW: number;
  plotH: number;
  stripH: number;
  toX: (x: number) => number;
  toY: (u: number) => number;
}

function makeGeom(width: number, height: number): PlotGeom {
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 48;
  const stripH = 16;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  return {
    padL,
    padR,
    padT,
    padB,
    plotW,
    plotH,
    stripH,
    toX: (x) => padL + (x / L) * plotW,
    toY: (u) => padT + (1 - (u + 1) / 2) * plotH,
  };
}

function paintAxes(ctx: CanvasRenderingContext2D, g: PlotGeom): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  // y axis
  ctx.moveTo(g.padL, g.padT);
  ctx.lineTo(g.padL, g.padT + g.plotH);
  // x axis (u = 0 line at middle)
  const yZero = g.toY(0);
  ctx.moveTo(g.padL, yZero);
  ctx.lineTo(g.padL + g.plotW, yZero);
  ctx.stroke();

  ctx.fillStyle = "#666";
  ctx.font = "11px 'JetBrains Mono Variable', monospace";
  ctx.fillText("1", g.padL - 14, g.padT + 8);
  ctx.fillText("0", g.padL - 14, yZero + 4);
  ctx.fillText("-1", g.padL - 18, g.padT + g.plotH);
  ctx.fillText("0", g.padL - 4, g.padT + g.plotH + 14);
  ctx.fillText("L", g.padL + g.plotW - 6, g.padT + g.plotH + 14);
  ctx.fillText("x", g.padL + g.plotW / 2, g.padT + g.plotH + 14);
  ctx.save();
  ctx.translate(12, g.padT + g.plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("u(x, t)", -16, 0);
  ctx.restore();
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  g: PlotGeom,
  u: readonly number[],
  stroke: string,
  dashed = false,
  width = 2,
): void {
  if (u.length < 2) return;
  ctx.save();
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < u.length; i += 1) {
    const x = (i / (u.length - 1)) * L;
    const cx = g.toX(x);
    const cy = g.toY(u[i]!);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.restore();
}

function paintHeatStrip(
  ctx: CanvasRenderingContext2D,
  g: PlotGeom,
  u: readonly number[],
): void {
  const stripY = g.padT + g.plotH + 22;
  const n = u.length;
  const cellW = g.plotW / n;
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = hotColdColor(u[i]!);
    ctx.fillRect(g.padL + i * cellW, stripY, cellW + 1, g.stripH);
  }
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.strokeRect(g.padL, stripY, g.plotW, g.stripH);
}

export function HeatEquationVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "heat-equation",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { presetSlug, alpha, dt, nGrid } = state;
  const dx = L / (nGrid - 1);
  const r = stabilityRatio(alpha, dx, dt);
  const unstable = r > 0.5;

  const uRef = useRef<number[]>(PRESET_META[presetSlug].initialFn(L, nGrid));
  const tRef = useRef(0);
  const accumulatorRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [, setDisplayTick] = useState(0);

  // Re-initialise whenever the initial-condition inputs change.
  useEffect(() => {
    uRef.current = PRESET_META[presetSlug].initialFn(L, nGrid);
    tRef.current = 0;
    accumulatorRef.current = 0;
    setDisplayTick((x) => x + 1);
  }, [presetSlug, nGrid]);

  // rAF stepping loop.
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const delta = last === null ? FRAME_MS : now - last;
      last = now;
      accumulatorRef.current += delta;
      let n = 0;
      while (accumulatorRef.current >= FRAME_MS && n < STEPS_PER_FRAME_CAP) {
        if (!unstable) {
          uRef.current = ftcsStep({ u: uRef.current, alpha, dx, dt });
          tRef.current += dt;
        }
        accumulatorRef.current -= FRAME_MS;
        n += 1;
      }
      setDisplayTick((x) => (x + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, alpha, dt, dx, unstable]);

  const analyticalModeNum = PRESET_META[presetSlug].analyticalMode;

  const draw: DrawFn = useCallback(
    (ctx) => {
      const g = makeGeom(ctx.canvas.width, ctx.canvas.height);
      paintAxes(ctx, g);

      if (analyticalModeNum !== null) {
        const ref = analyticalMode({
          L,
          alpha,
          t: tRef.current,
          nGrid,
          mode: analyticalModeNum,
        });
        paintCurve(ctx, g, ref, "#888", true, 1.5);
      }

      paintCurve(ctx, g, uRef.current, "steelblue", false, 2.5);
      paintHeatStrip(ctx, g, uRef.current);
    },
    [analyticalModeNum, alpha, nGrid],
  );

  let liveMaxU = 0;
  for (const v of uRef.current) {
    const a = Math.abs(v);
    if (a > liveMaxU) liveMaxU = a;
  }

  const handleReset = (): void => {
    reset();
    uRef.current = PRESET_META[DEFAULT_STATE.presetSlug].initialFn(
      L,
      DEFAULT_STATE.nGrid,
    );
    tRef.current = 0;
    accumulatorRef.current = 0;
    setDisplayTick((x) => x + 1);
  };

  const handlePresetSelect = (next: HeatDemoState): void => {
    setState(next);
  };

  return (
    <div className="he-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: HeatDemoState }[] as {
            name: string;
            state: HeatDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Heat equation initial-condition presets"
      />

      <div className="he-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`1D heat equation evolving from "${PRESET_META[presetSlug].name}" initial condition`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `t = ${tRef.current.toFixed(3)} \\text{ s}`,
            `r = ${r.toFixed(3)}`,
            `\\max|u| = ${liveMaxU.toFixed(3)}`,
          ]}
        />
        {unstable ? (
          <div className="he-visualizer__warning" role="alert">
            Unstable: r &gt; 0.5
          </div>
        ) : null}
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="he-visualizer__controls">
        <SliderRow
          label="Diffusivity α"
          description="Thermal diffusivity. Larger α → faster smoothing toward zero."
          min={0.001}
          max={1}
          step={0.001}
          value={alpha}
          onChange={(next) => setState({ ...state, alpha: next })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Time step dt"
          description="FTCS step size. Stability requires r = α·dt/dx² ≤ 0.5."
          min={0.0001}
          max={0.01}
          step={0.0001}
          value={dt}
          onChange={(next) => setState({ ...state, dt: next })}
          format={{ precision: 4, unit: "s" }}
        />
        <SliderRow
          label="Grid points nGrid"
          description="Number of spatial samples on [0, L]. Smaller dx → tighter stability."
          min={10}
          max={100}
          step={5}
          value={nGrid}
          onChange={(next) => setState({ ...state, nGrid: Math.round(next) })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="he-visualizer__actions">
        <button
          type="button"
          className="he-visualizer__btn he-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="he-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="he-visualizer__counter" aria-live="off">
          t = {tRef.current.toFixed(3)} s
        </span>
      </div>
    </div>
  );
}
