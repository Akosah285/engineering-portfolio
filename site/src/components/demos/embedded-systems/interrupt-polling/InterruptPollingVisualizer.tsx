import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type InterruptConfig,
  type PollingConfig,
  type ResponseMetrics,
  simulateInterrupts,
  simulatePolling,
} from "./algorithm";
import {
  DEFAULT_STATE,
  HANDLER_COST_MS,
  POLL_COST_MS,
  SIMULATION_DURATION_MS,
  WORKLOADS,
  WORKLOAD_SLUGS,
  type Workload,
  type WorkloadSlug,
  getWorkload,
} from "./presets";
import "./InterruptPollingVisualizer.css";

/**
 * <InterruptPollingVisualizer> — embedded-systems demo (#?, hero).
 *
 * Side-by-side comparison of two scheduling approaches for the same
 * event stream: a fixed-period polling loop vs an interrupt-driven
 * handler. The SVG timeline shows when each approach actually services
 * each event; the stats panel reports mean/max latency, CPU utilization,
 * and missed events, with the better column highlighted.
 */

const STATE_SCHEMA = {
  pollPeriodMs: { type: "number", default: DEFAULT_STATE.pollPeriodMs },
  interruptLatencyMs: {
    type: "number",
    default: DEFAULT_STATE.interruptLatencyMs,
  },
  workload: {
    type: "enum",
    default: DEFAULT_STATE.workload,
    values: WORKLOAD_SLUGS,
  },
} as const satisfies Schema;

const SVG_W = 720;
const SVG_H = 220;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;
const LANE_H = PLOT_H / 2;

const COLOR_POLL_TICK = "#9aa0a6";
const COLOR_POLL_COST = "#9bb6e0";
const COLOR_HANDLER = "#00693e";
const COLOR_ISR_OVERHEAD = "#c77b3a";
const COLOR_EVENT = "#cf4f4f";

function xOf(t: number): number {
  return PAD_L + (t / SIMULATION_DURATION_MS) * PLOT_W;
}

interface PollingTrace {
  pollBoundaries: readonly number[];
  pollCostBars: readonly { x: number; w: number }[];
  handlerBars: readonly { x: number; w: number }[];
}

function buildPollingTrace(events: readonly number[], cfg: PollingConfig): PollingTrace {
  const boundaries: number[] = [];
  const pollCostBars: { x: number; w: number }[] = [];
  const handlerBars: { x: number; w: number }[] = [];
  let evIdx = 0;
  let t = 0;
  while (t <= cfg.simulationDurationMs) {
    boundaries.push(t);
    if (cfg.pollCostMs > 0) pollCostBars.push({ x: t, w: cfg.pollCostMs });
    while (evIdx < events.length && (events[evIdx] ?? Number.POSITIVE_INFINITY) <= t) {
      if (t + cfg.handlerCostMs <= cfg.simulationDurationMs) {
        handlerBars.push({ x: t, w: cfg.handlerCostMs });
      }
      evIdx++;
    }
    t += cfg.pollPeriodMs;
  }
  return { pollBoundaries: boundaries, pollCostBars, handlerBars };
}

interface InterruptTrace {
  dispatches: readonly { x: number; w: number; handler: number }[];
}

function buildInterruptTrace(
  events: readonly number[],
  cfg: InterruptConfig,
): InterruptTrace {
  const out: { x: number; w: number; handler: number }[] = [];
  let nextFreeAt = 0;
  for (const ev of events) {
    const dispatch = Math.max(ev, nextFreeAt) + cfg.interruptLatencyMs;
    const finish = dispatch + cfg.handlerCostMs;
    if (finish <= cfg.simulationDurationMs) {
      out.push({
        x: Math.max(ev, nextFreeAt),
        w: cfg.interruptLatencyMs,
        handler: cfg.handlerCostMs,
      });
      nextFreeAt = finish;
    }
  }
  return { dispatches: out };
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0ms";
  return `${value.toFixed(2)}ms`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface StatsColumnProps {
  title: string;
  metrics: ResponseMetrics;
  isBetter: boolean;
}

function StatsColumn({ title, metrics, isBetter }: StatsColumnProps) {
  const className = isBetter
    ? "ip-visualizer__stats-col ip-visualizer__stats-col--better"
    : "ip-visualizer__stats-col";
  return (
    <div className={className}>
      <h4>{title}</h4>
      <dl>
        <dt>mean latency</dt>
        <dd>{formatMs(metrics.meanLatency)}</dd>
        <dt>max latency</dt>
        <dd>{formatMs(metrics.maxLatency)}</dd>
        <dt>CPU util</dt>
        <dd>{formatPct(metrics.cpuUtilization)}</dd>
        <dt>missed</dt>
        <dd>{metrics.missedCount}</dd>
      </dl>
    </div>
  );
}

export default function InterruptPollingVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "interrupt-polling",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const workload: Workload = useMemo(() => getWorkload(state.workload), [state.workload]);

  const pollingCfg: PollingConfig = useMemo(
    () => ({
      pollPeriodMs: state.pollPeriodMs,
      pollCostMs: POLL_COST_MS,
      handlerCostMs: HANDLER_COST_MS,
      simulationDurationMs: SIMULATION_DURATION_MS,
    }),
    [state.pollPeriodMs],
  );
  const interruptCfg: InterruptConfig = useMemo(
    () => ({
      interruptLatencyMs: state.interruptLatencyMs,
      handlerCostMs: HANDLER_COST_MS,
      simulationDurationMs: SIMULATION_DURATION_MS,
    }),
    [state.interruptLatencyMs],
  );

  const pollingMetrics = useMemo(
    () => simulatePolling(workload.events, pollingCfg),
    [workload, pollingCfg],
  );
  const interruptMetrics = useMemo(
    () => simulateInterrupts(workload.events, interruptCfg),
    [workload, interruptCfg],
  );

  const pollingTrace = useMemo(
    () => buildPollingTrace(workload.events, pollingCfg),
    [workload, pollingCfg],
  );
  const interruptTrace = useMemo(
    () => buildInterruptTrace(workload.events, interruptCfg),
    [workload, interruptCfg],
  );

  const pollingBetterLatency = pollingMetrics.meanLatency <= interruptMetrics.meanLatency;
  const pollingBetterUtil =
    pollingMetrics.cpuUtilization <= interruptMetrics.cpuUtilization;
  // Highlight column that wins on the headline (latency) metric.
  const pollingIsBetter = pollingBetterLatency && pollingBetterUtil;
  const interruptIsBetter = !pollingBetterLatency && !pollingBetterUtil;

  const workloadIndex = WORKLOADS.findIndex((w) => w.slug === state.workload);
  const safeIndex = workloadIndex < 0 ? 0 : workloadIndex;

  const presetChips = useMemo(
    () =>
      WORKLOADS.map((w) => ({
        name: w.name,
        state: { slug: w.slug },
      })),
    [],
  );

  const handleReset = (): void => {
    reset();
  };

  const pollLaneY = PAD_T;
  const isrLaneY = PAD_T + LANE_H;
  const pollBarH = LANE_H * 0.5;
  const isrBarH = LANE_H * 0.5;

  return (
    <div className="ip-visualizer">
      <PresetCarousel
        presets={
          presetChips as readonly {
            name: string;
            state: { slug: WorkloadSlug };
          }[] as unknown as {
            name: string;
            state: { slug: WorkloadSlug };
          }[]
        }
        onSelect={(picked) => {
          setState({ ...state, workload: picked.slug });
        }}
        initialIndex={safeIndex}
        ariaLabel="Interrupt vs polling workloads"
      />

      <div className="ip-visualizer__hud" aria-live="off">
        {`${state.workload} · poll=${state.pollPeriodMs}ms · isr-lat=${state.interruptLatencyMs}ms`}
      </div>

      <div className="ip-visualizer__stage">
        <svg
          className="ip-visualizer__svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label="Interrupt versus polling timeline"
        >
          {/* lane backgrounds */}
          <rect x={PAD_L} y={pollLaneY} width={PLOT_W} height={LANE_H} fill="#fdfdfb" />
          <rect x={PAD_L} y={isrLaneY} width={PLOT_W} height={LANE_H} fill="#f7f7f3" />

          {/* lane labels */}
          <text x={4} y={pollLaneY + LANE_H / 2} fontSize={11} fill="#333">
            poll
          </text>
          <text x={4} y={isrLaneY + LANE_H / 2} fontSize={11} fill="#333">
            isr
          </text>

          {/* event arrival dashed lines spanning both lanes */}
          {workload.events.map((ev, i) => (
            <line
              key={`ev-${i}`}
              x1={xOf(ev)}
              x2={xOf(ev)}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke={COLOR_EVENT}
              strokeWidth={0.75}
              strokeDasharray="2 3"
              opacity={0.7}
            />
          ))}

          {/* polling: tick marks at every poll boundary */}
          {pollingTrace.pollBoundaries.map((t, i) => (
            <line
              key={`pb-${i}`}
              x1={xOf(t)}
              x2={xOf(t)}
              y1={pollLaneY + LANE_H - 6}
              y2={pollLaneY + LANE_H}
              stroke={COLOR_POLL_TICK}
              strokeWidth={1}
            />
          ))}

          {/* polling: poll-cost bars */}
          {pollingTrace.pollCostBars.map((b, i) => {
            const x0 = xOf(b.x);
            const x1 = xOf(b.x + b.w);
            return (
              <rect
                key={`pc-${i}`}
                x={x0}
                y={pollLaneY + 4}
                width={Math.max(1, x1 - x0)}
                height={pollBarH * 0.35}
                fill={COLOR_POLL_COST}
              />
            );
          })}

          {/* polling: handler bars */}
          {pollingTrace.handlerBars.map((b, i) => {
            const x0 = xOf(b.x);
            const x1 = xOf(b.x + b.w);
            return (
              <rect
                key={`ph-${i}`}
                x={x0}
                y={pollLaneY + 4 + pollBarH * 0.35}
                width={Math.max(1, x1 - x0)}
                height={pollBarH * 0.65}
                fill={COLOR_HANDLER}
                opacity={0.85}
              />
            );
          })}

          {/* interrupts: triangle arrivals along lane top */}
          {workload.events.map((ev, i) => {
            const x = xOf(ev);
            const y = isrLaneY + 2;
            return (
              <polygon
                key={`isr-arr-${i}`}
                points={`${x - 4},${y} ${x + 4},${y} ${x},${y + 6}`}
                fill={COLOR_EVENT}
              />
            );
          })}

          {/* interrupts: ISR overhead + handler bars */}
          {interruptTrace.dispatches.map((d, i) => {
            const oX0 = xOf(d.x);
            const oX1 = xOf(d.x + d.w);
            const hX1 = xOf(d.x + d.w + d.handler);
            const y = isrLaneY + 10;
            const h = isrBarH * 0.75;
            return (
              <g key={`isr-${i}`}>
                <rect
                  x={oX0}
                  y={y}
                  width={Math.max(1, oX1 - oX0)}
                  height={h}
                  fill={COLOR_ISR_OVERHEAD}
                  opacity={0.85}
                />
                <rect
                  x={oX1}
                  y={y}
                  width={Math.max(1, hX1 - oX1)}
                  height={h}
                  fill={COLOR_HANDLER}
                  opacity={0.85}
                />
              </g>
            );
          })}

          {/* time axis */}
          <line
            x1={PAD_L}
            x2={PAD_L + PLOT_W}
            y1={PAD_T + PLOT_H}
            y2={PAD_T + PLOT_H}
            stroke="#333"
            strokeWidth={1}
          />
          {[0, 50, 100, 150, 200].map((t) => (
            <g key={`ax-${t}`}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={PAD_T + PLOT_H}
                y2={PAD_T + PLOT_H + 4}
                stroke="#333"
              />
              <text
                x={xOf(t)}
                y={PAD_T + PLOT_H + 16}
                fontSize={10}
                textAnchor="middle"
                fill="#333"
              >
                {t}ms
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="ip-visualizer__stats">
        <StatsColumn
          title="Polling"
          metrics={pollingMetrics}
          isBetter={pollingIsBetter}
        />
        <StatsColumn
          title="Interrupts"
          metrics={interruptMetrics}
          isBetter={interruptIsBetter}
        />
      </div>

      <div className="ip-visualizer__controls">
        <SliderRow
          label="Poll period (ms)"
          min={1}
          max={50}
          step={1}
          value={state.pollPeriodMs}
          onChange={(pollPeriodMs) => setState({ ...state, pollPeriodMs })}
          format={{ unit: "ms" }}
        />
        <SliderRow
          label="Interrupt latency (ms)"
          min={0}
          max={20}
          step={0.5}
          value={state.interruptLatencyMs}
          onChange={(interruptLatencyMs) => setState({ ...state, interruptLatencyMs })}
          format={{ precision: 1, unit: "ms" }}
        />
        <SliderRow
          label="Workload"
          min={0}
          max={WORKLOADS.length - 1}
          step={1}
          value={safeIndex}
          onChange={(idx) => {
            const clamped = Math.max(0, Math.min(WORKLOADS.length - 1, Math.round(idx)));
            const picked = WORKLOADS[clamped];
            if (picked) setState({ ...state, workload: picked.slug });
          }}
        />
      </div>

      <div className="ip-visualizer__actions">
        <button
          type="button"
          className="ip-visualizer__btn"
          aria-label="Reset interrupt vs polling"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="ip-visualizer__counter" aria-live="off">
          {`poll mean: ${formatMs(pollingMetrics.meanLatency)} · isr mean: ${formatMs(interruptMetrics.meanLatency)}`}
        </span>
      </div>
    </div>
  );
}
