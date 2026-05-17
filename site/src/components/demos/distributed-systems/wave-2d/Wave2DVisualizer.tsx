import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { gaussianPulse } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  SOURCE_VALUES,
  type SourceKind,
  type Wave2DDemoState,
} from "./presets";
import "./Wave2DVisualizer.css";

/**
 * <Wave2DVisualizer> — 2D wave-equation heatmap demo.
 *
 * Animates the leapfrog finite-difference scheme one integrator step
 * per draw frame. Re-runs from scratch whenever sliders change.
 */

const DX = 1.0;
const CFL_LIMIT = 1 / Math.SQRT2;

const STATE_SCHEMA = {
  nGrid: { type: "number", default: DEFAULT_STATE.nGrid },
  c: { type: "number", default: DEFAULT_STATE.c },
  dt: { type: "number", default: DEFAULT_STATE.dt },
  source: {
    type: "enum",
    default: DEFAULT_STATE.source,
    values: SOURCE_VALUES,
  },
} as const satisfies Schema;

function makeSource(
  kind: SourceKind,
  nx: number,
  ny: number,
): (i: number, j: number, n: number) => number {
  const ci = Math.floor(ny / 2);
  const cj = Math.floor(nx / 2);
  if (kind === "single") {
    return gaussianPulse(ci, cj, 50, 1.2, 1);
  }
  if (kind === "corner") {
    const ic = Math.max(2, Math.floor(ny * 0.15));
    const jc = Math.max(2, Math.floor(nx * 0.15));
    return gaussianPulse(ic, jc, 50, 1.2, 1);
  }
  // two-sources
  const offset = Math.max(3, Math.floor(nx * 0.18));
  const a = gaussianPulse(ci, cj - offset, 50, 1.2, 1);
  const b = gaussianPulse(ci, cj + offset, 50, 1.2, 1);
  return (i, j, n) => a(i, j, n) + b(i, j, n);
}

function allocGrid(ny: number, nx: number): number[][] {
  const g = new Array<number[]>(ny);
  for (let i = 0; i < ny; i += 1) g[i] = new Array<number>(nx).fill(0);
  return g;
}

export default function Wave2DVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "wave-2d",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const nx = state.nGrid;
  const ny = state.nGrid;
  const r = (state.c * state.dt) / DX;
  const cflViolated = r > CFL_LIMIT + 1e-12;

  const sourceFn = useMemo(
    () => makeSource(state.source, nx, ny),
    [state.source, nx, ny],
  );

  const uPrevRef = useRef<number[][]>(allocGrid(ny, nx));
  const uCurRef = useRef<number[][]>(allocGrid(ny, nx));
  const stepRef = useRef(0);
  const maxAmpRef = useRef(0);
  const accumulatorRef = useRef(0);
  const [tick, setTick] = useState(0);

  // Reset integration state whenever sliders change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger deps; body resets refs and only reads nx/ny (both listed) and allocates fresh grids
  useEffect(() => {
    uPrevRef.current = allocGrid(ny, nx);
    uCurRef.current = allocGrid(ny, nx);
    stepRef.current = 0;
    maxAmpRef.current = 0;
    accumulatorRef.current = 0;
    setTick((t) => t + 1);
  }, [state.nGrid, state.c, state.dt, state.source, nx, ny]);

  const runOneStep = useCallback((): void => {
    const uPrev = uPrevRef.current;
    const uCur = uCurRef.current;
    const r2 = r * r;
    const dt2 = state.dt * state.dt;
    const n = stepRef.current;
    const uNext = allocGrid(ny, nx);
    let localMax = maxAmpRef.current;
    for (let i = 1; i < ny - 1; i += 1) {
      for (let j = 1; j < nx - 1; j += 1) {
        const lap =
          uCur[i + 1]![j]! +
          uCur[i - 1]![j]! +
          uCur[i]![j + 1]! +
          uCur[i]![j - 1]! -
          4 * uCur[i]![j]!;
        const forced = sourceFn(i, j, n) * dt2;
        const next = 2 * uCur[i]![j]! - uPrev[i]![j]! + r2 * lap + forced;
        uNext[i]![j] = next;
        const a = Math.abs(next);
        if (a > localMax) localMax = a;
      }
    }
    uPrevRef.current = uCur;
    uCurRef.current = uNext;
    stepRef.current = n + 1;
    maxAmpRef.current = localMax;
  }, [r, state.dt, sourceFn, nx, ny]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      if (cflViolated) return;

      // Advance ~30 integrator steps per second.
      const stepInterval = 1000 / 30;
      accumulatorRef.current += deltaMs;
      let advanced = 0;
      while (accumulatorRef.current >= stepInterval && advanced < 4) {
        accumulatorRef.current -= stepInterval;
        runOneStep();
        advanced += 1;
      }

      const u = uCurRef.current;
      // Use current maxAmp for normalisation; floor to avoid div-by-zero.
      const norm = Math.max(maxAmpRef.current, 1e-6);
      const cellW = width / nx;
      const cellH = height / ny;
      for (let i = 0; i < ny; i += 1) {
        for (let j = 0; j < nx; j += 1) {
          const v = u[i]![j]! / norm;
          // Clamp to [-1, 1]
          const t = v > 1 ? 1 : v < -1 ? -1 : v;
          let rC: number;
          let gC: number;
          let bC: number;
          if (t >= 0) {
            // white → red
            rC = 255;
            gC = Math.round(255 * (1 - t));
            bC = Math.round(255 * (1 - t));
          } else {
            // white → blue
            rC = Math.round(255 * (1 + t));
            gC = Math.round(255 * (1 + t));
            bC = 255;
          }
          ctx.fillStyle = `rgb(${rC},${gC},${bC})`;
          ctx.fillRect(j * cellW, i * cellH, cellW + 1, cellH + 1);
        }
      }

      if (advanced > 0) setTick((tt) => tt + 1);
    },
    [cflViolated, runOneStep, nx, ny],
  );

  const handleReset = (): void => {
    reset();
    uPrevRef.current = allocGrid(ny, nx);
    uCurRef.current = allocGrid(ny, nx);
    stepRef.current = 0;
    maxAmpRef.current = 0;
    accumulatorRef.current = 0;
    setTick((t) => t + 1);
  };

  const sourceIdx = SOURCE_VALUES.indexOf(state.source);

  const presetItems = useMemo(
    () => PRESETS.map((p) => ({ name: p.name, state: p.state })),
    [],
  );

  return (
    <div className="w2-visualizer">
      <PresetCarousel<Wave2DDemoState>
        presets={presetItems as { name: string; state: Wave2DDemoState }[]}
        onSelect={(next) => setState(next)}
        ariaLabel="2D wave presets"
      />

      <div className="w2-visualizer__stage">
        <DemoCanvas
          width={480}
          height={480}
          ariaLabel={`2D wave heatmap on a ${nx}×${ny} grid`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `c = ${state.c.toFixed(2)}`,
            `r = ${r.toFixed(3)}`,
            `n = ${stepRef.current}`,
            `\\max |u| = ${maxAmpRef.current.toFixed(3)}`,
          ]}
        />
        {cflViolated ? (
          <div className="w2-visualizer__cfl-overlay" role="alert">
            CFL violated: r = {r.toFixed(3)} &gt; 1/√2 ≈ 0.7071
            <br />
            Lower c or dt to integrate.
          </div>
        ) : null}
      </div>

      <div className="w2-visualizer__controls">
        <SliderRow
          label="nGrid (square)"
          description="Grid resolution n × n cells."
          min={30}
          max={80}
          step={5}
          value={state.nGrid}
          onChange={(nGrid) => setState({ ...state, nGrid })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Wave speed c"
          description="Propagation speed. Combined with dt and dx, sets the CFL ratio r."
          min={0.5}
          max={4}
          step={0.1}
          value={state.c}
          onChange={(c) => setState({ ...state, c })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Timestep dt"
          description="Integrator step size. CFL stability requires c·dt/dx ≤ 1/√2."
          min={0.001}
          max={0.05}
          step={0.001}
          value={state.dt}
          onChange={(dt) => setState({ ...state, dt })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label={`Source: ${state.source}`}
          description="Forcing pattern: single, two-sources (interference), or corner."
          min={0}
          max={SOURCE_VALUES.length - 1}
          step={1}
          value={sourceIdx < 0 ? 0 : sourceIdx}
          onChange={(i) => {
            const idx = Math.max(0, Math.min(SOURCE_VALUES.length - 1, Math.round(i)));
            const next = SOURCE_VALUES[idx]!;
            setState({ ...state, source: next });
          }}
          hideTicks
          format={{ precision: 0 }}
        />
      </div>

      <div className="w2-visualizer__actions">
        <button type="button" className="w2-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="w2-visualizer__counter" aria-live="off" data-tick={tick}>
          step n = {stepRef.current} · max |u| = {maxAmpRef.current.toFixed(3)} · r ={" "}
          {r.toFixed(3)}
          {cflViolated ? " · CFL violated" : ""}
        </span>
      </div>
    </div>
  );
}
