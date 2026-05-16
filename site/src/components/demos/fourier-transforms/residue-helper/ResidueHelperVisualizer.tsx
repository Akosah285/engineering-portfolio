import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Complex, abs, contourIntegral, residueSimplePole, sub } from "./algorithm";
import {
  DEFAULT_FUNC,
  DEFAULT_RADIUS,
  FUNCS,
  FUNC_SLUGS,
  type FuncSlug,
  getFunc,
} from "./presets";
import "./ResidueHelperVisualizer.css";

const STATE_SCHEMA = {
  func: {
    type: "enum",
    default: DEFAULT_FUNC,
    values: FUNC_SLUGS,
  },
  radius: { type: "number", default: DEFAULT_RADIUS },
} as const satisfies Schema;

type RhState = { func: FuncSlug; radius: number };

const SVG_SIZE = 360;
const VIEW_MIN = -3;
const VIEW_MAX = 3;

function toPx(v: number): number {
  return ((v - VIEW_MIN) / (VIEW_MAX - VIEW_MIN)) * SVG_SIZE;
}
function toPxY(v: number): number {
  // y inverted (math up = pixel down)
  return SVG_SIZE - toPx(v);
}

function epsFor(pole: Complex, allPoles: readonly Complex[]): number {
  let minD = Number.POSITIVE_INFINITY;
  for (const other of allPoles) {
    if (other === pole) continue;
    const d = abs(sub(pole, other));
    if (d < minD) minD = d;
  }
  if (!Number.isFinite(minD)) return 0.1;
  return Math.min(0.1, minD / 2);
}

function fmt(n: number): string {
  return n.toFixed(3);
}

function fmtComplex(z: Complex): string {
  return `(${fmt(z.re)}, ${fmt(z.im)})`;
}

export default function ResidueHelperVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "residue-helper",
    STATE_SCHEMA,
    { func: DEFAULT_FUNC, radius: DEFAULT_RADIUS } as unknown as {
      func: "one-over-z";
      radius: 1.5;
    },
  );
  const state = rawState as unknown as RhState;
  type DemoState = typeof rawState;

  const spec = useMemo(() => getFunc(state.func), [state.func]);

  const funcIndex = Math.max(
    0,
    FUNCS.findIndex((s) => s.slug === state.func),
  );

  const presets = useMemo(
    () =>
      FUNCS.map((s) => ({
        name: s.displayName,
        state: { func: s.slug, radius: DEFAULT_RADIUS } satisfies RhState,
      })),
    [],
  );

  const enclosed = useMemo(
    () => spec.poles.filter((p) => abs(p) < state.radius),
    [spec, state.radius],
  );

  const residues = useMemo(() => {
    return enclosed.map((p) => {
      const eps = epsFor(p, spec.poles);
      try {
        return residueSimplePole(spec.f, p, eps);
      } catch {
        return { re: 0, im: 0 } as Complex;
      }
    });
  }, [enclosed, spec]);

  const sumRes = residues.reduce<Complex>(
    (acc, r) => ({ re: acc.re + r.re, im: acc.im + r.im }),
    { re: 0, im: 0 },
  );
  const integral = contourIntegral(residues);

  const handlePresetSelect = (next: RhState): void => {
    setState({ func: next.func, radius: state.radius } as unknown as DemoState);
  };

  const handleRadiusChange = (next: number): void => {
    setState({ ...state, radius: next } as unknown as DemoState);
  };

  const handleFuncChange = (next: number): void => {
    const idx = Math.min(FUNCS.length - 1, Math.max(0, Math.round(next)));
    const picked = FUNCS[idx];
    if (!picked) return;
    setState({ func: picked.slug, radius: state.radius } as unknown as DemoState);
  };

  const handleReset = (): void => {
    reset();
  };

  // Build grid lines at integer coords
  const gridLines: number[] = [];
  for (let i = Math.ceil(VIEW_MIN); i <= Math.floor(VIEW_MAX); i += 1) {
    gridLines.push(i);
  }

  const cx = toPx(0);
  const cy = toPxY(0);
  const rPx = (state.radius / (VIEW_MAX - VIEW_MIN)) * SVG_SIZE;

  return (
    <div className="rh-visualizer">
      <PresetCarousel
        presets={
          presets as unknown as {
            name: string;
            state: RhState;
          }[]
        }
        onSelect={handlePresetSelect}
        initialIndex={funcIndex}
        ariaLabel="Residue helper presets"
      />

      <div className="rh-visualizer__stage">
        <svg
          className="rh-visualizer__svg"
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          role="img"
          aria-label="Complex plane with contour and poles"
        >
          {gridLines.map((g) => (
            <g key={`grid-${g}`}>
              <line
                x1={toPx(g)}
                y1={0}
                x2={toPx(g)}
                y2={SVG_SIZE}
                stroke="#eee"
                strokeWidth={1}
              />
              <line
                x1={0}
                y1={toPxY(g)}
                x2={SVG_SIZE}
                y2={toPxY(g)}
                stroke="#eee"
                strokeWidth={1}
              />
            </g>
          ))}
          {/* axes */}
          <line
            x1={0}
            y1={toPxY(0)}
            x2={SVG_SIZE}
            y2={toPxY(0)}
            stroke="#888"
            strokeWidth={1}
          />
          <line
            x1={toPx(0)}
            y1={0}
            x2={toPx(0)}
            y2={SVG_SIZE}
            stroke="#888"
            strokeWidth={1}
          />
          {/* contour */}
          <circle cx={cx} cy={cy} r={rPx} fill="none" stroke="#1f77b4" strokeWidth={2} />
          {/* poles */}
          {spec.poles.map((p, i) => {
            const isEnclosed = abs(p) < state.radius;
            return (
              <g key={`pole-${i}`}>
                <circle
                  cx={toPx(p.re)}
                  cy={toPxY(p.im)}
                  r={6}
                  fill={isEnclosed ? "#d4a017" : "#999"}
                  stroke="#222"
                  strokeWidth={1}
                />
                <text
                  x={toPx(p.re) + 9}
                  y={toPxY(p.im) - 9}
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  fill="#222"
                >
                  {`(${p.re},${p.im})`}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="rh-visualizer__readout">
          {enclosed.length === 0 ? (
            <div className="rh-visualizer__readout-row">
              <span className="rh-visualizer__readout-label">No poles enclosed</span>
            </div>
          ) : (
            enclosed.map((p, i) => {
              const r = residues[i] ?? { re: 0, im: 0 };
              return (
                <div className="rh-visualizer__readout-row" key={`res-${i}`}>
                  <span className="rh-visualizer__readout-label">
                    {`Res(f, ${fmtComplex(p)}) =`}
                  </span>
                  <span>{fmtComplex(r)}</span>
                </div>
              );
            })
          )}
          <div className="rh-visualizer__readout-row">
            <span className="rh-visualizer__readout-label">Σ Res =</span>
            <span>{fmtComplex(sumRes)}</span>
          </div>
          <div className="rh-visualizer__readout-row">
            <span className="rh-visualizer__readout-label">
              ∮ f(z) dz = 2πi · Σ Res =
            </span>
            <span>{fmtComplex(integral)}</span>
          </div>
        </div>
      </div>

      <div className="rh-visualizer__hud" aria-live="polite">
        {`${spec.displayName} · radius=${state.radius.toFixed(1)}`}
      </div>

      <div className="rh-visualizer__controls">
        <SliderRow
          label="Contour radius"
          min={0.5}
          max={3}
          step={0.1}
          value={state.radius}
          onChange={handleRadiusChange}
          format={{ precision: 1 }}
        />
        <SliderRow
          label="Function"
          min={0}
          max={Math.max(FUNCS.length - 1, 1)}
          step={1}
          value={funcIndex}
          onChange={handleFuncChange}
          format={{ precision: 0 }}
        />
      </div>

      <div className="rh-visualizer__actions">
        <button
          type="button"
          className="rh-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset residue helper"
        >
          ↺ Reset
        </button>
        <span className="rh-visualizer__counter" aria-live="off">
          {`enclosed poles: ${enclosed.length} · integral ≈ (${fmt(integral.re)}, ${fmt(integral.im)})`}
        </span>
      </div>
    </div>
  );
}
