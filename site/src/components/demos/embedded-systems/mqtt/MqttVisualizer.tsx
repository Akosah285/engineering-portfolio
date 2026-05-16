import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type PublishEvent, publishFlow, topicMatches } from "./algorithm";
import { SCENARIOS, SCENARIO_SLUGS, type ScenarioSlug, getScenario } from "./presets";
import "./MqttVisualizer.css";

const DEFAULT_SCENARIO: ScenarioSlug = "qos0-fire-forget";

const STATE_SCHEMA = {
  scenario: {
    type: "enum",
    default: DEFAULT_SCENARIO,
    values: SCENARIO_SLUGS,
  },
  cursor: { type: "number", default: 0 },
} as const satisfies Schema;

type MqttState = { scenario: ScenarioSlug; cursor: number };

const LIFELINES = ["publisher", "broker", "subscriber"] as const;
type Lifeline = (typeof LIFELINES)[number];

const LIFELINE_X: Record<Lifeline, number> = {
  publisher: 100,
  broker: 320,
  subscriber: 540,
};

const KIND_COLOR: Record<PublishEvent["kind"], string> = {
  PUBLISH: "#1f77b4",
  PUBACK: "#2ca02c",
  PUBREC: "#ff7f0e",
  PUBREL: "#ff7f0e",
  PUBCOMP: "#2ca02c",
};

const HEADER_Y = 40;
const FIRST_EVENT_Y = 90;
const EVENT_SPACING = 36;
const SVG_WIDTH = 640;
const SVG_HEIGHT = 400;

function safeTopicMatches(filter: string, topic: string): boolean {
  try {
    return topicMatches(filter, topic);
  } catch {
    return false;
  }
}

function safePublishFlow(slug: ScenarioSlug): PublishEvent[] {
  const sc = getScenario(slug);
  try {
    return publishFlow({
      topic: sc.topic,
      payload: sc.payload,
      publishQos: sc.publishQos,
      subscription: sc.subscription,
      messageId: sc.messageId,
    });
  } catch {
    return [];
  }
}

interface ArrowProps {
  ev: PublishEvent;
  y: number;
  active: boolean;
  dim: boolean;
}

function Arrow({ ev, y, active, dim }: ArrowProps) {
  const x1 = LIFELINE_X[ev.from as Lifeline];
  const x2 = LIFELINE_X[ev.to as Lifeline];
  const color = KIND_COLOR[ev.kind];
  const stroke = active ? 3 : 1.5;
  const opacity = dim ? 0.25 : 1;
  const dir = x2 >= x1 ? 1 : -1;
  const headSize = 8;
  const tipX = x2 - dir * 2;
  const headBackX = tipX - dir * headSize;
  const midX = (x1 + x2) / 2;
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y} x2={tipX} y2={y} stroke={color} strokeWidth={stroke} />
      <polygon
        points={`${tipX},${y} ${headBackX},${y - headSize / 2} ${headBackX},${y + headSize / 2}`}
        fill={color}
      />
      <text
        x={midX}
        y={y - 6}
        textAnchor="middle"
        fontSize="12"
        fontFamily="ui-monospace, monospace"
        fill={color}
      >
        {ev.kind}
      </text>
    </g>
  );
}

export default function MqttVisualizer() {
  const [rawState, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "mqtt",
    STATE_SCHEMA,
    { scenario: DEFAULT_SCENARIO, cursor: 0 } as unknown as {
      scenario: "qos0-fire-forget";
      cursor: 0;
    },
  );
  const state = rawState as unknown as MqttState;
  type DemoState = typeof rawState;

  const scenario = useMemo(() => getScenario(state.scenario), [state.scenario]);
  const events = useMemo(() => safePublishFlow(state.scenario), [state.scenario]);
  const matched = safeTopicMatches(scenario.subscription.filter, scenario.topic);
  const effectiveQos = Math.min(scenario.publishQos, scenario.subscription.qos);

  const maxCursor = events.length;
  const cursor = Math.min(Math.max(0, state.cursor), maxCursor);

  const scenarioIndex = Math.max(
    0,
    SCENARIOS.findIndex((s) => s.slug === state.scenario),
  );

  const presets = useMemo(
    () =>
      SCENARIOS.map((s) => ({
        name: s.name,
        state: { scenario: s.slug, cursor: 0 } satisfies MqttState,
      })),
    [],
  );

  const handlePresetSelect = (next: MqttState): void => {
    setState({ scenario: next.scenario, cursor: 0 } as unknown as DemoState);
  };

  const handleCursorChange = (next: number): void => {
    setState({ ...state, cursor: Math.round(next) } as unknown as DemoState);
  };

  const handleScenarioChange = (next: number): void => {
    const idx = Math.min(SCENARIOS.length - 1, Math.max(0, Math.round(next)));
    const picked = SCENARIOS[idx];
    if (!picked) return;
    setState({ scenario: picked.slug, cursor: 0 } as unknown as DemoState);
  };

  const handleReset = (): void => {
    reset();
  };

  return (
    <div className="mqtt-visualizer">
      <PresetCarousel
        presets={
          presets as unknown as {
            name: string;
            state: MqttState;
          }[]
        }
        onSelect={handlePresetSelect}
        initialIndex={scenarioIndex}
        ariaLabel="MQTT scenario presets"
      />

      <div className="mqtt-visualizer__stage">
        <svg
          className="mqtt-visualizer__svg"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label="MQTT publish flow sequence diagram"
        >
          {LIFELINES.map((name) => {
            const x = LIFELINE_X[name];
            const label = name.charAt(0).toUpperCase() + name.slice(1);
            return (
              <g key={name}>
                <rect
                  x={x - 60}
                  y={HEADER_Y - 22}
                  width={120}
                  height={28}
                  rx={4}
                  fill="#fff"
                  stroke="#888"
                />
                <text
                  x={x}
                  y={HEADER_Y - 4}
                  textAnchor="middle"
                  fontSize="13"
                  fontFamily="ui-sans-serif, system-ui"
                  fill="#222"
                >
                  {label}
                </text>
                <line
                  x1={x}
                  y1={HEADER_Y + 8}
                  x2={x}
                  y2={SVG_HEIGHT - 20}
                  stroke="#aaa"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {events.map((ev, i) => {
            const y = FIRST_EVENT_Y + i * EVENT_SPACING;
            const dim = i >= cursor;
            const active = i === cursor - 1;
            return (
              <Arrow
                key={`${ev.kind}-${ev.from}-${ev.to}-${i}`}
                ev={ev}
                y={y}
                active={active}
                dim={dim}
              />
            );
          })}

          {events.length === 0 ? (
            <text
              x={SVG_WIDTH / 2}
              y={FIRST_EVENT_Y + 40}
              textAnchor="middle"
              fontSize="14"
              fontFamily="ui-sans-serif, system-ui"
              fill="#888"
            >
              filter does not match topic — no events
            </text>
          ) : null}
        </svg>
      </div>

      <div className="mqtt-visualizer__match">
        <div className="mqtt-visualizer__match-cell">
          <span className="mqtt-visualizer__match-label">filter</span>
          <span className="mqtt-visualizer__match-value">
            {scenario.subscription.filter}
          </span>
        </div>
        <div className="mqtt-visualizer__match-cell">
          <span className="mqtt-visualizer__match-label">topic</span>
          <span className="mqtt-visualizer__match-value">{scenario.topic}</span>
        </div>
        <div className="mqtt-visualizer__match-cell">
          <span className="mqtt-visualizer__match-label">match</span>
          <span
            className={
              matched
                ? "mqtt-visualizer__match-value mqtt-visualizer__match-ok"
                : "mqtt-visualizer__match-value mqtt-visualizer__match-bad"
            }
          >
            {matched ? "✓" : "✗"}
          </span>
        </div>
        <div className="mqtt-visualizer__match-cell">
          <span className="mqtt-visualizer__match-label">effective QoS</span>
          <span className="mqtt-visualizer__match-value">{effectiveQos}</span>
        </div>
      </div>

      <div className="mqtt-visualizer__hud" aria-live="polite">
        {`${scenario.name} · event ${cursor} of ${events.length} · effective QoS=${effectiveQos}`}
      </div>

      <div className="mqtt-visualizer__controls">
        <SliderRow
          label="Cursor (event idx)"
          min={0}
          max={Math.max(maxCursor, 1)}
          step={1}
          value={cursor}
          onChange={handleCursorChange}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Scenario"
          min={0}
          max={Math.max(SCENARIOS.length - 1, 1)}
          step={1}
          value={scenarioIndex}
          onChange={handleScenarioChange}
          format={{ precision: 0 }}
        />
      </div>

      <div className="mqtt-visualizer__actions">
        <button
          type="button"
          className="mqtt-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset mqtt visualizer"
        >
          ↺ Reset
        </button>
        <span className="mqtt-visualizer__counter" aria-live="off">
          {`events: ${events.length} · matched: ${matched ? "yes" : "no"}`}
        </span>
      </div>
    </div>
  );
}
