import { useCallback, useId, useMemo } from "react";
// GRAPH_SLUGS imported for schema; presets carousel drives selection.
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { pageRank } from "./algorithm";
import {
  DEFAULT_STATE,
  GRAPH_SLUGS,
  PRESETS,
  type PageRankDemoState,
  TOLERANCE_KEYS,
  TOLERANCE_VALUES,
  getGraph,
} from "./presets";
import "./PageRankVisualizer.css";

/**
 * <PageRankVisualizer> — visualises the converged PageRank distribution
 * on a small directed graph. No animation: the algorithm is recomputed
 * synchronously whenever a control changes.
 */

const CANVAS_W = 640;
const CANVAS_H = 360;
const GRAPH_CX = 320;
const GRAPH_CY = 130;
const GRAPH_R = 100;
const BAR_TOP = 250;
const BAR_BOTTOM = 340;

const STATE_SCHEMA = {
  graphSlug: {
    type: "enum",
    default: DEFAULT_STATE.graphSlug,
    values: GRAPH_SLUGS,
  },
  damping: { type: "number", default: DEFAULT_STATE.damping },
  maxIterations: { type: "number", default: DEFAULT_STATE.maxIterations },
  toleranceKey: {
    type: "enum",
    default: DEFAULT_STATE.toleranceKey,
    values: TOLERANCE_KEYS,
  },
} as const satisfies Schema;

interface NodePos {
  readonly x: number;
  readonly y: number;
}

function layoutNodes(n: number): NodePos[] {
  const out: NodePos[] = [];
  for (let i = 0; i < n; i += 1) {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2;
    out.push({
      x: GRAPH_CX + GRAPH_R * Math.cos(theta),
      y: GRAPH_CY + GRAPH_R * Math.sin(theta),
    });
  }
  return out;
}

function rankColor(t: number): string {
  // Grey (low) → dark green (high). t in [0, 1].
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(180 - clamped * 180);
  const g = Math.round(180 - clamped * 75);
  const b = Math.round(180 - clamped * 168);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: NodePos,
  to: NodePos,
  fromRadius: number,
  toRadius: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const sx = from.x + ux * fromRadius;
  const sy = from.y + uy * fromRadius;
  const tx = to.x - ux * (toRadius + 2);
  const ty = to.y - uy * (toRadius + 2);

  ctx.strokeStyle = "rgba(80, 80, 90, 0.55)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Arrowhead
  const headLen = 7;
  const headAngle = Math.PI / 7;
  const ang = Math.atan2(uy, ux);
  ctx.fillStyle = "rgba(60, 60, 70, 0.75)";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(
    tx - headLen * Math.cos(ang - headAngle),
    ty - headLen * Math.sin(ang - headAngle),
  );
  ctx.lineTo(
    tx - headLen * Math.cos(ang + headAngle),
    ty - headLen * Math.sin(ang + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}

const narrationTemplate = (state: PageRankDemoState): string => {
  const graph = getGraph(state.graphSlug);
  return `PageRank on the ${graph.name} graph (${graph.nNodes} nodes, ${graph.edges.length} edges), damping d = ${state.damping.toFixed(2)}, up to ${state.maxIterations} power-iteration steps. Node size and color encode each node's rank.`;
};

export function PageRankVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "page-rank",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const graph = useMemo(() => getGraph(state.graphSlug), [state.graphSlug]);
  const positions = useMemo(() => layoutNodes(graph.nNodes), [graph.nNodes]);

  const result = useMemo(
    () =>
      pageRank({
        nNodes: graph.nNodes,
        edges: graph.edges,
        damping: state.damping,
        tolerance: TOLERANCE_VALUES[state.toleranceKey],
        maxIterations: state.maxIterations,
      }),
    [graph, state.damping, state.toleranceKey, state.maxIterations],
  );

  const { ranks, iterations, converged } = result;
  const maxRank = ranks.reduce((m, v) => (v > m ? v : m), 0) || 1;
  const topIdx = ranks.reduce(
    (best, v, i) => (v > (ranks[best] ?? Number.NEGATIVE_INFINITY) ? i : best),
    0,
  );
  const topRank = ranks[topIdx] ?? 0;

  const radii = useMemo(() => ranks.map((r) => 8 + r * 80), [ranks]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Edges first so nodes sit on top.
      for (const [from, to] of graph.edges) {
        const a = positions[from];
        const b = positions[to];
        if (!a || !b) continue;
        const ra = radii[from] ?? 8;
        const rb = radii[to] ?? 8;
        drawArrow(ctx, a, b, ra, rb);
      }

      // Nodes
      ctx.font = "11px 'JetBrains Mono Variable', 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < graph.nNodes; i += 1) {
        const p = positions[i];
        if (!p) continue;
        const rank = ranks[i] ?? 0;
        const radius = radii[i] ?? 8;
        const t = rank / maxRank;
        ctx.fillStyle = rankColor(t);
        ctx.strokeStyle = "rgba(20, 30, 25, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t > 0.55 ? "#ffffff" : "#1a2a22";
        ctx.fillText(String(i), p.x, p.y - 5);
        ctx.fillText(rank.toFixed(3), p.x, p.y + 6);
      }

      // Bar chart
      const barRegionH = BAR_BOTTOM - BAR_TOP;
      const padX = 40;
      const usableW = CANVAS_W - padX * 2;
      const gap = 4;
      const barW = Math.max(
        2,
        (usableW - gap * (graph.nNodes - 1)) / Math.max(1, graph.nNodes),
      );

      ctx.strokeStyle = "rgba(80, 80, 90, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, BAR_BOTTOM + 0.5);
      ctx.lineTo(CANVAS_W - padX, BAR_BOTTOM + 0.5);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "10px 'JetBrains Mono Variable', monospace";
      for (let i = 0; i < graph.nNodes; i += 1) {
        const rank = ranks[i] ?? 0;
        const t = rank / maxRank;
        const h = Math.max(1, t * (barRegionH - 18));
        const x = padX + i * (barW + gap);
        const y = BAR_BOTTOM - h;
        ctx.fillStyle = rankColor(t);
        ctx.fillRect(x, y, barW, h);
        ctx.strokeStyle = "rgba(20, 30, 25, 0.5)";
        ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, h - 1);
        ctx.fillStyle = "var(--color-text)";
        ctx.fillStyle = "#3a4a42";
        ctx.fillText(String(i), x + barW / 2, BAR_BOTTOM + 12);
      }
    },
    [graph, positions, ranks, radii, maxRank],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: PageRankDemoState): void => {
    setState(next);
  };

  const tolSelectId = useId();

  return (
    <div className="pr-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: PageRankDemoState }[] as {
            name: string;
            state: PageRankDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="PageRank graph presets"
      />

      <div className="pr-visualizer__stage">
        <DemoCanvas
          width={CANVAS_W}
          height={CANVAS_H}
          ariaLabel={`PageRank visualisation on the ${graph.name} graph`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{iterations} = ${iterations}`,
            `\\text{converged} = \\text{${converged ? "yes" : "no"}}`,
            `\\text{top rank} = ${topRank.toFixed(3)} \\text{ at node } ${topIdx}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="pr-visualizer__controls">
        <SliderRow
          label="Damping d"
          description="Probability of following a link; 1 − d is the teleport probability."
          min={0.5}
          max={0.99}
          step={0.01}
          value={state.damping}
          onChange={(damping) => setState({ ...state, damping })}
          format={{ precision: 2 }}
        />

        <SliderRow
          label="Max iterations"
          description="Cap on power-iteration steps before bailing out."
          min={10}
          max={500}
          step={10}
          value={state.maxIterations}
          onChange={(maxIterations) => setState({ ...state, maxIterations })}
          format={{ precision: 0 }}
        />

        <div className="pr-visualizer__select-row">
          <label htmlFor={tolSelectId}>Tolerance</label>
          <select
            id={tolSelectId}
            className="pr-visualizer__select"
            value={state.toleranceKey}
            onChange={(event) =>
              setState({
                ...state,
                toleranceKey: event.target.value as PageRankDemoState["toleranceKey"],
              })
            }
          >
            {TOLERANCE_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pr-visualizer__actions">
        <button type="button" className="pr-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="pr-visualizer__counter" aria-live="off">
          {graph.nNodes} nodes, {graph.edges.length} edges
        </span>
      </div>
    </div>
  );
}
