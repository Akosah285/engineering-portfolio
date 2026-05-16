import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type InstantRpm,
  instantRpmFromPulses,
  movingAverageRpm,
  windowedRpm,
} from "./algorithm";
import { DEFAULT_STATE, PRESETS, type RpmDemoState } from "./presets";
import "./RpmVisualizer.css";

/**
 * <RpmVisualizer> — embedded-systems demo for converting encoder pulses
 * into a velocity estimate. Two side-by-side panels: a tachometer dial
 * with a needle pointing at the current windowed estimate, and an
 * RPM-vs-time plot overlaying raw instant samples, a windowed line,
 * and a moving-average dashed line.
 */

const DURATION_SEC = 2;
const MAX_RPM = 6000;
const SAMPLE_STEP = 0.02;

const STATE_SCHEMA = {
  trueRpm: { type: "number", default: DEFAULT_STATE.trueRpm },
  ppr: { type: "number", default: DEFAULT_STATE.ppr },
  windowSec: { type: "number", default: DEFAULT_STATE.windowSec },
  N: { type: "number", default: DEFAULT_STATE.N },
  noisePct: { type: "number", default: DEFAULT_STATE.noisePct },
} as const satisfies Schema;

/**
 * Deterministic Mulberry32 PRNG so the simulated pulse train is stable
 * across re-renders for the same control values. Returns a function that
 * yields uniformly-distributed numbers in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller — two uniforms → one standard-normal sample.
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Synthesise a pulse train for a motor turning at `trueRpm` with `ppr`
 * pulses per rev, sampled across [0, DURATION_SEC]. Each pulse timestamp
 * is jittered by Gaussian noise proportional to the nominal period.
 *
 * Returned array is strictly increasing — duplicates / out-of-order
 * samples are nudged by epsilon so the algorithm's preconditions hold.
 */
function simulatePulseTimes(
  trueRpm: number,
  ppr: number,
  noisePct: number,
  seed: number,
): number[] {
  const period = 60 / (trueRpm * ppr);
  if (!Number.isFinite(period) || period <= 0) return [];
  const nPulses = Math.floor(DURATION_SEC / period) + 1;
  if (nPulses <= 1) return [];

  const rng = mulberry32(seed);
  const sigma = (noisePct / 100) * period;
  const raw: number[] = new Array(nPulses);
  for (let k = 0; k < nPulses; k++) {
    const jitter = sigma > 0 ? gaussian(rng) * sigma : 0;
    raw[k] = period * k + jitter;
  }
  raw.sort((a, b) => a - b);

  const eps = Math.max(period * 1e-6, 1e-9);
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]!;
    if (t < 0) continue;
    if (t > DURATION_SEC) break;
    const prev = out.length > 0 ? out[out.length - 1]! : Number.NEGATIVE_INFINITY;
    out.push(t <= prev ? prev + eps : t);
  }
  return out;
}

function findRpmAt(series: readonly InstantRpm[], cursor: number): number | null {
  if (series.length === 0) return null;
  // Last sample with t <= cursor.
  let last: InstantRpm | null = null;
  for (const s of series) {
    if (s.t <= cursor) last = s;
    else break;
  }
  return last ? last.rpm : null;
}

/** Project an RPM value into a needle angle on the dial (sweep 240°). */
function rpmToAngle(rpm: number): number {
  const clamped = Math.max(0, Math.min(MAX_RPM, rpm));
  const t = clamped / MAX_RPM;
  // Sweep from 150° (bottom-left) counter-clockwise to -30° (bottom-right).
  const startDeg = 150;
  const endDeg = -30;
  const deg = startDeg + (endDeg - startDeg) * t;
  return (deg * Math.PI) / 180;
}

function paintDial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rpm: number,
): void {
  // Arc backdrop
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#e5e5e5";
  ctx.beginPath();
  ctx.arc(x, y, radius, rpmToAngle(0), rpmToAngle(MAX_RPM), true);
  ctx.stroke();

  // Filled "value" arc
  const valueRpm = Math.max(0, Math.min(MAX_RPM, rpm));
  ctx.strokeStyle = "#00693e";
  ctx.beginPath();
  ctx.arc(x, y, radius, rpmToAngle(0), rpmToAngle(valueRpm), true);
  ctx.stroke();

  // Tick marks at every 1000 RPM
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  for (let r = 0; r <= MAX_RPM; r += 1000) {
    const a = rpmToAngle(r);
    const x0 = x + Math.cos(a) * (radius - 14);
    const y0 = y + Math.sin(a) * (radius - 14);
    const x1 = x + Math.cos(a) * (radius - 4);
    const y1 = y + Math.sin(a) * (radius - 4);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Needle
  const a = rpmToAngle(valueRpm);
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * (radius - 18), y + Math.sin(a) * (radius - 18));
  ctx.stroke();

  // Hub
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Digital readout
  ctx.fillStyle = "#222";
  ctx.font = "bold 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.round(valueRpm)} RPM`, x, y + radius * 0.35);
}

function paintPlot(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  instant: readonly InstantRpm[],
  windowed: readonly InstantRpm[],
  movingAvg: readonly InstantRpm[],
  cursor: number,
): void {
  const { x, y, w, h } = bounds;

  // Frame + axes
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#bbb";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const toX = (t: number): number => x + (t / DURATION_SEC) * w;
  const toY = (rpm: number): number => {
    const clamped = Math.max(0, Math.min(MAX_RPM, rpm));
    return y + h - (clamped / MAX_RPM) * h;
  };

  // Y gridlines at every 1000 RPM
  ctx.strokeStyle = "#eee";
  for (let r = 1000; r < MAX_RPM; r += 1000) {
    const yy = toY(r);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }

  // Scatter — raw instant samples
  ctx.fillStyle = "rgba(207, 79, 79, 0.7)";
  for (const s of instant) {
    ctx.beginPath();
    ctx.arc(toX(s.t), toY(s.rpm), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Solid line — windowed
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  windowed.forEach((s, i) => {
    const px = toX(s.t);
    const py = toY(s.rpm);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Dashed line — moving average
  ctx.strokeStyle = "#1f5fd1";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  movingAvg.forEach((s, i) => {
    const px = toX(s.t);
    const py = toY(s.rpm);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Cursor
  const cx = toX(cursor);
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + h);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#444";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("RPM vs time", x + 6, y + 4);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${DURATION_SEC.toFixed(1)} s`, x + w - 4, y + h - 2);
}

export default function RpmVisualizer() {
  const [state, setState, { reset }] = useDemoState("rpm", STATE_SCHEMA, DEFAULT_STATE);

  // Derived series — recomputed only when controls change.
  const { instant, windowed, movingAvg, pulseTimes } = useMemo(() => {
    // Combine controls into a seed so noise is deterministic per config.
    const seed =
      Math.round(state.trueRpm) * 1009 +
      Math.round(state.ppr) * 31 +
      Math.round(state.noisePct);
    const pulses = simulatePulseTimes(state.trueRpm, state.ppr, state.noisePct, seed);

    let inst: InstantRpm[] = [];
    try {
      inst = instantRpmFromPulses(pulses, state.ppr);
    } catch {
      inst = [];
    }

    const sampleTimes: number[] = [];
    const tEnd = Math.max(0, DURATION_SEC - state.windowSec);
    for (let t = 0; t <= tEnd + 1e-9; t += SAMPLE_STEP) {
      sampleTimes.push(Math.min(t, tEnd));
    }

    let win: InstantRpm[] = [];
    try {
      win = windowedRpm(pulses, state.ppr, state.windowSec, sampleTimes);
    } catch {
      win = [];
    }

    let mavg: InstantRpm[] = [];
    try {
      mavg = movingAverageRpm(inst, Math.max(1, Math.round(state.N)));
    } catch {
      mavg = [];
    }

    return { instant: inst, windowed: win, movingAvg: mavg, pulseTimes: pulses };
  }, [state.trueRpm, state.ppr, state.windowSec, state.N, state.noisePct]);

  // Animated cursor that sweeps across the simulation window.
  const cursorRef = useMemo(() => ({ t: 0 }), []);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;

      // Clear
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Advance cursor (loop every DURATION_SEC).
      cursorRef.t = (cursorRef.t + deltaMs / 1000) % DURATION_SEC;

      // Dial panel — left half
      const dialCx = width * 0.25;
      const dialCy = height * 0.55;
      const dialR = Math.min(width * 0.2, height * 0.4);
      const needleRpm =
        findRpmAt(windowed, cursorRef.t) ?? findRpmAt(movingAvg, cursorRef.t) ?? 0;
      paintDial(ctx, dialCx, dialCy, dialR, needleRpm);

      // Plot panel — right half
      const plotX = width * 0.5;
      const plotY = 24;
      const plotW = width * 0.48 - 8;
      const plotH = height - 48;
      paintPlot(
        ctx,
        { x: plotX, y: plotY, w: plotW, h: plotH },
        instant,
        windowed,
        movingAvg,
        cursorRef.t,
      );

      // Panel headings
      ctx.fillStyle = "#222";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Tachometer", dialCx, 8);
    },
    [instant, windowed, movingAvg, cursorRef],
  );

  // For HUD + counter we sample the series at the latest cursor time.
  // (Re-rendering on every animation frame would be wasteful, so use a
  //  midpoint sample that updates only when controls change.)
  const summary = useMemo(() => {
    const probeT = DURATION_SEC * 0.6;
    return {
      instantRpm: findRpmAt(instant, probeT),
      windowedRpm: findRpmAt(windowed, probeT),
      movingAvgRpm: findRpmAt(movingAvg, probeT),
      pulseCount: pulseTimes.length,
    };
  }, [instant, windowed, movingAvg, pulseTimes]);

  const fmt = (v: number | null): string => (v === null ? "—" : `${v.toFixed(0)}`);

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const presetsForCarousel = useMemo<{ name: string; state: RpmDemoState }[]>(
    () => PRESETS.map((p) => ({ name: p.name, state: p.state })),
    [],
  );

  return (
    <div className="rpm-visualizer">
      <PresetCarousel
        presets={presetsForCarousel}
        onSelect={handlePresetSelect}
        ariaLabel="RPM visualiser presets"
      />

      <div className="rpm-visualizer__stage">
        <DemoCanvas
          width={720}
          height={360}
          ariaLabel="Tachometer dial and RPM-vs-time plot"
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{instant} = ${fmt(summary.instantRpm)}\\ \\text{RPM}`,
            `\\text{windowed} = ${fmt(summary.windowedRpm)}\\ \\text{RPM}`,
            `\\text{avg} = ${fmt(summary.movingAvgRpm)}\\ \\text{RPM}`,
            `\\text{PPR} = ${state.ppr}`,
          ]}
        />
      </div>

      <div className="rpm-visualizer__controls">
        <SliderRow
          label="True RPM"
          description="Ground-truth motor speed driving the simulated encoder."
          min={60}
          max={6000}
          step={60}
          value={state.trueRpm}
          onChange={(trueRpm) => setState({ ...state, trueRpm })}
          format={{ precision: 0, unit: "RPM" }}
        />
        <SliderRow
          label="PPR (pulses per rev)"
          description="Encoder resolution. Higher PPR → more pulses to time."
          min={1}
          max={64}
          step={1}
          value={state.ppr}
          onChange={(ppr) => setState({ ...state, ppr })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Window (frequency method)"
          description="Pulse-counting window. Longer → smoother, slower."
          min={0.05}
          max={1.0}
          step={0.05}
          value={state.windowSec}
          onChange={(windowSec) => setState({ ...state, windowSec })}
          format={{ precision: 2, unit: "s" }}
        />
        <SliderRow
          label="N (moving average)"
          description="How many recent instant samples to average."
          min={1}
          max={20}
          step={1}
          value={state.N}
          onChange={(N) => setState({ ...state, N })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Noise"
          description="Per-pulse Gaussian jitter as a fraction of the nominal period."
          min={0}
          max={20}
          step={1}
          value={state.noisePct}
          onChange={(noisePct) => setState({ ...state, noisePct })}
          format={{ precision: 0, unit: "%" }}
        />
      </div>

      <div className="rpm-visualizer__actions">
        <button type="button" className="rpm-visualizer__btn" onClick={() => reset()}>
          ↺ Reset
        </button>
        <span className="rpm-visualizer__counter" aria-live="off">
          instant {fmt(summary.instantRpm)} RPM · windowed {fmt(summary.windowedRpm)} RPM
          · avg {fmt(summary.movingAvgRpm)} RPM
        </span>
      </div>
    </div>
  );
}
