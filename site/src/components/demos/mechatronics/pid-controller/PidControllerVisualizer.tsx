import { useCallback, useEffect, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type PidState, createPidState, pidStep } from "./algorithm";
import { DEFAULT_STATE, PRESETS, type PidDemoState } from "./presets";
import "./PidControllerVisualizer.css";

/**
 * <PidControllerVisualizer> — PID controller driving a first-order plant.
 *
 * Plant model: dy/dt = (u - y) / tau, Euler-discretised at fixed dt = 0.01s.
 * The top half of the canvas plots the setpoint (red dashed) and the
 * plant measurement (green) over the last WINDOW_SEC seconds; the bottom
 * half plots the controller output u (blue) on a centred axis.
 */

const DT = 0.01;
const WINDOW_SEC = 10;
const MAX_SAMPLES = Math.ceil(WINDOW_SEC / DT) + 4;
const STEPS_PER_FRAME_CAP = 50;

const STATE_SCHEMA = {
  kp: { type: "number", default: DEFAULT_STATE.kp },
  ki: { type: "number", default: DEFAULT_STATE.ki },
  kd: { type: "number", default: DEFAULT_STATE.kd },
  setpoint: { type: "number", default: DEFAULT_STATE.setpoint },
  tau: { type: "number", default: DEFAULT_STATE.tau },
} as const satisfies Schema;

interface Sample {
  t: number;
  y: number;
  u: number;
  sp: number;
}

const narrationTemplate = (state: PidDemoState): string =>
  `PID controller with gains Kp=${state.kp.toFixed(2)}, Ki=${state.ki.toFixed(2)}, Kd=${state.kd.toFixed(2)} tracking a setpoint of ${state.setpoint.toFixed(2)} on a first-order plant with time constant τ=${state.tau.toFixed(2)}s. Watch how the measurement approaches the setpoint and how the controller output responds to error.`;

function paintTimeSeries(
  ctx: CanvasRenderingContext2D,
  samples: readonly Sample[],
  currentT: number,
  setpoint: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, width, height);

  const topH = Math.floor(height / 2);
  const botY = topH;
  const botH = height - topH;

  // Divider
  ctx.strokeStyle = "#d6d3c4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, topH);
  ctx.lineTo(width, topH);
  ctx.stroke();

  const tMin = currentT - WINDOW_SEC;
  const tMax = currentT;
  const xOf = (t: number): number => ((t - tMin) / WINDOW_SEC) * width;

  // ---- Top panel: setpoint + measurement -----------------------------
  // Y range covers setpoint ±2 with a sensible floor so 0 is visible.
  const yPad = 0.5;
  let yLo = Math.min(setpoint, 0) - yPad;
  let yHi = Math.max(setpoint, 0) + yPad;
  for (const s of samples) {
    if (s.t < tMin) continue;
    if (s.y < yLo) yLo = s.y - yPad;
    if (s.y > yHi) yHi = s.y + yPad;
  }
  const yRange = yHi - yLo || 1;
  const yToCanvas = (y: number): number => topH - ((y - yLo) / yRange) * topH;

  // Zero line
  if (yLo <= 0 && yHi >= 0) {
    ctx.strokeStyle = "#e6e2d3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yToCanvas(0));
    ctx.lineTo(width, yToCanvas(0));
    ctx.stroke();
  }

  // Setpoint (red dashed)
  ctx.strokeStyle = "#cf4f4f";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, yToCanvas(setpoint));
  ctx.lineTo(width, yToCanvas(setpoint));
  ctx.stroke();
  ctx.setLineDash([]);

  // Measurement (green)
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (const s of samples) {
    if (s.t < tMin) continue;
    const cx = xOf(s.t);
    const cy = yToCanvas(s.y);
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();

  // ---- Bottom panel: controller output u ----------------------------
  let uLo = -1;
  let uHi = 1;
  for (const s of samples) {
    if (s.t < tMin) continue;
    if (s.u < uLo) uLo = s.u;
    if (s.u > uHi) uHi = s.u;
  }
  const uPad = (uHi - uLo) * 0.1 || 0.5;
  uLo -= uPad;
  uHi += uPad;
  const uRange = uHi - uLo || 1;
  const uToCanvas = (u: number): number => botY + botH - ((u - uLo) / uRange) * botH;

  // Zero baseline for u
  if (uLo <= 0 && uHi >= 0) {
    ctx.strokeStyle = "#e6e2d3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, uToCanvas(0));
    ctx.lineTo(width, uToCanvas(0));
    ctx.stroke();
  }

  ctx.strokeStyle = "#2b6cb0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  started = false;
  for (const s of samples) {
    if (s.t < tMin) continue;
    const cx = xOf(s.t);
    const cy = uToCanvas(s.u);
    if (!started) {
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
}

export function PidControllerVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "pid-controller",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  // Simulation state lives in refs so the draw loop doesn't re-render React.
  const samplesRef = useRef<Sample[]>([{ t: 0, y: 0, u: 0, sp: state.setpoint }]);
  const pidStateRef = useRef<PidState>(createPidState());
  const measurementRef = useRef(0);
  const timeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const latestRef = useRef({ error: state.setpoint, u: 0 });

  const [paused, setPaused] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  const resetSim = useCallback((sp: number) => {
    samplesRef.current = [{ t: 0, y: 0, u: 0, sp }];
    pidStateRef.current = createPidState();
    measurementRef.current = 0;
    timeRef.current = 0;
    accumulatorRef.current = 0;
    latestRef.current = { error: sp, u: 0 };
    setDisplayTime(0);
  }, []);

  // Reset whenever any control changes (gains, setpoint, or plant tau).
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger deps; body only reads state.setpoint and resetSim (both listed); other state.* are trigger-only
  useEffect(() => {
    resetSim(state.setpoint);
  }, [state.kp, state.ki, state.kd, state.setpoint, state.tau, resetSim]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      accumulatorRef.current += deltaMs / 1000;
      let steps = 0;
      while (accumulatorRef.current >= DT && steps < STEPS_PER_FRAME_CAP) {
        accumulatorRef.current -= DT;
        steps += 1;

        const y = measurementRef.current;
        const result = pidStep({
          setpoint: state.setpoint,
          measurement: y,
          dt: DT,
          gains: { kp: state.kp, ki: state.ki, kd: state.kd },
          state: pidStateRef.current,
        });
        pidStateRef.current = result.nextState;
        const u = result.output;

        // First-order plant: y_new = y + dt * (u - y) / tau
        const tau = Math.max(state.tau, 1e-6);
        const yNext = y + (DT * (u - y)) / tau;
        measurementRef.current = yNext;
        timeRef.current += DT;

        const buf = samplesRef.current;
        buf.push({ t: timeRef.current, y: yNext, u, sp: state.setpoint });
        if (buf.length > MAX_SAMPLES) buf.shift();

        latestRef.current = { error: state.setpoint - yNext, u };
      }

      if (steps > 0) {
        setDisplayTime(timeRef.current);
      }

      paintTimeSeries(ctx, samplesRef.current, timeRef.current, state.setpoint);
    },
    [state.kp, state.ki, state.kd, state.setpoint, state.tau],
  );

  const handleReset = (): void => {
    reset();
    resetSim(DEFAULT_STATE.setpoint);
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const { error, u } = latestRef.current;

  return (
    <div className="pid-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="PID controller presets"
      />

      <div className="pid-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`PID controller tracking setpoint ${state.setpoint.toFixed(2)} on a first-order plant`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[`\\text{error} = ${error.toFixed(3)}`, `u = ${u.toFixed(2)}`]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="pid-visualizer__controls">
        <SliderRow
          label="Kp (proportional)"
          description="Reacts to current error. Bigger = stiffer response, but can oscillate."
          min={0}
          max={10}
          step={0.1}
          value={state.kp}
          onChange={(kp) => setState({ ...state, kp })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Ki (integral)"
          description="Eliminates steady-state offset by accumulating past error."
          min={0}
          max={5}
          step={0.1}
          value={state.ki}
          onChange={(ki) => setState({ ...state, ki })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Kd (derivative)"
          description="Damps response by reacting to the rate of change of error."
          min={0}
          max={2}
          step={0.05}
          value={state.kd}
          onChange={(kd) => setState({ ...state, kd })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Setpoint"
          description="Target value the plant should track."
          min={-2}
          max={2}
          step={0.1}
          value={state.setpoint}
          onChange={(setpoint) => setState({ ...state, setpoint })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Tau (plant time constant)"
          description="First-order plant lag in seconds. Larger τ = slower plant."
          min={0.1}
          max={5}
          step={0.1}
          value={state.tau}
          onChange={(tau) => setState({ ...state, tau })}
          format={{ precision: 2 }}
        />
      </div>

      <div className="pid-visualizer__actions">
        <button
          type="button"
          className="pid-visualizer__btn pid-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="pid-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="pid-visualizer__counter" aria-live="off">
          t = {displayTime.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
