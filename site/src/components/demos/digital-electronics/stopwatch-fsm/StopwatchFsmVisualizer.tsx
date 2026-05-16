import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Event, replay } from "./algorithm";
import {
  DEFAULT_STATE,
  EVENT_LOGS,
  EVENTS_SLUGS,
  type EventsSlug,
  PRESETS,
  type StopwatchDemoState,
  defaultScrubFor,
  maxTimeFor,
} from "./presets";
import "./StopwatchFsmVisualizer.css";

/**
 * <StopwatchFsmVisualizer> — Lab 3 stopwatch FSM (Brown & Vranesic §8).
 *
 * Replays a discrete event log (startStop / lapReset presses) into the pure
 * `replay()` brain as the user scrubs `currentTime`. Renders a skeuomorphic
 * watch face with a sweeping hand, a digital readout, a lap list, and an
 * event tape highlighting events that have already fired.
 */

const STATE_SCHEMA = {
  currentTime: { type: "number", default: DEFAULT_STATE.currentTime },
  events: {
    type: "enum",
    default: DEFAULT_STATE.events,
    values: EVENTS_SLUGS,
  },
} as const satisfies Schema;

function formatTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${minutes}:${ss}.${mmm}`;
}

function eventLabel(e: Event): string {
  const name = e.input === "startStop" ? "S/S" : "L/R";
  return `${name}@${e.at}`;
}

export function StopwatchFsmVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "stopwatch-fsm",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const events = EVENT_LOGS[state.events];
  const maxTime = maxTimeFor(state.events);
  const currentTime = Math.min(Math.max(0, state.currentTime), maxTime);

  // Only replay events whose `at <= currentTime` so future events don't
  // pre-fire. Filtered set keeps non-decreasing order.
  const snap = useMemo(() => {
    const past = events.filter((e) => e.at <= currentTime);
    return replay([...past], currentTime);
  }, [events, currentTime]);

  const handPosMs = snap.elapsed % 1000;
  const handAngle = (handPosMs / 1000) * 360;

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: StopwatchDemoState): void => {
    setState(next);
  };

  // Slider for the events enum: a numeric proxy 0..N-1.
  const eventsIndex = EVENTS_SLUGS.indexOf(state.events);

  const stateClass = `sw-visualizer__badge sw-visualizer__badge--${snap.state}`;

  // SVG geometry
  const cx = 140;
  const cy = 140;
  const r = 130;
  const handLen = 110;
  // Angle 0° = up; we rotate clockwise.
  const rad = ((handAngle - 90) * Math.PI) / 180;
  const handX = cx + handLen * Math.cos(rad);
  const handY = cy + handLen * Math.sin(rad);

  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="sw-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly {
            name: string;
            state: typeof DEFAULT_STATE;
          }[] as { name: string; state: typeof state }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Stopwatch FSM presets"
      />

      <div className="sw-visualizer__stage">
        <div className="sw-visualizer__face">
          <span className={stateClass}>{snap.state.toUpperCase()}</span>
          <svg
            width={280}
            height={280}
            viewBox="0 0 280 280"
            role="img"
            aria-label={`Stopwatch face showing ${formatTime(snap.elapsed)} in ${snap.state} state`}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="#fdfdf6"
              stroke="#333"
              strokeWidth={3}
            />
            {ticks.map((i) => {
              const a = ((i * 6 - 90) * Math.PI) / 180;
              const inner = r - (i % 5 === 0 ? 12 : 6);
              const x1 = cx + r * Math.cos(a);
              const y1 = cy + r * Math.sin(a);
              const x2 = cx + inner * Math.cos(a);
              const y2 = cy + inner * Math.sin(a);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#444"
                  strokeWidth={i % 5 === 0 ? 2 : 1}
                />
              );
            })}
            <line
              x1={cx}
              y1={cy}
              x2={handX}
              y2={handY}
              stroke="#c0392b"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={5} fill="#333" />
            <text
              x={cx}
              y={cy + 50}
              textAnchor="middle"
              fontFamily="ui-monospace, Menlo, Consolas, monospace"
              fontSize={20}
              fontWeight={600}
              fill="#222"
            >
              {formatTime(snap.elapsed)}
            </text>
          </svg>
        </div>

        <div className="sw-visualizer__laps" aria-label="Lap times">
          <p className="sw-visualizer__laps-title">Laps</p>
          {snap.laps.length === 0 ? (
            <div className="sw-visualizer__lap sw-visualizer__lap--empty">
              No laps yet
            </div>
          ) : (
            snap.laps.map((lap, i) => (
              <div key={i} className="sw-visualizer__lap">
                Lap {i + 1} — {formatTime(lap)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sw-visualizer__tape" aria-label="Event tape">
        {events.length === 0 ? (
          <span className="sw-visualizer__tape-item">(no events)</span>
        ) : (
          events.map((e, i) => {
            const past = e.at <= currentTime;
            const cls = past
              ? "sw-visualizer__tape-item sw-visualizer__tape-item--past"
              : "sw-visualizer__tape-item";
            return (
              <span key={i} className={cls}>
                {eventLabel(e)}
              </span>
            );
          })
        )}
      </div>

      <div className="sw-visualizer__hud" aria-label="Stopwatch HUD">
        <span>
          {state.events} · t={currentTime}ms · state={snap.state.toUpperCase()}
        </span>
      </div>

      <div className="sw-visualizer__controls">
        <SliderRow
          label="Current time (ms)"
          description="Scrub through the event timeline."
          min={0}
          max={maxTime}
          step={10}
          value={currentTime}
          onChange={(currentTimeNext) =>
            setState({ ...state, currentTime: currentTimeNext })
          }
          format={{ unit: "ms" }}
        />
        <SliderRow
          label="Event log"
          description="Pick a recorded press sequence."
          min={0}
          max={EVENTS_SLUGS.length - 1}
          step={1}
          value={eventsIndex < 0 ? 0 : eventsIndex}
          onChange={(idx) => {
            const i = Math.max(0, Math.min(EVENTS_SLUGS.length - 1, Math.round(idx)));
            const slug = EVENTS_SLUGS[i] ?? DEFAULT_STATE.events;
            setState({ events: slug, currentTime: defaultScrubFor(slug) });
          }}
          format={{ precision: 0 }}
        />
      </div>

      <div className="sw-visualizer__actions">
        <button
          type="button"
          className="sw-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset stopwatch fsm"
        >
          ↺ Reset
        </button>
        <span className="sw-visualizer__counter" aria-live="off">
          elapsed: {formatTime(snap.elapsed)} · laps: {snap.laps.length}
        </span>
      </div>
    </div>
  );
}

export default StopwatchFsmVisualizer;
