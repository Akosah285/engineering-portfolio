import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type BodePoint, bodePlot, logspace } from "./algorithm";
import {
  type BodeDemoState,
  DEFAULT_STATE,
  PRESETS,
  TF_SLUGS,
  getTfPreset,
} from "./presets";
import "./BodePlotVisualizer.css";

/**
 * <BodePlotVisualizer> — frequency-response shell for the Bode algorithm (#111).
 *
 * Wires the demo-kit primitives around the pure `bodePlot` core so users can
 * pick a named transfer function, choose the decade range, and watch how the
 * pole/zero structure shapes magnitude and phase on a stacked log-x plot.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const MAG_TOP = 0;
const MAG_BOTTOM = 180;
const PHASE_TOP = 180;
const PHASE_BOTTOM = 360;
const PHASE_MIN = -200;
const PHASE_MAX = 200;

const STATE_SCHEMA = {
  tfSlug: {
    type: "enum",
    default: DEFAULT_STATE.tfSlug,
    values: TF_SLUGS,
  },
  startDecade: { type: "number", default: DEFAULT_STATE.startDecade },
  endDecade: { type: "number", default: DEFAULT_STATE.endDecade },
  pointsPerDecade: { type: "number", default: DEFAULT_STATE.pointsPerDecade },
} as const satisfies Schema;

const narrationTemplate = (state: BodeDemoState): string => {
  const preset = getTfPreset(state.tfSlug);
  return `Bode plot of the ${preset.name} transfer function — magnitude and phase frequency response from 10^${state.startDecade} to 10^${state.endDecade} rad/s, sampled at ${state.pointsPerDecade} points per decade.`;
};

/** Auto-fit a [min, max] window around the magnitude trace, with padding. */
function magWindow(points: readonly BodePoint[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (!Number.isFinite(p.magnitudeDb)) continue;
    if (p.magnitudeDb < min) min = p.magnitudeDb;
    if (p.magnitudeDb > max) max = p.magnitudeDb;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: -60, max: 20 };
  }
  if (max - min < 10) {
    const c = (max + min) / 2;
    min = c - 10;
    max = c + 10;
  }
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}

/** First ω at which magnitude drops below (max − 3 dB). */
function bandwidth(points: readonly BodePoint[]): number | null {
  let peak = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (Number.isFinite(p.magnitudeDb) && p.magnitudeDb > peak) {
      peak = p.magnitudeDb;
    }
  }
  if (!Number.isFinite(peak)) return null;
  const threshold = peak - 3;
  let seenAtOrAbove = false;
  for (const p of points) {
    if (!Number.isFinite(p.magnitudeDb)) continue;
    if (p.magnitudeDb >= threshold) {
      seenAtOrAbove = true;
    } else if (seenAtOrAbove) {
      return p.omega;
    }
  }
  return null;
}

export function BodePlotVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "bode-plot",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const preset = useMemo(() => getTfPreset(state.tfSlug), [state.tfSlug]);

  const omegas = useMemo(
    () =>
      logspace(
        Math.min(state.startDecade, state.endDecade),
        Math.max(state.startDecade, state.endDecade),
        state.pointsPerDecade,
      ),
    [state.startDecade, state.endDecade, state.pointsPerDecade],
  );

  const points = useMemo(() => bodePlot(preset.tf, omegas), [preset, omegas]);
  const mag = useMemo(() => magWindow(points), [points]);
  const bw = useMemo(() => bandwidth(points), [points]);

  const startDec = Math.min(state.startDecade, state.endDecade);
  const endDec = Math.max(state.startDecade, state.endDecade);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const xFor = (omega: number): number => {
        if (omega <= 0) return 0;
        const span = endDec - startDec || 1;
        return ((Math.log10(omega) - startDec) / span) * width;
      };
      const yMag = (db: number): number => {
        const range = mag.max - mag.min || 1;
        const t = (db - mag.min) / range;
        return MAG_TOP + (1 - t) * (MAG_BOTTOM - MAG_TOP);
      };
      const yPhase = (deg: number): number => {
        const t = (deg - PHASE_MIN) / (PHASE_MAX - PHASE_MIN);
        return PHASE_TOP + (1 - t) * (PHASE_BOTTOM - PHASE_TOP);
      };

      // Panel backgrounds + separator
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(0, PHASE_TOP, width, PHASE_BOTTOM - PHASE_TOP);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, PHASE_TOP);
      ctx.lineTo(width, PHASE_TOP);
      ctx.stroke();

      // Vertical grid at each decade
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      for (let d = Math.ceil(startDec); d <= Math.floor(endDec); d += 1) {
        const x = xFor(10 ** d);
        ctx.beginPath();
        ctx.moveTo(x, MAG_TOP);
        ctx.lineTo(x, PHASE_BOTTOM);
        ctx.stroke();
      }

      // Horizontal grid: magnitude every 20 dB
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      const dbStart = Math.ceil(mag.min / 20) * 20;
      for (let db = dbStart; db <= mag.max; db += 20) {
        const y = yMag(db);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // Horizontal grid: phase every 45 deg
      for (let p = -180; p <= 180; p += 45) {
        const y = yPhase(p);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Magnitude curve (blue)
      ctx.strokeStyle = "#1f6feb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (const p of points) {
        if (!Number.isFinite(p.magnitudeDb)) {
          started = false;
          continue;
        }
        const x = xFor(p.omega);
        const y = yMag(p.magnitudeDb);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Phase curve (orange)
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 2;
      ctx.beginPath();
      started = false;
      for (const p of points) {
        if (!Number.isFinite(p.phaseDeg)) {
          started = false;
          continue;
        }
        const x = xFor(p.omega);
        const y = yPhase(p.phaseDeg);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    },
    [points, mag, startDec, endDec],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: BodeDemoState): void => {
    setState(next);
  };

  const bwLabel = bw === null ? "n/a" : `${bw.toExponential(2).replace("e+", "e")} rad/s`;

  return (
    <div className="bo-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: BodeDemoState }[] as {
            name: string;
            state: BodeDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Bode plot presets"
      />

      <div className="bo-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`Bode magnitude and phase plot of the ${preset.name} transfer function`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[`points = ${points.length}`, `bandwidth ≈ ${bwLabel}`]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="bo-visualizer__controls">
        <SliderRow
          label="Start decade"
          description="Lowest frequency 10^start (rad/s) on the log axis."
          min={-2}
          max={2}
          step={1}
          value={state.startDecade}
          onChange={(startDecade) => setState({ ...state, startDecade })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="End decade"
          description="Highest frequency 10^end (rad/s) on the log axis."
          min={1}
          max={5}
          step={1}
          value={state.endDecade}
          onChange={(endDecade) => setState({ ...state, endDecade })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Points per decade"
          description="Sample density. More points → smoother curve, more compute."
          min={5}
          max={50}
          step={5}
          value={state.pointsPerDecade}
          onChange={(pointsPerDecade) => setState({ ...state, pointsPerDecade })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="bo-visualizer__actions">
        <button type="button" className="bo-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="bo-visualizer__counter" aria-live="off">
          {points.length} points
        </span>
      </div>
    </div>
  );
}
