import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Light, type Phase, type Plan, planSequence, stateAt } from "./algorithm";
import {
  DEFAULT_STATE,
  MODE_SLUGS,
  PRESETS,
  type TrafficLightDemoState,
} from "./presets";
import "./TrafficLightVisualizer.css";

/**
 * <TrafficLightVisualizer> — animated intersection FSM demo.
 */

const STATE_SCHEMA = {
  modeSlug: {
    type: "enum",
    default: DEFAULT_STATE.modeSlug,
    values: MODE_SLUGS,
  },
  greenMs: { type: "number", default: DEFAULT_STATE.greenMs },
  yellowMs: { type: "number", default: DEFAULT_STATE.yellowMs },
  allRedMs: { type: "number", default: DEFAULT_STATE.allRedMs },
  totalMs: { type: "number", default: DEFAULT_STATE.totalMs },
} as const satisfies Schema;

const LIGHT_COLOR: Record<Light, string> = {
  GREEN: "#00cc66",
  YELLOW: "#ffcc00",
  RED: "#cc3300",
};

const DIM = "#2a2a2a";
const STAGE_W = 640;
const STAGE_H = 360;
const TIMELINE_X = 20;
const TIMELINE_W = STAGE_W - 40;
const TIMELINE_H = 40;
const TIMELINE_Y = STAGE_H - TIMELINE_H - 20;

const narrationTemplate = (state: TrafficLightDemoState): string => {
  const phase = computePhase(state);
  return `Traffic-light FSM in ${state.modeSlug} mode. NS = ${phase.ns}, EW = ${phase.ew}. Cycle: green ${state.greenMs / 1000}s, yellow ${state.yellowMs / 1000}s, all-red ${state.allRedMs / 1000}s.`;
};

function buildPlan(state: TrafficLightDemoState): Plan {
  return {
    mode: state.modeSlug,
    timings: {
      greenMs: state.greenMs,
      yellowMs: state.yellowMs,
      allRedMs: state.allRedMs,
    },
  };
}

function computePhase(state: TrafficLightDemoState): Phase {
  try {
    return stateAt(buildPlan(state), state.totalMs, 0);
  } catch {
    return { ns: "RED", ew: "RED", remainingMs: 0 };
  }
}

function drawStoplight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  active: Light,
  label: string,
): void {
  const radius = 22;
  const gap = 8;
  const totalH = radius * 6 + gap * 2;
  const bodyW = radius * 2 + 16;
  const bodyH = totalH + 16;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH / 2;

  ctx.fillStyle = "#1a1a1a";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 8);
  ctx.fill();
  ctx.stroke();

  const lights: Light[] = ["RED", "YELLOW", "GREEN"];
  lights.forEach((light, i) => {
    const ly = bodyY + 8 + radius + i * (radius * 2 + gap);
    ctx.beginPath();
    ctx.arc(cx, ly, radius, 0, Math.PI * 2);
    ctx.fillStyle = active === light ? LIGHT_COLOR[light] : DIM;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.fillStyle = "#222";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, cx, bodyY + bodyH + 4);
}

function drawTimeline(
  ctx: CanvasRenderingContext2D,
  sequence: readonly Phase[],
  totalMs: number,
  currentMs: number,
): void {
  ctx.fillStyle = "#eee";
  ctx.fillRect(TIMELINE_X, TIMELINE_Y, TIMELINE_W, TIMELINE_H);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(TIMELINE_X, TIMELINE_Y, TIMELINE_W, TIMELINE_H);

  let acc = 0;
  for (const p of sequence) {
    const x = TIMELINE_X + (acc / totalMs) * TIMELINE_W;
    const w = (p.remainingMs / totalMs) * TIMELINE_W;
    if (p.ns === p.ew) {
      ctx.fillStyle = LIGHT_COLOR[p.ns];
      ctx.fillRect(x, TIMELINE_Y, w, TIMELINE_H);
    } else {
      ctx.fillStyle = LIGHT_COLOR[p.ns];
      ctx.fillRect(x, TIMELINE_Y, w, TIMELINE_H / 2);
      ctx.fillStyle = LIGHT_COLOR[p.ew];
      ctx.fillRect(x, TIMELINE_Y + TIMELINE_H / 2, w, TIMELINE_H / 2);
    }
    acc += p.remainingMs;
  }

  const markerX = TIMELINE_X + (currentMs / totalMs) * TIMELINE_W;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(markerX, TIMELINE_Y - 4);
  ctx.lineTo(markerX, TIMELINE_Y + TIMELINE_H + 4);
  ctx.stroke();

  ctx.fillStyle = "#222";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("timeline", TIMELINE_X, TIMELINE_Y - 14);
}

export function TrafficLightVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "traffic-light",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const plan = useMemo<Plan>(() => buildPlan(state), [state]);

  const sequence = useMemo<Phase[]>(() => {
    try {
      return planSequence(plan, state.totalMs);
    } catch {
      return [];
    }
  }, [plan, state.totalMs]);

  const timeRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    lastFrameRef.current = null;
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const delta = now - last;
      lastFrameRef.current = now;
      timeRef.current = (timeRef.current + delta) % state.totalMs;
      setDisplayTime(timeRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, state.totalMs]);

  const safeT = Math.min(Math.max(0, displayTime % state.totalMs), state.totalMs - 1);

  const currentPhase: Phase = useMemo(() => {
    try {
      return stateAt(plan, state.totalMs, safeT);
    } catch {
      return { ns: "RED", ew: "RED", remainingMs: 0 };
    }
  }, [plan, state.totalMs, safeT]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = "#f4f4f0";
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      const lightY = 110;
      drawStoplight(ctx, 200, lightY, currentPhase.ns, "NS");
      drawStoplight(ctx, 440, lightY, currentPhase.ew, "EW");
      drawTimeline(ctx, sequence, state.totalMs, safeT);
    },
    [currentPhase.ns, currentPhase.ew, sequence, state.totalMs, safeT],
  );

  const handleReset = (): void => {
    reset();
    timeRef.current = 0;
    lastFrameRef.current = null;
    setDisplayTime(0);
  };

  const handlePresetSelect = (next: TrafficLightDemoState): void => {
    setState(next);
    timeRef.current = 0;
    lastFrameRef.current = null;
    setDisplayTime(0);
  };

  return (
    <div className="tl-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: TrafficLightDemoState }[] as {
            name: string;
            state: TrafficLightDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Traffic light presets"
      />

      <div className="tl-visualizer__stage">
        <DemoCanvas
          width={STAGE_W}
          height={STAGE_H}
          ariaLabel={`Traffic light intersection in ${state.modeSlug} mode`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{mode: ${state.modeSlug}}`,
            `\\text{NS: ${currentPhase.ns}}`,
            `\\text{EW: ${currentPhase.ew}}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="tl-visualizer__controls">
        <SliderRow
          label="Green duration"
          min={1000}
          max={15000}
          step={500}
          value={state.greenMs}
          onChange={(greenMs) => setState({ ...state, greenMs })}
          format={{ precision: 0, unit: "ms" }}
        />
        <SliderRow
          label="Yellow duration"
          min={500}
          max={5000}
          step={250}
          value={state.yellowMs}
          onChange={(yellowMs) => setState({ ...state, yellowMs })}
          format={{ precision: 0, unit: "ms" }}
        />
        <SliderRow
          label="All-red duration"
          min={0}
          max={3000}
          step={250}
          value={state.allRedMs}
          onChange={(allRedMs) => setState({ ...state, allRedMs })}
          format={{ precision: 0, unit: "ms" }}
        />
        <SliderRow
          label="Total simulated time"
          min={5000}
          max={60000}
          step={1000}
          value={state.totalMs}
          onChange={(totalMs) => setState({ ...state, totalMs })}
          format={{ precision: 0, unit: "ms" }}
        />
      </div>

      <div className="tl-visualizer__actions">
        <button
          type="button"
          className="tl-visualizer__btn tl-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="tl-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="tl-visualizer__counter" aria-live="off">
          t = {(safeT / 1000).toFixed(2)} s
        </span>
      </div>
    </div>
  );
}
