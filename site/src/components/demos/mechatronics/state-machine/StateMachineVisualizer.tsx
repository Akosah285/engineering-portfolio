import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type DMInput, type DMState, transition } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  PRESET_META,
  PRESET_SLUGS,
  type StateMachineDemoState,
} from "./presets";
import "./StateMachineVisualizer.css";

/**
 * <StateMachineVisualizer> — robot decision-making FSM demo.
 *
 * Cycles through a preset input sequence, feeding one sensor reading per
 * timer tick into the FSM defined in `./algorithm.ts`. Renders the state
 * graph on the left, the input trace on the right, plus the standard
 * demo-kit MathHud / narration / preset carousel scaffolding.
 */

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: PRESET_SLUGS,
  },
  stepDelay: { type: "number", default: DEFAULT_STATE.stepDelay },
} as const satisfies Schema;

const INITIAL_STATE: DMState = "SEARCHING";

interface NodePos {
  x: number;
  y: number;
}

const NODE_POS: Record<DMState, NodePos> = {
  SEARCHING: { x: 130, y: 120 },
  WALL_FOLLOWING: { x: 310, y: 120 },
  TURNING: { x: 130, y: 280 },
  DONE: { x: 310, y: 280 },
};

const NODE_RADIUS = 50;

interface EdgeSpec {
  from: DMState;
  to: DMState;
  label: string;
  /** Curve offset perpendicular to the from→to line (pixels). */
  curve?: number;
}

const EDGES: readonly EdgeSpec[] = [
  { from: "SEARCHING", to: "WALL_FOLLOWING", label: "wall_left", curve: -28 },
  { from: "SEARCHING", to: "TURNING", label: "wall_front", curve: -28 },
  { from: "WALL_FOLLOWING", to: "TURNING", label: "wall_lost / wall_front", curve: 28 },
  { from: "TURNING", to: "WALL_FOLLOWING", label: "tick", curve: 28 },
  { from: "TURNING", to: "SEARCHING", label: "intersection", curve: 28 },
];

const SELF_LOOPS: readonly DMState[] = ["SEARCHING", "WALL_FOLLOWING", "TURNING"];

const narrationTemplate = (s: {
  presetLabel: string;
  inputCount: number;
  current: DMState;
  step: number;
}): string =>
  `${s.presetLabel}: feeding ${s.inputCount} sensor inputs to the robot FSM. Current state: ${s.current} after ${s.step} steps.`;

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
): void {
  const size = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size * 0.5);
  ctx.lineTo(-size, -size * 0.5);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fill();
  ctx.restore();
}

function drawEdge(ctx: CanvasRenderingContext2D, edge: EdgeSpec): void {
  const a = NODE_POS[edge.from];
  const b = NODE_POS[edge.to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // perpendicular for curve control point
  const px = -uy;
  const py = ux;
  const curve = edge.curve ?? 0;
  const mx = (a.x + b.x) / 2 + px * curve;
  const my = (a.y + b.y) / 2 + py * curve;

  // start/end on circle perimeter (approx)
  const sx = a.x + ux * NODE_RADIUS;
  const sy = a.y + uy * NODE_RADIUS;
  const ex = b.x - ux * NODE_RADIUS;
  const ey = b.y - uy * NODE_RADIUS;

  ctx.strokeStyle = "#57606a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // arrowhead at end, angle from control point to end
  const angle = Math.atan2(ey - my, ex - mx);
  drawArrowhead(ctx, ex, ey, angle);

  // label near midpoint of the curve
  ctx.fillStyle = "#1f2328";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lx = (a.x + b.x) / 2 + px * (curve * 1.4);
  const ly = (a.y + b.y) / 2 + py * (curve * 1.4);
  // small background pill for readability
  const metrics = ctx.measureText(edge.label);
  const pad = 3;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(lx - metrics.width / 2 - pad, ly - 7, metrics.width + pad * 2, 14);
  ctx.fillStyle = "#1f2328";
  ctx.fillText(edge.label, lx, ly);
}

function drawSelfLoop(ctx: CanvasRenderingContext2D, s: DMState): void {
  const p = NODE_POS[s];
  // Loop above the node
  const cx = p.x;
  const cy = p.y - NODE_RADIUS - 14;
  ctx.strokeStyle = "#9aa1a8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  // small arrowhead on the loop
  drawArrowhead(ctx, cx + 12, cy, Math.PI / 2);
}

function drawNode(ctx: CanvasRenderingContext2D, s: DMState, active: boolean): void {
  const p = NODE_POS[s];
  ctx.beginPath();
  ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = active ? "rgba(0, 105, 62, 0.18)" : "#f6f8fa";
  ctx.fill();
  ctx.strokeStyle = active ? "#00693e" : "#9aa1a8";
  ctx.lineWidth = active ? 4 : 1.5;
  ctx.stroke();

  ctx.fillStyle = "#1f2328";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, p.x, p.y);
}

function drawGoalEdge(ctx: CanvasRenderingContext2D): void {
  // Summary edge to DONE labeled "goal_reached"
  const target = NODE_POS.DONE;
  const sx = target.x + NODE_RADIUS + 30;
  const sy = target.y - 40;
  ctx.strokeStyle = "#c25d00";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(target.x + NODE_RADIUS * 0.7, target.y - NODE_RADIUS * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  drawArrowhead(
    ctx,
    target.x + NODE_RADIUS * 0.7,
    target.y - NODE_RADIUS * 0.7,
    Math.atan2(target.y - NODE_RADIUS * 0.7 - sy, target.x + NODE_RADIUS * 0.7 - sx),
  );
  ctx.fillStyle = "#c25d00";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("any → DONE on goal_reached", sx + 4, sy - 10);
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  inputs: readonly DMInput[],
  step: number,
  current: DMState,
): void {
  const x = 410;
  let y = 30;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#1f2328";
  ctx.fillText("Inputs:", x, y);
  y += 20;

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i]!;
    const isCurrent = i === step;
    const isProcessed = i < step;
    if (isCurrent) {
      ctx.fillStyle = "#fff3b0";
      ctx.fillRect(x - 4, y - 9, 220, 18);
      ctx.strokeStyle = "#c9a900";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 9, 220, 18);
    }
    ctx.fillStyle = isProcessed ? "#9aa1a8" : isCurrent ? "#1f2328" : "#57606a";
    ctx.fillText(`${i + 1}. ${input}`, x, y);
    y += 18;
  }

  y += 8;
  ctx.fillStyle = "#1f2328";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText(`Current state: ${current}`, x, y);
}

export function StateMachineVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "state-machine",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const inputs = useMemo(() => PRESET_META[state.presetSlug].inputs, [state.presetSlug]);
  const presetLabel = PRESET_META[state.presetSlug].label;

  const stepRef = useRef(0);
  const stateRef = useRef<DMState>(INITIAL_STATE);
  const accumulatorRef = useRef(0);

  const [paused, setPaused] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [currentState, setCurrentState] = useState<DMState>(INITIAL_STATE);

  // Reset whenever the preset changes (or after explicit reset).
  useEffect(() => {
    stepRef.current = 0;
    stateRef.current = INITIAL_STATE;
    accumulatorRef.current = 0;
    setStepCount(0);
    setCurrentState(INITIAL_STATE);
  }, [state.presetSlug]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      // Advance FSM by elapsed time
      if (!paused && stepRef.current < inputs.length) {
        accumulatorRef.current += deltaMs;
        let advanced = 0;
        while (
          accumulatorRef.current >= state.stepDelay &&
          stepRef.current < inputs.length
        ) {
          const nextInput = inputs[stepRef.current]!;
          stateRef.current = transition(stateRef.current, nextInput);
          stepRef.current += 1;
          accumulatorRef.current -= state.stepDelay;
          advanced += 1;
        }
        if (advanced > 0) {
          setStepCount(stepRef.current);
          setCurrentState(stateRef.current);
        }
      }

      // background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // panel divider
      ctx.strokeStyle = "#e1e4e8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(395, 10);
      ctx.lineTo(395, height - 10);
      ctx.stroke();

      // edges first (under nodes)
      for (const edge of EDGES) drawEdge(ctx, edge);
      for (const s of SELF_LOOPS) drawSelfLoop(ctx, s);
      drawGoalEdge(ctx);

      // nodes
      for (const s of Object.keys(NODE_POS) as DMState[]) {
        drawNode(ctx, s, s === stateRef.current);
      }

      // trace
      drawTrace(ctx, inputs, stepRef.current, stateRef.current);
    },
    [inputs, paused, state.stepDelay],
  );

  const handleReset = (): void => {
    reset();
    stepRef.current = 0;
    stateRef.current = INITIAL_STATE;
    accumulatorRef.current = 0;
    setStepCount(0);
    setCurrentState(INITIAL_STATE);
  };

  const handlePresetSelect = (next: StateMachineDemoState): void => {
    setState({ ...state, ...next });
  };

  const currentInput = stepCount < inputs.length ? inputs[stepCount]! : "—";

  return (
    <div className="sm-visualizer">
      <PresetCarousel
        presets={PRESETS as unknown as { name: string; state: StateMachineDemoState }[]}
        onSelect={handlePresetSelect}
        ariaLabel="State machine presets"
      />

      <div className="sm-visualizer__stage">
        <DemoCanvas
          width={640}
          height={400}
          ariaLabel={`Robot FSM state graph for preset ${presetLabel}`}
          draw={draw}
          paused={paused}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{state: ${currentState}}`,
            `\\text{input: ${currentInput}}`,
            `\\text{step: ${stepCount} / ${inputs.length}}`,
          ]}
        />
      </div>

      <DemoNarration
        state={{
          presetLabel,
          inputCount: inputs.length,
          current: currentState,
          step: stepCount,
        }}
        template={narrationTemplate}
      />

      <div className="sm-visualizer__controls">
        <SliderRow
          label="Step delay"
          description="How long the FSM waits between sensor inputs."
          min={200}
          max={2000}
          step={100}
          value={state.stepDelay}
          onChange={(stepDelay) => setState({ ...state, stepDelay })}
          format={{ precision: 0, unit: "ms" }}
        />
      </div>

      <div className="sm-visualizer__actions">
        <button
          type="button"
          className="sm-visualizer__btn sm-visualizer__btn--primary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button type="button" className="sm-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="sm-visualizer__counter" aria-live="off">
          step {stepCount} / {inputs.length}
        </span>
      </div>
    </div>
  );
}
