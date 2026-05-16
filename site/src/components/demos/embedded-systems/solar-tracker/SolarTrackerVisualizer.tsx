import { useEffect, useMemo, useRef, useState } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { decide } from "./algorithm";
import {
  DEFAULT_SKY,
  PATTERNS,
  type SkySlug,
  getPattern,
  patternAt,
  patternIndex,
} from "./presets";
import "./SolarTrackerVisualizer.css";

/**
 * <SolarTrackerVisualizer> — React shell around the solar-tracker brain.
 *
 * Renders a 2-panel stage: a sun + panel diagram on the left, and a
 * history of the panel angle over the past N decide() steps on the right.
 * Controls let you nudge the current panel angle, deadband, and sky
 * scenario. PresetCarousel chips jump between four named sky scenarios.
 */

interface SolarTrackerState {
  sky: SkySlug;
  currentAngle: number;
  deadband: number;
}

const HISTORY_MAX = 60;

const STATE_SCHEMA = {
  sky: {
    type: "enum",
    default: DEFAULT_SKY,
    values: PATTERNS.map((p) => p.slug),
  },
  currentAngle: { type: "number", default: 0 },
  deadband: { type: "number", default: 5 },
} as const satisfies Schema;

interface HistoryPoint {
  angle: number;
  clamped: boolean;
}

export default function SolarTrackerVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "solar-tracker",
    STATE_SCHEMA,
    { sky: DEFAULT_SKY, currentAngle: 0, deadband: 5 } as unknown as {
      sky: "morning-east-bright";
      currentAngle: 0;
      deadband: 5;
    },
  );
  const state = rawState as unknown as SolarTrackerState;

  const pattern = useMemo(() => getPattern(state.sky), [state.sky]);

  const result = useMemo(
    () =>
      decide({
        east: pattern.east,
        west: pattern.west,
        deadband: state.deadband,
        currentAngle: state.currentAngle,
      }),
    [pattern, state.deadband, state.currentAngle],
  );

  // History accumulates one entry per (currentAngle, sky, deadband) change.
  const [history, setHistory] = useState<HistoryPoint[]>([
    { angle: 0, clamped: false },
  ]);
  const lastKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${state.sky}|${state.deadband}|${state.currentAngle}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setHistory((prev) => {
      const next = [
        ...prev,
        { angle: result.nextAngle, clamped: result.clamped },
      ];
      return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
    });
  }, [state.sky, state.deadband, state.currentAngle, result.nextAngle, result.clamped]);

  const handleReset = (): void => {
    reset();
    setHistory([{ angle: 0, clamped: false }]);
    lastKeyRef.current = "";
  };

  const setSkyIndex = (n: number): void => {
    const p = patternAt(n);
    setState({
      ...state,
      sky: p.slug,
    } as unknown as typeof rawState);
  };

  const setCurrentAngle = (next: number): void => {
    setState({
      ...state,
      currentAngle: next,
    } as unknown as typeof rawState);
  };

  const setDeadband = (next: number): void => {
    setState({
      ...state,
      deadband: next,
    } as unknown as typeof rawState);
  };

  const handlePresetSelect = (next: { sky: SkySlug }): void => {
    setState({
      ...state,
      sky: next.sky,
    } as unknown as typeof rawState);
  };

  const presets = useMemo(
    () =>
      PATTERNS.map((p) => ({
        name: p.name,
        state: { sky: p.slug },
      })),
    [],
  );

  return (
    <div className="st-visualizer">
      <PresetCarousel
        presets={
          presets as readonly { name: string; state: { sky: SkySlug } }[] as unknown as {
            name: string;
            state: { sky: SkySlug };
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Solar tracker sky scenarios"
      />

      <div className="st-visualizer__stage">
        <PanelDiagram
          angle={state.currentAngle}
          direction={result.direction}
          east={pattern.east}
          west={pattern.west}
          sunFraction={pattern.sunFraction}
        />
        <AngleHistory points={history} />
      </div>

      <div className="st-visualizer__hud" aria-live="polite">
        {`${state.sky} · angle=${state.currentAngle}° · deadband=${state.deadband}`}
      </div>

      <div className="st-visualizer__controls">
        <SliderRow
          label="Panel angle (°)"
          min={-90}
          max={90}
          step={1}
          value={state.currentAngle}
          onChange={setCurrentAngle}
          format={{ precision: 0, unit: "°" }}
        />
        <SliderRow
          label="Deadband"
          min={0}
          max={50}
          step={1}
          value={state.deadband}
          onChange={setDeadband}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Sky scenario"
          min={0}
          max={PATTERNS.length - 1}
          step={1}
          value={patternIndex(state.sky)}
          onChange={setSkyIndex}
          format={{ precision: 0 }}
        />
      </div>

      <div className="st-visualizer__actions">
        <button
          type="button"
          className="st-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset solar tracker"
        >
          ↺ Reset
        </button>
        <span className="st-visualizer__counter" aria-live="polite">
          {`direction: ${result.direction} · next=${result.nextAngle}°`}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG sub-components
// ---------------------------------------------------------------------------

interface PanelDiagramProps {
  angle: number;
  direction: "east" | "west" | "hold";
  east: number;
  west: number;
  sunFraction: number;
}

function PanelDiagram({
  angle,
  direction,
  east,
  west,
  sunFraction,
}: PanelDiagramProps) {
  const w = 360;
  const h = 280;
  const cx = w / 2;
  const cy = h * 0.72;

  // Sun follows an arc from east (left) to west (right).
  const arcR = h * 0.55;
  const theta = Math.PI * (1 - sunFraction); // 0=west(right), π=east(left)
  const sunX = cx + arcR * Math.cos(theta);
  const sunY = cy - arcR * Math.sin(theta);

  // Panel rectangle, rotated about (cx, cy).
  const panelW = 160;
  const panelH = 12;

  // Arrow direction
  const arrowLen = 60;
  let arrowDx = 0;
  let arrowLabel = "hold";
  if (direction === "east") {
    arrowDx = -arrowLen;
    arrowLabel = "east";
  } else if (direction === "west") {
    arrowDx = arrowLen;
    arrowLabel = "west";
  }

  return (
    <svg
      className="st-visualizer__panel"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Sun and panel diagram, direction ${arrowLabel}`}
    >
      {/* horizon */}
      <line x1={0} y1={cy + 30} x2={w} y2={cy + 30} stroke="#c2bda8" strokeWidth={1} />
      <text x={8} y={cy + 45} fontSize={11} fill="#888">
        E
      </text>
      <text x={w - 16} y={cy + 45} fontSize={11} fill="#888">
        W
      </text>

      {/* sun */}
      <circle cx={sunX} cy={sunY} r={18} fill="#f5b800" />
      <circle cx={sunX} cy={sunY} r={26} fill="#f5b800" fillOpacity={0.18} />

      {/* panel post */}
      <line x1={cx} y1={cy} x2={cx} y2={cy + 30} stroke="#555" strokeWidth={3} />

      {/* panel (rotated) */}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <rect
          x={cx - panelW / 2}
          y={cy - panelH / 2}
          width={panelW}
          height={panelH}
          fill="#2c5d8f"
          stroke="#1a3a5c"
          strokeWidth={1.5}
        />
        {/* East LDR pad (left end of panel in local frame) */}
        <circle cx={cx - panelW / 2 + 8} cy={cy} r={5} fill="#ffcb47" />
        <text x={cx - panelW / 2 + 8} y={cy - 10} fontSize={10} textAnchor="middle" fill="#333">
          E:{east}
        </text>
        {/* West LDR pad */}
        <circle cx={cx + panelW / 2 - 8} cy={cy} r={5} fill="#ffcb47" />
        <text x={cx + panelW / 2 - 8} y={cy - 10} fontSize={10} textAnchor="middle" fill="#333">
          W:{west}
        </text>
      </g>

      {/* direction arrow */}
      {direction === "hold" ? (
        <text x={cx} y={cy + 70} fontSize={12} textAnchor="middle" fill="#00693e">
          hold
        </text>
      ) : (
        <g>
          <line
            x1={cx}
            y1={cy + 60}
            x2={cx + arrowDx}
            y2={cy + 60}
            stroke="#00693e"
            strokeWidth={2}
          />
          <polygon
            points={`${cx + arrowDx},${cy + 60} ${cx + arrowDx - Math.sign(arrowDx) * 8},${cy + 56} ${cx + arrowDx - Math.sign(arrowDx) * 8},${cy + 64}`}
            fill="#00693e"
          />
          <text
            x={cx + arrowDx / 2}
            y={cy + 78}
            fontSize={11}
            textAnchor="middle"
            fill="#00693e"
          >
            {arrowLabel}
          </text>
        </g>
      )}
    </svg>
  );
}

interface AngleHistoryProps {
  points: readonly HistoryPoint[];
}

function AngleHistory({ points }: AngleHistoryProps) {
  const w = 360;
  const h = 220;
  const padL = 32;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const n = Math.max(1, points.length);
  const xFor = (i: number): number =>
    padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (a: number): number => padT + ((90 - a) / 180) * plotH;

  const polyline = points.map((p, i) => `${xFor(i)},${yFor(p.angle)}`).join(" ");

  return (
    <svg
      className="st-visualizer__history"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Panel angle history"
    >
      {/* axes */}
      <line
        x1={padL}
        y1={padT}
        x2={padL}
        y2={padT + plotH}
        stroke="#888"
        strokeWidth={1}
      />
      <line
        x1={padL}
        y1={padT + plotH}
        x2={padL + plotW}
        y2={padT + plotH}
        stroke="#888"
        strokeWidth={1}
      />
      {/* zero line */}
      <line
        x1={padL}
        y1={yFor(0)}
        x2={padL + plotW}
        y2={yFor(0)}
        stroke="#ddd"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text x={4} y={padT + 8} fontSize={10} fill="#666">
        +90°
      </text>
      <text x={4} y={padT + plotH} fontSize={10} fill="#666">
        −90°
      </text>
      <text x={4} y={yFor(0) + 3} fontSize={10} fill="#666">
        0°
      </text>

      {/* trajectory */}
      <polyline points={polyline} fill="none" stroke="#00693e" strokeWidth={2} />

      {/* point markers; red if clamped */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xFor(i)}
          cy={yFor(p.angle)}
          r={p.clamped ? 4 : 2.5}
          className={p.clamped ? "st-visualizer__clamped" : undefined}
          fill={p.clamped ? "#cf4f4f" : "#00693e"}
        />
      ))}
    </svg>
  );
}
