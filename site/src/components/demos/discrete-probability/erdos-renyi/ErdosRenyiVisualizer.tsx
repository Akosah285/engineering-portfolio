import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  componentLabels,
  degrees,
  generate,
  largestComponentSize,
  meanDegree,
  mulberry32,
} from "./algorithm";
import { DEFAULT_STATE, type ErdosRenyiDemoState, PRESETS } from "./presets";
import "./ErdosRenyiVisualizer.css";

/**
 * <ErdosRenyiVisualizer> — Discrete & Probability random-graph demo.
 *
 * Renders a G(n, p) random graph on a circular layout, colouring nodes by
 * connected-component label, and a degree histogram underneath. Drives
 * home the p ≈ 1/n phase transition by letting the user sweep `p` while
 * watching the giant component emerge.
 */

const STATE_SCHEMA = {
  nNodes: { type: "number", default: DEFAULT_STATE.nNodes },
  p: { type: "number", default: DEFAULT_STATE.p },
  seed: { type: "number", default: DEFAULT_STATE.seed },
} as const satisfies Schema;

const GRAPH_CENTER_X = 320;
const GRAPH_CENTER_Y = 130;
const GRAPH_RADIUS = 100;
const NODE_RADIUS = 6;
const HIST_TOP = 250;
const HIST_BOTTOM = 350;
const HIST_LEFT = 40;
const HIST_RIGHT = 600;

const narrationTemplate = (state: ErdosRenyiDemoState): string => {
  const threshold = state.nNodes > 0 ? 1 / state.nNodes : 0;
  const ratio = threshold > 0 ? state.p / threshold : 0;
  let regime: string;
  if (state.p === 0) regime = "the empty regime";
  else if (ratio < 0.7) regime = "below the p ≈ 1/n threshold (subcritical)";
  else if (ratio < 1.4) regime = "near the p ≈ 1/n phase transition";
  else regime = "above the p ≈ 1/n threshold (supercritical, giant component)";
  return `Erdős-Rényi random graph G(n = ${state.nNodes}, p = ${state.p.toFixed(3)}), seed ${state.seed}: ${regime}. Each of the ${state.nNodes} nodes has expected degree ${(state.p * (state.nNodes - 1)).toFixed(2)}.`;
};

export function ErdosRenyiVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "erdos-renyi",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const graph = useMemo(
    () =>
      generate({
        nNodes: state.nNodes,
        p: state.p,
        random: mulberry32(state.seed),
      }),
    [state.nNodes, state.p, state.seed],
  );

  const labels = useMemo(() => componentLabels(graph), [graph]);
  const nodeDegrees = useMemo(() => degrees(graph), [graph]);
  const meanDeg = useMemo(() => meanDegree(graph), [graph]);
  const largestSize = useMemo(() => largestComponentSize(graph), [graph]);
  const edgeCount = graph.edges.length;

  const positions = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const n = state.nNodes;
    for (let i = 0; i < n; i += 1) {
      const theta = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      out.push({
        x: GRAPH_CENTER_X + GRAPH_RADIUS * Math.cos(theta),
        y: GRAPH_CENTER_Y + GRAPH_RADIUS * Math.sin(theta),
      });
    }
    return out;
  }, [state.nNodes]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      // --- Edges (under nodes) ---
      ctx.strokeStyle = "rgba(70, 70, 70, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [a, b] of graph.edges) {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) continue;
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      ctx.stroke();

      // --- Nodes ---
      for (let i = 0; i < positions.length; i += 1) {
        const pos = positions[i]!;
        const lbl = labels[i] ?? 0;
        const hue = (lbl * 67) % 360;
        ctx.fillStyle = `hsl(${hue}, 65%, 50%)`;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // --- Histogram of node degrees ---
      const maxDeg = nodeDegrees.reduce((m, d) => (d > m ? d : m), 0);
      const bins = maxDeg + 1;
      const counts = new Array<number>(bins).fill(0);
      for (const d of nodeDegrees) counts[d] = (counts[d] ?? 0) + 1;
      const maxCount = counts.reduce((m, c) => (c > m ? c : m), 1);

      // Axis baseline
      ctx.strokeStyle = "rgba(80, 80, 80, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HIST_LEFT, HIST_BOTTOM);
      ctx.lineTo(HIST_RIGHT, HIST_BOTTOM);
      ctx.stroke();

      const histWidth = HIST_RIGHT - HIST_LEFT;
      const histHeight = HIST_BOTTOM - HIST_TOP;
      const barWidth = histWidth / Math.max(1, bins);

      ctx.fillStyle = "rgba(0, 105, 62, 0.75)";
      for (let b = 0; b < bins; b += 1) {
        const c = counts[b] ?? 0;
        const h = (c / maxCount) * (histHeight - 12);
        const x = HIST_LEFT + b * barWidth + 1;
        const y = HIST_BOTTOM - h;
        ctx.fillRect(x, y, Math.max(1, barWidth - 2), h);
      }

      // Axis label
      ctx.fillStyle = "rgba(60, 60, 60, 0.85)";
      ctx.font = "11px 'JetBrains Mono Variable', monospace";
      ctx.textAlign = "center";
      ctx.fillText("degree distribution", (HIST_LEFT + HIST_RIGHT) / 2, HIST_BOTTOM + 14);
      ctx.textAlign = "start";
    },
    [graph, labels, nodeDegrees, positions],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: ErdosRenyiDemoState): void => {
    setState(next);
  };

  return (
    <div className="er-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: ErdosRenyiDemoState }[] as {
            name: string;
            state: ErdosRenyiDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Erdős-Rényi random graph presets"
      />

      <div className="er-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Erdős-Rényi random graph with ${state.nNodes} nodes and edge probability ${state.p}`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `n = ${state.nNodes}`,
            `p = ${state.p.toFixed(3)}`,
            `\\text{mean deg} = ${meanDeg.toFixed(2)}`,
            `\\text{largest comp} = ${largestSize} / ${state.nNodes}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="er-visualizer__controls">
        <SliderRow
          label="n nodes"
          description="Number of vertices in the graph. Edges are drawn between every unordered pair independently with probability p."
          min={5}
          max={100}
          step={1}
          value={state.nNodes}
          onChange={(nNodes) => setState({ ...state, nNodes })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="p (edge probability)"
          description="Per-pair edge probability. The phase transition sits near p ≈ 1/n: below it the graph is dust; above it a giant component emerges."
          min={0}
          max={1}
          step={0.005}
          value={state.p}
          onChange={(p) => setState({ ...state, p })}
          format={{ precision: 3 }}
        />
        <SliderRow
          label="Seed"
          description="PRNG seed for reproducible sampling. Change the seed to draw a different random graph from the same G(n, p) distribution."
          min={1}
          max={100000}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="er-visualizer__actions">
        <button type="button" className="er-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="er-visualizer__counter" aria-live="off">
          {state.nNodes} nodes, {edgeCount} edges
        </span>
      </div>
    </div>
  );
}
