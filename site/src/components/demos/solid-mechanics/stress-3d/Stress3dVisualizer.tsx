import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type StressTensor,
  invariants,
  maxShear,
  principalStresses,
  vonMises,
} from "./algorithm";
import {
  DEFAULT_STATE,
  LOADING_SLUGS,
  type LoadingSlug,
  PRESETS,
  type Stress3dDemoState,
  getPreset,
} from "./presets";
import "./Stress3dVisualizer.css";

/**
 * <Stress3dVisualizer> — Mohr's-circle-style 3-D stress visual shell.
 *
 * Left: three Mohr circles in σ-τ space (SVG).
 * Right: invariants and equivalent-stress panel.
 */

const STATE_SCHEMA = {
  sx: { type: "number", default: DEFAULT_STATE.sx },
  sy: { type: "number", default: DEFAULT_STATE.sy },
  sz: { type: "number", default: DEFAULT_STATE.sz },
  txy: { type: "number", default: DEFAULT_STATE.txy },
  txz: { type: "number", default: DEFAULT_STATE.txz },
  tyz: { type: "number", default: DEFAULT_STATE.tyz },
  loading: { type: "enum", default: DEFAULT_STATE.loading, values: LOADING_SLUGS },
} as const satisfies Schema;

const SVG_SIZE = 360;
const SVG_PAD = 24;

function fmt(n: number, precision = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(precision);
}

interface MohrSvgProps {
  s1: number;
  s2: number;
  s3: number;
  tauMax: number;
  sigmaMean: number;
}

function MohrSvg({ s1, s2, s3, tauMax, sigmaMean }: MohrSvgProps) {
  // Determine plot extent: max |σ| out to the rightmost/leftmost circle edge.
  const sMax = Math.max(s1, s2, s3);
  const sMin = Math.min(s1, s2, s3);
  const extentSigma = Math.max(Math.abs(sMax), Math.abs(sMin), 1);
  const extentTau = Math.max(Math.abs(tauMax), 1);
  const extent = Math.max(extentSigma, extentTau) * 1.1;

  const cx = SVG_SIZE / 2;
  const cy = SVG_SIZE / 2;
  const scale = (SVG_SIZE / 2 - SVG_PAD) / extent;

  const sx = (sigma: number) => cx + sigma * scale;
  const sy = (tau: number) => cy - tau * scale;

  const circles: Array<{ a: number; b: number; key: string }> = [
    { a: s1, b: s2, key: "c12" },
    { a: s2, b: s3, key: "c23" },
    { a: s1, b: s3, key: "c13" },
  ];

  return (
    <svg
      className="s3d-visualizer__svg"
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      role="img"
      aria-label="Mohr circles for 3-D principal stresses"
    >
      <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill="#fcfbf8" />

      {/* σ axis (horizontal) */}
      <line
        x1={SVG_PAD / 2}
        y1={cy}
        x2={SVG_SIZE - SVG_PAD / 2}
        y2={cy}
        stroke="rgba(40,40,40,0.5)"
        strokeWidth={1}
      />
      {/* τ axis (vertical) */}
      <line
        x1={cx}
        y1={SVG_PAD / 2}
        x2={cx}
        y2={SVG_SIZE - SVG_PAD / 2}
        stroke="rgba(40,40,40,0.5)"
        strokeWidth={1}
      />
      <text
        x={SVG_SIZE - SVG_PAD / 2 - 4}
        y={cy - 4}
        fontSize={11}
        textAnchor="end"
        fill="rgba(40,40,40,0.75)"
        fontFamily="ui-monospace, monospace"
      >
        σ
      </text>
      <text
        x={cx + 4}
        y={SVG_PAD / 2 + 10}
        fontSize={11}
        fill="rgba(40,40,40,0.75)"
        fontFamily="ui-monospace, monospace"
      >
        τ
      </text>

      {/* Three Mohr circles. Stroked, transparent fill. */}
      {circles.map(({ a, b, key }) => {
        const centre = (a + b) / 2;
        const radius = Math.abs(a - b) / 2;
        return (
          <circle
            key={key}
            cx={sx(centre)}
            cy={sy(0)}
            r={radius * scale}
            fill="none"
            stroke={key === "c13" ? "#1f77b4" : "rgba(40,40,40,0.45)"}
            strokeWidth={key === "c13" ? 2 : 1.2}
          />
        );
      })}

      {/* Principal-stress tick marks on σ axis */}
      {[
        { v: s1, label: "σ₁" },
        { v: s2, label: "σ₂" },
        { v: s3, label: "σ₃" },
      ].map(({ v, label }, i) => (
        <g key={`tick-${i}`}>
          <line
            x1={sx(v)}
            y1={cy - 4}
            x2={sx(v)}
            y2={cy + 4}
            stroke="rgba(40,40,40,0.85)"
            strokeWidth={1.5}
          />
          <text
            x={sx(v)}
            y={cy + 16}
            fontSize={10}
            textAnchor="middle"
            fill="rgba(40,40,40,0.85)"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Max-shear point (mean, τ_max) — red dot */}
      <circle cx={sx(sigmaMean)} cy={sy(tauMax)} r={4} fill="#d62728" />
      <text
        x={sx(sigmaMean) + 6}
        y={sy(tauMax) - 6}
        fontSize={10}
        fill="#d62728"
        fontFamily="ui-monospace, monospace"
      >
        τ_max
      </text>
    </svg>
  );
}

export default function Stress3dVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "stress-3d",
    STATE_SCHEMA,
    {
      sx: DEFAULT_STATE.sx,
      sy: DEFAULT_STATE.sy,
      sz: DEFAULT_STATE.sz,
      txy: DEFAULT_STATE.txy,
      txz: DEFAULT_STATE.txz,
      tyz: DEFAULT_STATE.tyz,
      loading: DEFAULT_STATE.loading,
    } as unknown as {
      sx: number;
      sy: number;
      sz: number;
      txy: number;
      txz: number;
      tyz: number;
      loading: "uniaxial-tension";
    },
  );
  const state = rawState as unknown as Stress3dDemoState;
  type DemoState = typeof rawState;

  const tensor: StressTensor = useMemo(
    () => ({
      sx: state.sx,
      sy: state.sy,
      sz: state.sz,
      txy: state.txy,
      txz: state.txz,
      tyz: state.tyz,
    }),
    [state.sx, state.sy, state.sz, state.txy, state.txz, state.tyz],
  );

  const inv = useMemo(() => invariants(tensor), [tensor]);
  const principals = useMemo(() => principalStresses(tensor), [tensor]);
  const [s1, s2, s3] = principals;
  const tauMax = useMemo(() => maxShear(tensor), [tensor]);
  const sigmaMean = inv.I1 / 3;
  const sigmaVm = useMemo(() => vonMises(tensor), [tensor]);

  const loadingIndex = Math.max(0, LOADING_SLUGS.indexOf(state.loading));

  const presets = useMemo(
    () =>
      PRESETS.map((p) => ({
        name: p.name,
        state: p.state,
      })),
    [],
  );

  const handlePresetSelect = (next: Stress3dDemoState): void => {
    setState(next as unknown as DemoState);
  };

  const handleLoadingChange = (raw: number): void => {
    const idx = Math.max(0, Math.min(LOADING_SLUGS.length - 1, Math.round(raw)));
    const slug = LOADING_SLUGS[idx] ?? "uniaxial-tension";
    const preset = getPreset(slug);
    setState(preset.state as unknown as DemoState);
  };

  const setNumber = (key: keyof StressTensor, value: number): void => {
    setState({ ...state, [key]: value } as unknown as DemoState);
  };

  return (
    <div className="s3d-visualizer">
      <PresetCarousel
        presets={
          presets as unknown as {
            name: string;
            state: Stress3dDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        initialIndex={loadingIndex}
        ariaLabel="Stress 3D loading presets"
      />

      <div className="s3d-visualizer__stage">
        <MohrSvg s1={s1} s2={s2} s3={s3} tauMax={tauMax} sigmaMean={sigmaMean} />

        <div
          className="s3d-visualizer__panel"
          aria-label="Invariants and equivalent stress"
        >
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">I₁</span>
            <span className="s3d-visualizer__panel-value">{fmt(inv.I1)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">I₂</span>
            <span className="s3d-visualizer__panel-value">{fmt(inv.I2)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">I₃</span>
            <span className="s3d-visualizer__panel-value">{fmt(inv.I3)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">σ₁</span>
            <span className="s3d-visualizer__panel-value">{fmt(s1)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">σ₂</span>
            <span className="s3d-visualizer__panel-value">{fmt(s2)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">σ₃</span>
            <span className="s3d-visualizer__panel-value">{fmt(s3)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">σ_mean = I₁/3</span>
            <span className="s3d-visualizer__panel-value">{fmt(sigmaMean)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">τ_max = (σ₁ − σ₃)/2</span>
            <span className="s3d-visualizer__panel-value">{fmt(tauMax)}</span>
          </div>
          <div className="s3d-visualizer__panel-row">
            <span className="s3d-visualizer__panel-label">σ_vm</span>
            <span className="s3d-visualizer__panel-value">{fmt(sigmaVm)}</span>
          </div>
        </div>
      </div>

      <div className="s3d-visualizer__hud" aria-live="polite">
        {`${state.loading} · σ_vm=${fmt(sigmaVm, 1)} MPa`}
      </div>

      <div className="s3d-visualizer__controls">
        <SliderRow
          label="σx (MPa)"
          min={-200}
          max={200}
          step={1}
          value={state.sx}
          onChange={(v) => setNumber("sx", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="σy (MPa)"
          min={-200}
          max={200}
          step={1}
          value={state.sy}
          onChange={(v) => setNumber("sy", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="σz (MPa)"
          min={-200}
          max={200}
          step={1}
          value={state.sz}
          onChange={(v) => setNumber("sz", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="τxy (MPa)"
          min={-150}
          max={150}
          step={1}
          value={state.txy}
          onChange={(v) => setNumber("txy", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="τxz (MPa)"
          min={-150}
          max={150}
          step={1}
          value={state.txz}
          onChange={(v) => setNumber("txz", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="τyz (MPa)"
          min={-150}
          max={150}
          step={1}
          value={state.tyz}
          onChange={(v) => setNumber("tyz", v)}
          format={{ precision: 0, unit: " MPa" }}
        />
        <SliderRow
          label="Loading preset"
          min={0}
          max={Math.max(LOADING_SLUGS.length - 1, 1)}
          step={1}
          value={loadingIndex}
          onChange={handleLoadingChange}
          format={{ precision: 0 }}
        />
      </div>

      <div className="s3d-visualizer__actions">
        <button
          type="button"
          className="s3d-visualizer__btn"
          onClick={reset}
          aria-label="Reset 3d stress"
        >
          ↺ Reset
        </button>
        <span className="s3d-visualizer__counter" aria-live="off">
          {`σ_vm = ${fmt(sigmaVm, 1)} · τ_max = ${fmt(tauMax, 1)} · σ₁ = ${fmt(s1, 1)}`}
        </span>
      </div>
    </div>
  );
}
