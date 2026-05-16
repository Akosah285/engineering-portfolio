import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { complementaryFilter } from "./algorithm";
import { SCENARIOS, SCENARIO_SLUGS, type ScenarioSlug, getScenario } from "./presets";
import "./SensorFusionVisualizer.css";

const DEFAULT_SCENARIO: ScenarioSlug = "clean-tilt-ramp";
const DEFAULT_ALPHA = 0.95;

const STATE_SCHEMA = {
  scenario: {
    type: "enum",
    default: DEFAULT_SCENARIO,
    values: SCENARIO_SLUGS,
  },
  alpha: { type: "number", default: DEFAULT_ALPHA },
  sample: { type: "number", default: 0 },
} as const satisfies Schema;

type SfState = { scenario: ScenarioSlug; alpha: number; sample: number };

const SVG_WIDTH = 640;
const SVG_HEIGHT = 320;
const PAD_L = 48;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 32;

const COLORS = {
  gyro: "#888888",
  acc: "#7fb3d5",
  fused: "#e67e22",
  truth: "#27ae60",
  cursor: "#333333",
};

const RAD_TO_DEG = 180 / Math.PI;

function integrateGyro(omega: readonly number[], dt: number, theta0: number): number[] {
  const out = new Array<number>(omega.length);
  out[0] = theta0;
  for (let k = 1; k < omega.length; k += 1) {
    out[k] = out[k - 1]! + omega[k]! * dt;
  }
  return out;
}

function rmsError(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    const d = a[i]! - b[i]!;
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

interface SeriesPathProps {
  values: readonly number[];
  xScale: (i: number) => number;
  yScale: (v: number) => number;
  color: string;
  width: number;
  dashed?: boolean;
}

function SeriesPath({ values, xScale, yScale, color, width, dashed }: SeriesPathProps) {
  if (values.length === 0) return null;
  const d = values
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`,
    )
    .join(" ");
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? "4 4" : undefined}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export default function SensorFusionVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "sensor-fusion",
    STATE_SCHEMA,
    { scenario: DEFAULT_SCENARIO, alpha: DEFAULT_ALPHA, sample: 0 } as unknown as {
      scenario: "clean-tilt-ramp";
      alpha: 0.95;
      sample: 0;
    },
  );
  const state = rawState as unknown as SfState;
  type DemoState = typeof rawState;

  const scenario = useMemo(() => getScenario(state.scenario), [state.scenario]);

  const alpha = Math.min(1, Math.max(0, state.alpha));

  const gyroIntegrated = useMemo(
    () => integrateGyro(scenario.omegaGyro, scenario.dt, scenario.theta0),
    [scenario],
  );

  const fused = useMemo(
    () =>
      complementaryFilter({
        alpha,
        dt: scenario.dt,
        omegaGyro: scenario.omegaGyro,
        thetaAcc: scenario.thetaAcc,
        theta0: scenario.theta0,
      }).thetaFused,
    [alpha, scenario],
  );

  const N = scenario.truth.length;
  const sample = Math.min(Math.max(0, Math.round(state.sample)), Math.max(0, N - 1));

  const rms = rmsError(fused, scenario.truth);

  // Y bounds across all 4 series.
  const allValues = useMemo(() => {
    const arr: number[] = [];
    for (const v of gyroIntegrated) arr.push(v);
    for (const v of scenario.thetaAcc) arr.push(v);
    for (const v of fused) arr.push(v);
    for (const v of scenario.truth) arr.push(v);
    return arr;
  }, [gyroIntegrated, scenario, fused]);

  const yMinRaw = Math.min(...allValues);
  const yMaxRaw = Math.max(...allValues);
  const yPad = Math.max(0.05, (yMaxRaw - yMinRaw) * 0.1);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  const plotW = SVG_WIDTH - PAD_L - PAD_R;
  const plotH = SVG_HEIGHT - PAD_T - PAD_B;
  const xScale = (i: number): number => PAD_L + (N <= 1 ? 0 : (i / (N - 1)) * plotW);
  const yScale = (v: number): number =>
    PAD_T + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const scenarioIndex = Math.max(
    0,
    SCENARIOS.findIndex((s) => s.slug === state.scenario),
  );

  const presets = useMemo(
    () =>
      SCENARIOS.map((s) => ({
        name: s.name,
        state: { scenario: s.slug, alpha, sample: 0 } satisfies SfState,
      })),
    [alpha],
  );

  const handlePresetSelect = (next: SfState): void => {
    setState({ scenario: next.scenario, alpha, sample: 0 } as unknown as DemoState);
  };

  const handleAlphaChange = (next: number): void => {
    setState({ ...state, alpha: next } as unknown as DemoState);
  };

  const handleScenarioChange = (nextIdx: number): void => {
    const idx = Math.min(SCENARIOS.length - 1, Math.max(0, Math.round(nextIdx)));
    const picked = SCENARIOS[idx];
    if (!picked) return;
    setState({ scenario: picked.slug, alpha, sample: 0 } as unknown as DemoState);
  };

  const handleReset = (): void => {
    reset();
  };

  const cursorX = xScale(sample);
  const v = {
    gyro: gyroIntegrated[sample] ?? 0,
    acc: scenario.thetaAcc[sample] ?? 0,
    fused: fused[sample] ?? 0,
    truth: scenario.truth[sample] ?? 0,
  };

  return (
    <div className="sf-visualizer">
      <PresetCarousel
        presets={
          presets as unknown as {
            name: string;
            state: SfState;
          }[]
        }
        onSelect={handlePresetSelect}
        initialIndex={scenarioIndex}
        ariaLabel="Sensor fusion scenario presets"
      />

      <div className="sf-visualizer__stage">
        <svg
          className="sf-visualizer__svg"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label={`Sensor fusion time series for ${scenario.name}`}
        >
          {/* axes */}
          <line
            x1={PAD_L}
            y1={SVG_HEIGHT - PAD_B}
            x2={SVG_WIDTH - PAD_R}
            y2={SVG_HEIGHT - PAD_B}
            stroke="#bbb"
          />
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={SVG_HEIGHT - PAD_B} stroke="#bbb" />
          {/* y-axis labels: min, mid, max in degrees */}
          {[yMin, (yMin + yMax) / 2, yMax].map((yv, i) => (
            <g key={`y-${i}`}>
              <text
                x={PAD_L - 6}
                y={yScale(yv) + 4}
                textAnchor="end"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
                fill="#666"
              >
                {(yv * RAD_TO_DEG).toFixed(0)}°
              </text>
            </g>
          ))}
          {/* x-axis labels */}
          <text
            x={PAD_L}
            y={SVG_HEIGHT - 8}
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="#666"
          >
            0
          </text>
          <text
            x={SVG_WIDTH - PAD_R}
            y={SVG_HEIGHT - 8}
            textAnchor="end"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="#666"
          >
            {N - 1}
          </text>

          {/* series (truth → acc → gyro → fused on top) */}
          <SeriesPath
            values={scenario.truth}
            xScale={xScale}
            yScale={yScale}
            color={COLORS.truth}
            width={2}
          />
          <SeriesPath
            values={scenario.thetaAcc}
            xScale={xScale}
            yScale={yScale}
            color={COLORS.acc}
            width={1.25}
          />
          <SeriesPath
            values={gyroIntegrated}
            xScale={xScale}
            yScale={yScale}
            color={COLORS.gyro}
            width={1.25}
            dashed
          />
          <SeriesPath
            values={fused}
            xScale={xScale}
            yScale={yScale}
            color={COLORS.fused}
            width={2.5}
          />

          {/* cursor */}
          <line
            x1={cursorX}
            y1={PAD_T}
            x2={cursorX}
            y2={SVG_HEIGHT - PAD_B}
            stroke={COLORS.cursor}
            strokeOpacity={0.4}
            strokeDasharray="2 3"
          />
        </svg>
      </div>

      <div className="sf-visualizer__legend" aria-hidden="true">
        <span>
          <span
            className="sf-visualizer__legend-swatch"
            style={{ background: COLORS.gyro }}
          />
          Gyro-integrated
        </span>
        <span>
          <span
            className="sf-visualizer__legend-swatch"
            style={{ background: COLORS.acc }}
          />
          Accelerometer
        </span>
        <span>
          <span
            className="sf-visualizer__legend-swatch"
            style={{ background: COLORS.fused }}
          />
          Fused
        </span>
        <span>
          <span
            className="sf-visualizer__legend-swatch"
            style={{ background: COLORS.truth }}
          />
          Truth
        </span>
      </div>

      <div className="sf-visualizer__hud" aria-live="polite">
        {`${scenario.name} · α=${alpha.toFixed(2)} · sample ${sample}`}
        {` | gyro=${v.gyro.toFixed(3)} acc=${v.acc.toFixed(3)} fused=${v.fused.toFixed(3)} truth=${v.truth.toFixed(3)} rad`}
      </div>

      <div className="sf-visualizer__controls">
        <SliderRow
          label="Alpha (gyro weight)"
          description="α near 1 trusts the gyro short-term; 1−α leans on the accelerometer."
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={handleAlphaChange}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Scenario"
          min={0}
          max={Math.max(SCENARIOS.length - 1, 1)}
          step={1}
          value={scenarioIndex}
          onChange={handleScenarioChange}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Sample"
          min={0}
          max={Math.max(N - 1, 1)}
          step={1}
          value={sample}
          onChange={(next) =>
            setState({ ...state, sample: Math.round(next) } as unknown as DemoState)
          }
          format={{ precision: 0 }}
        />
      </div>

      <div className="sf-visualizer__actions">
        <button
          type="button"
          className="sf-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset sensor fusion"
        >
          ↺ Reset
        </button>
        <span className="sf-visualizer__counter" aria-live="off">
          {`RMS error: vs truth = ${rms.toFixed(4)} rad`}
        </span>
      </div>
    </div>
  );
}
