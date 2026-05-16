import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type StopwatchInput,
  type StopwatchOutput,
  type StopwatchState,
  run,
  stopwatchFSM,
} from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  SEQUENCES,
  SLUGS,
  type SequenceSlug,
} from "./presets";
import "./FsmSimulatorVisualizer.css";

const STATE_SCHEMA = {
  step: { type: "number", default: DEFAULT_STATE.step },
  sequence: {
    type: "enum",
    default: DEFAULT_STATE.sequence,
    values: SLUGS,
  },
} as const satisfies Schema;

interface NodePos {
  cx: number;
  cy: number;
}

const NODE_POSITIONS: Record<StopwatchState, NodePos> = {
  IDLE: { cx: 90, cy: 80 },
  RUNNING: { cx: 350, cy: 80 },
  PAUSED: { cx: 220, cy: 220 },
};

const NODE_RADIUS = 38;

interface EdgeSpec {
  from: StopwatchState;
  to: StopwatchState;
  label: string;
  curved?: boolean;
}

const EDGES: readonly EdgeSpec[] = [
  { from: "IDLE", to: "RUNNING", label: "start" },
  { from: "RUNNING", to: "PAUSED", label: "pause" },
  { from: "PAUSED", to: "RUNNING", label: "resume" },
  { from: "RUNNING", to: "IDLE", label: "reset", curved: true },
  { from: "PAUSED", to: "IDLE", label: "reset", curved: true },
];

function edgeEndpoints(from: NodePos, to: NodePos): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: from.cx + ux * NODE_RADIUS,
    y1: from.cy + uy * NODE_RADIUS,
    x2: to.cx - ux * NODE_RADIUS,
    y2: to.cy - uy * NODE_RADIUS,
  };
}

function curvedPath(from: NodePos, to: NodePos): {
  d: string;
  midX: number;
  midY: number;
} {
  const { x1, y1, x2, y2 } = edgeEndpoints(from, to);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const offset = 50;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return {
    d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
    midX: cx,
    midY: cy,
  };
}

export default function FsmSimulatorVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "fsm-simulator",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const sequence = state.sequence as SequenceSlug;
  const inputs = SEQUENCES[sequence];
  const N = inputs.length;

  const result = useMemo(() => run(stopwatchFSM, inputs), [inputs]);

  const clampedStep = Math.max(0, Math.min(state.step, N));

  // Current state at index `step`: step=0 → initial; step=k → trace[k-1].to
  const currentState: StopwatchState =
    clampedStep === 0
      ? stopwatchFSM.initial
      : result.trace[clampedStep - 1]!.to;

  const currentOutput: StopwatchOutput =
    stopwatchFSM.outputs && stopwatchFSM.outputs.kind === "moore"
      ? stopwatchFSM.outputs.out(currentState)
      : "stopped";

  const sequenceIndex = SLUGS.indexOf(sequence);

  const handlePresetSelect = (next: typeof state): void => {
    setState({ ...next, step: 0 });
  };

  const handleSequenceSlider = (idx: number): void => {
    const i = Math.max(0, Math.min(SLUGS.length - 1, Math.round(idx)));
    const slug = SLUGS[i]!;
    setState({ sequence: slug, step: 0 });
  };

  return (
    <div className="fsm-visualizer">
      <PresetCarousel
        presets={
          PRESETS as unknown as { name: string; state: typeof state }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="FSM simulator presets"
      />

      <div className="fsm-visualizer__stage">
        <svg
          className="fsm-visualizer__diagram"
          width={440}
          height={280}
          viewBox="0 0 440 280"
          role="img"
          aria-label="Stopwatch state diagram"
        >
          <defs>
            <marker
              id="fsm-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a6a55" />
            </marker>
          </defs>

          {EDGES.map((edge) => {
            const from = NODE_POSITIONS[edge.from];
            const to = NODE_POSITIONS[edge.to];
            const key = `${edge.from}-${edge.to}-${edge.label}`;
            if (edge.curved) {
              const { d, midX, midY } = curvedPath(from, to);
              return (
                <g key={key}>
                  <path
                    className="fsm-visualizer__edge"
                    d={d}
                    markerEnd="url(#fsm-arrow)"
                  />
                  <text
                    className="fsm-visualizer__edge-label"
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            }
            const { x1, y1, x2, y2 } = edgeEndpoints(from, to);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - 6;
            return (
              <g key={key}>
                <line
                  className="fsm-visualizer__edge"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  markerEnd="url(#fsm-arrow)"
                />
                <text
                  className="fsm-visualizer__edge-label"
                  x={mx}
                  y={my}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {(["IDLE", "RUNNING", "PAUSED"] as const).map((s) => {
            const pos = NODE_POSITIONS[s];
            const isActive = s === currentState;
            return (
              <g
                key={s}
                className={
                  isActive
                    ? "fsm-visualizer__node fsm-visualizer__node--active"
                    : "fsm-visualizer__node"
                }
              >
                <circle cx={pos.cx} cy={pos.cy} r={NODE_RADIUS} />
                <text x={pos.cx} y={pos.cy}>
                  {s}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="fsm-visualizer__tape" aria-label="Input trace">
          {result.trace.map((step, i) => {
            const applied = i < clampedStep;
            const current = i === clampedStep - 1;
            const cls = current
              ? "fsm-visualizer__cell fsm-visualizer__cell--current"
              : applied
                ? "fsm-visualizer__cell fsm-visualizer__cell--applied"
                : "fsm-visualizer__cell";
            return (
              <span key={i} className={cls}>
                {step.input} → {step.to}
              </span>
            );
          })}
        </div>

        <div className="fsm-visualizer__output">output: {currentOutput}</div>
      </div>

      <div className="fsm-visualizer__hud" aria-live="polite">
        {sequence} · step {clampedStep} of {N}
      </div>
      <div className="fsm-visualizer__counter">
        state={currentState} · output={currentOutput}
      </div>

      <div className="fsm-visualizer__controls">
        <SliderRow
          label="Step (0..N)"
          min={0}
          max={N}
          step={1}
          value={clampedStep}
          onChange={(step) => setState({ ...state, step })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Input sequence"
          min={0}
          max={SLUGS.length - 1}
          step={1}
          value={sequenceIndex < 0 ? 0 : sequenceIndex}
          onChange={handleSequenceSlider}
          format={{ precision: 0 }}
        />
      </div>

      <div className="fsm-visualizer__actions">
        <button
          type="button"
          className="fsm-visualizer__btn"
          aria-label="Reset fsm simulation"
          onClick={() => reset()}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
