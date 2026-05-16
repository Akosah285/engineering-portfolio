import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  analyticalStanding,
  cflRatio,
  firstStep,
  leapfrogStep,
} from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  PRESET_META,
  PRESET_SLUGS,
  type WaveEquationDemoState,
} from "./presets";
import "./WaveEquationVisualizer.css";

/**
 * <WaveEquationVisualizer> — animated 1D string solving u_tt = c² u_xx
 * with Dirichlet zero ends via the leapfrog scheme in `./algorithm.ts`.
 */

const L = 1.0;
const MAX_STEPS_PER_FRAME = 200;

const STATE_SCHEMA = {
  c: { type: "number", default: DEFAULT_STATE.c },
  dt: { type: "number", default: DEFAULT_STATE.dt },
  nGrid: { type: "number", default: DEFAULT_STATE.nGrid },
  mode: { type: "number", default: DEFAULT_STATE.mode },
} as const satisfies Schema;

const narrationTemplate = (state: WaveEquationDemoState): string => {
  const dx = L / (state.nGrid - 1);
  const r = cflRatio(state.c, dx, state.dt);
  return `Standing wave mode ${state.mode} on a 1 m string with wave speed c = ${state.c.toFixed(2)} m/s, ${state.nGrid} grid points, timestep ${state.dt.toFixed(3)} s, CFL ratio r = ${r.toFixed(3)} (stable when r ≤ 1).`;
};

function paintFrame(
  ctx: CanvasRenderingContext2D,
  u: readonly number[],
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Ground line — string at rest
  const midY = height / 2;
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Current u(x) curve
  const n = u.length;
  if (n < 2) return;
  const scaleY = (height / 2) * 0.85;
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * width;
    const y = midY - (u[i] ?? 0) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Endpoint dots (Dirichlet anchors)
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.arc(0, midY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width, midY, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function WaveEquationVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "wave-equation",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const dx = useMemo(() => L / (state.nGrid - 1), [state.nGrid]);
  const r = useMemo(
    () => cflRatio(state.c, dx, state.dt),
    [state.c, dx, state.dt],
  );
  const violated = r > 1;

  const uPrevRef = useRef<number[]>([]);
  const uCurrRef = useRef<number[]>([]);
  const accumRef = useRef(0);
  const [simTime, setSimTime] = useState(0);

  // Re-initialise the string whenever any control changes.
  useEffect(() => {
    const u0 = analyticalStanding({
      L,
      c: state.c,
      t: 0,
      nGrid: state.nGrid,
      mode: state.mode,
    });
    const v0 = new Array<number>(state.nGrid).fill(0);
    uPrevRef.current = u0.slice();
    uCurrRef.current = firstStep({
      u0,
      v0,
      c: state.c,
      dx,
      dt: state.dt,
    });
    accumRef.current = 0;
    setSimTime(0);
  }, [state.c, state.dt, state.nGrid, state.mode, dx]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      if (!violated) {
        accumRef.current += deltaMs / 1000;
        const dtSec = state.dt;
        let steps = Math.floor(accumRef.current / dtSec);
        if (steps > MAX_STEPS_PER_FRAME) steps = MAX_STEPS_PER_FRAME;
        accumRef.current -= steps * dtSec;
        for (let s = 0; s < steps; s += 1) {
          const next = leapfrogStep({
            uPrev: uPrevRef.current,
            uCurr: uCurrRef.current,
            c: state.c,
            dx,
            dt: dtSec,
          });
          uPrevRef.current = uCurrRef.current;
          uCurrRef.current = next;
        }
        if (steps > 0) setSimTime((t) => t + steps * dtSec);
      }
      paintFrame(ctx, uCurrRef.current);
    },
    [violated, state.c, state.dt, dx],
  );

  const handleReset = (): void => {
    reset();
    const u0 = analyticalStanding({
      L,
      c: DEFAULT_STATE.c,
      t: 0,
      nGrid: DEFAULT_STATE.nGrid,
      mode: DEFAULT_STATE.mode,
    });
    const v0 = new Array<number>(DEFAULT_STATE.nGrid).fill(0);
    uPrevRef.current = u0.slice();
    uCurrRef.current = firstStep({
      u0,
      v0,
      c: DEFAULT_STATE.c,
      dx: L / (DEFAULT_STATE.nGrid - 1),
      dt: DEFAULT_STATE.dt,
    });
    accumRef.current = 0;
    setSimTime(0);
  };

  const handlePresetSelect = (next: WaveEquationDemoState): void => {
    setState(next);
  };

  return (
    <div className="we-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: WaveEquationDemoState }[] as {
            name: string;
            state: WaveEquationDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Wave equation presets"
      />

      <div className="we-visualizer__stage">
        <DemoCanvas
          width={640}
          height={300}
          ariaLabel={`Standing wave on a 1 m string, mode ${state.mode}`}
          draw={draw}
          paused={violated}
        />
        <MathHud
          corner="top-right"
          lines={[
            `c = ${state.c.toFixed(2)}`,
            `r = ${r.toFixed(3)}`,
            `t = ${simTime.toFixed(2)}\\,s`,
          ]}
        />
        {violated ? (
          <div role="alert" className="we-visualizer__alert">
            CFL violated — paused
          </div>
        ) : null}
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="we-visualizer__controls">
        <SliderRow
          label="c (wave speed)"
          description="Speed of transverse waves on the string."
          min={0.2}
          max={4.0}
          step={0.1}
          value={state.c}
          onChange={(c) => setState({ ...state, c })}
          format={{ precision: 2, unit: "m/s" }}
        />
        <SliderRow
          label="dt (timestep)"
          description="Smaller dt keeps the CFL ratio r = c·dt/dx ≤ 1 for stability."
          min={0.001}
          max={0.05}
          step={0.001}
          value={state.dt}
          onChange={(dt) => setState({ ...state, dt })}
          format={{ precision: 3, unit: "s" }}
        />
        <SliderRow
          label="nGrid (grid points)"
          description="Number of points discretising the 1 m string."
          min={40}
          max={200}
          step={10}
          value={state.nGrid}
          onChange={(nGrid) => setState({ ...state, nGrid })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="mode (harmonic)"
          description="Initial standing-wave mode number m: u₀(x) = sin(mπx/L)."
          min={1}
          max={5}
          step={1}
          value={state.mode}
          onChange={(mode) => setState({ ...state, mode })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="we-visualizer__actions">
        <button type="button" className="we-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span
          className={
            violated
              ? "we-visualizer__counter we-visualizer__counter--violated"
              : "we-visualizer__counter"
          }
          aria-live="off"
        >
          {`CFL r = ${r.toFixed(3)} · t = ${simTime.toFixed(2)} s · mode ${state.mode}`}
        </span>
      </div>
    </div>
  );
}

export default WaveEquationVisualizer;
