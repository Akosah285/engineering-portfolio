import { useCallback, useEffect, useRef, useState } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { emfRotating, peakEmf } from "./algorithm";
import { DEFAULT_STATE, type FaradayDemoState, PRESETS } from "./presets";
import "./FaradayVisualizer.css";

/**
 * <FaradayVisualizer> — visual shell around the pure Faraday algorithm.
 *
 * Two panels: (a) a coil rotating in a uniform horizontal B field;
 * (b) stacked plots of Φ(t) and ε(t) over a single rotation period.
 */

const STATE_SCHEMA = {
  N: { type: "number", default: DEFAULT_STATE.N },
  B: { type: "number", default: DEFAULT_STATE.B },
  A: { type: "number", default: DEFAULT_STATE.A },
  omega: { type: "number", default: DEFAULT_STATE.omega },
} as const satisfies Schema;

const COIL_W = 320;
const COIL_H = 260;
const PLOT_W = 320;
const PLOT_H = 260;
const SAMPLES = 100;

function paintCoil(ctx: CanvasRenderingContext2D, theta: number): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  // Field arrows (horizontal, →) across the panel.
  ctx.strokeStyle = "#9aa0a6";
  ctx.fillStyle = "#9aa0a6";
  ctx.lineWidth = 1;
  const rows = 6;
  for (let r = 0; r < rows; r += 1) {
    const y = ((r + 0.5) / rows) * height;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(width - 14, y);
    ctx.stroke();
    // arrow head
    ctx.beginPath();
    ctx.moveTo(width - 14, y);
    ctx.lineTo(width - 20, y - 4);
    ctx.lineTo(width - 20, y + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Rotation axis (horizontal through coil centre).
  const cx = width / 2;
  const cy = height / 2;
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 90, cy);
  ctx.lineTo(cx + 90, cy);
  ctx.stroke();

  // Coil seen edge-on: tilted ellipse whose minor axis = |cos(theta)| * R.
  const R = 70;
  const rxMinor = Math.max(2, Math.abs(Math.cos(theta)) * R);
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rxMinor, R, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Indicate the front/back ends with two small dots; flip with sign(cos).
  const sign = Math.cos(theta) >= 0 ? 1 : -1;
  ctx.fillStyle = "#00693e";
  ctx.beginPath();
  ctx.arc(cx + sign * rxMinor, cy - R + 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - sign * rxMinor, cy + R - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Label B field.
  ctx.fillStyle = "#555";
  ctx.font = "12px sans-serif";
  ctx.fillText("B →", 8, 14);
}

function paintPlots(
  ctx: CanvasRenderingContext2D,
  state: FaradayDemoState,
  tNow: number,
  period: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  const padL = 36;
  const padR = 8;
  const padT = 14;
  const padB = 16;
  const plotW = width - padL - padR;
  const halfH = (height - padT - padB) / 2;

  // Sample Φ(t) and ε(t) over one period.
  const N = state.N;
  const B = state.B;
  const A = state.A;
  const omega = state.omega;
  const NBA = N * B * A;
  const peak = Math.abs(NBA * omega);
  const phiPeak = Math.abs(NBA) || 1;
  const emfPeak = peak || 1;

  const drawAxes = (yTop: number, title: string): void => {
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, yTop);
    ctx.lineTo(padL, yTop + 2 * halfH);
    ctx.moveTo(padL, yTop + halfH);
    ctx.lineTo(padL + plotW, yTop + halfH);
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "11px sans-serif";
    ctx.fillText(title, padL + 4, yTop + 10);
  };

  const phiTop = padT;
  const emfTop = padT + 2 * halfH + 4; // small gap... but we use stacked halves
  // Actually two stacked plots, each of full height/2.
  const halfHsingle = (height - padT - padB) / 2 - 4;
  const phiY0 = padT + halfHsingle / 2;
  const emfY0 = padT + halfHsingle + 8 + halfHsingle / 2;

  // Φ axes
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + halfHsingle);
  ctx.moveTo(padL, phiY0);
  ctx.lineTo(padL + plotW, phiY0);
  ctx.stroke();
  ctx.fillStyle = "#555";
  ctx.font = "11px sans-serif";
  ctx.fillText("Φ(t)", padL + 4, padT + 10);

  // ε axes
  ctx.beginPath();
  ctx.moveTo(padL, padT + halfHsingle + 8);
  ctx.lineTo(padL, padT + 2 * halfHsingle + 8);
  ctx.moveTo(padL, emfY0);
  ctx.lineTo(padL + plotW, emfY0);
  ctx.stroke();
  ctx.fillText("ε(t)", padL + 4, padT + halfHsingle + 18);

  // suppress unused warning from earlier helper
  void drawAxes;
  void phiTop;
  void emfTop;

  // Plot Φ(t) = NBA cos(ωt).
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = (i / SAMPLES) * period;
    const phi = NBA * Math.cos(omega * t);
    const x = padL + (i / SAMPLES) * plotW;
    const y = phiY0 - (phi / phiPeak) * (halfHsingle / 2 - 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Plot ε(t).
  ctx.strokeStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = (i / SAMPLES) * period;
    const e = emfRotating(N, B, A, omega, t);
    const x = padL + (i / SAMPLES) * plotW;
    const y = emfY0 - (e / emfPeak) * (halfHsingle / 2 - 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Cursor dots at tNow.
  const frac = period > 0 ? (tNow % period) / period : 0;
  const cx = padL + frac * plotW;
  const phiCur = NBA * Math.cos(omega * tNow);
  const eCur = emfRotating(N, B, A, omega, tNow);
  ctx.fillStyle = "#00693e";
  ctx.beginPath();
  ctx.arc(cx, phiY0 - (phiCur / phiPeak) * (halfHsingle / 2 - 2), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cf4f4f";
  ctx.beginPath();
  ctx.arc(cx, emfY0 - (eCur / emfPeak) * (halfHsingle / 2 - 2), 4, 0, Math.PI * 2);
  ctx.fill();
}

export default function FaradayVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "faraday",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const coilRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [, forceTick] = useState(0);

  const period = (2 * Math.PI) / Math.max(1e-6, state.omega);
  const peak = peakEmf(Math.max(1, Math.round(state.N)), state.B, state.A, state.omega);

  const draw = useCallback(() => {
    const coil = coilRef.current;
    const plot = plotRef.current;
    if (coil) {
      const ctx = coil.getContext("2d");
      if (ctx) paintCoil(ctx, state.omega * tRef.current);
    }
    if (plot) {
      const ctx = plot.getContext("2d");
      if (ctx) paintPlots(ctx, state, tRef.current, period);
    }
  }, [state, period]);

  useEffect(() => {
    const step = (now: number): void => {
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      const dt = last == null ? 0 : (now - last) / 1000;
      tRef.current = (tRef.current + dt) % Math.max(1e-6, period);
      draw();
      // Nudge React occasionally so HUD/counter reflect t-driven values.
      forceTick((c) => (c + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [draw, period]);

  const handleReset = (): void => {
    reset();
    tRef.current = 0;
  };

  return (
    <div className="far-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: FaradayDemoState }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={(next) => setState(next)}
        ariaLabel="Faraday presets"
      />

      <div className="far-visualizer__stage">
        <div className="far-visualizer__panel">
          <p className="far-visualizer__panel-title">Rotating coil in uniform B</p>
          <canvas
            ref={coilRef}
            className="far-visualizer__canvas"
            width={COIL_W}
            height={COIL_H}
            aria-label="Coil rotating in a uniform magnetic field"
          />
        </div>
        <div className="far-visualizer__panel">
          <p className="far-visualizer__panel-title">Φ(t) and ε(t) over one period</p>
          <canvas
            ref={plotRef}
            className="far-visualizer__canvas"
            width={PLOT_W}
            height={PLOT_H}
            aria-label="Flux and induced EMF versus time"
          />
        </div>
      </div>

      <div className="far-visualizer__controls">
        <SliderRow
          label="N (turns)"
          description="Number of loops in the coil. EMF scales linearly with N."
          min={1}
          max={500}
          step={10}
          value={state.N}
          onChange={(N) => setState({ ...state, N })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="B (field)"
          description="Uniform field strength."
          min={0.01}
          max={2.0}
          step={0.05}
          value={state.B}
          onChange={(B) => setState({ ...state, B })}
          format={{ precision: 2, unit: "T" }}
        />
        <SliderRow
          label="A (area)"
          description="Loop area enclosing the flux."
          min={0.001}
          max={0.5}
          step={0.005}
          value={state.A}
          onChange={(A) => setState({ ...state, A })}
          format={{ precision: 3, unit: "m²" }}
        />
        <SliderRow
          label="ω (omega, angular freq)"
          description="Rotation rate. Peak EMF = N·B·A·ω."
          min={1}
          max={200}
          step={5}
          value={state.omega}
          onChange={(omega) => setState({ ...state, omega })}
          format={{ precision: 0, unit: "rad/s" }}
        />
      </div>

      <div className="far-visualizer__actions">
        <button type="button" className="far-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="far-visualizer__counter" aria-live="off">
          peak ε = {peak.toFixed(3)} V · period T = {period.toFixed(3)} s
        </span>
      </div>
    </div>
  );
}
