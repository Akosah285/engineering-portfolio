import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type BusEvent, frameTransaction } from "./algorithm";
import {
  DEFAULT_STATE,
  type I2cDemoState,
  type I2cPreset,
  PRESETS,
  TRANSACTIONS,
  TXN_SLUGS,
  type TxnSlug,
  getTransactionInput,
} from "./presets";
import "./I2cProtocolVisualizer.css";

const STATE_SCHEMA = {
  transaction: {
    type: "enum",
    default: DEFAULT_STATE.transaction,
    values: TXN_SLUGS,
  },
  cursor: { type: "number", default: DEFAULT_STATE.cursor },
} as const satisfies Schema;

const COL_W = 40;
const SVG_H = 260;
const LEFT_PAD = 60;
const RIGHT_PAD = 20;
const SCL_Y_HIGH = 110;
const SCL_Y_LOW = 150;
const SDA_Y_HIGH = 180;
const SDA_Y_LOW = 220;
const LABEL_BASELINE = 70;

type ColumnKind = "start" | "stop" | "ack" | "bit";

function classifyEvent(label: string): ColumnKind {
  if (label === "START") return "start";
  if (label === "STOP") return "stop";
  if (label.includes("ACK")) return "ack";
  return "bit";
}

function sclPath(x: number): string {
  return [
    `M ${x},${SCL_Y_LOW}`,
    `L ${x + 8},${SCL_Y_LOW}`,
    `L ${x + 8},${SCL_Y_HIGH}`,
    `L ${x + COL_W - 8},${SCL_Y_HIGH}`,
    `L ${x + COL_W - 8},${SCL_Y_LOW}`,
    `L ${x + COL_W},${SCL_Y_LOW}`,
  ].join(" ");
}

function sdaPath(x: number, sda: number): string {
  const y = sda === 1 ? SDA_Y_HIGH : SDA_Y_LOW;
  return `M ${x},${y} L ${x + COL_W},${y}`;
}

function toHex2(byte: number): string {
  return `0x${byte.toString(16).toUpperCase().padStart(2, "0")}`;
}

function I2cProtocolVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "i2c-protocol",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const input = useMemo(
    () => getTransactionInput(state.transaction),
    [state.transaction],
  );
  const frame = useMemo(() => frameTransaction(input), [input]);
  const events: readonly BusEvent[] = frame.events;
  const eventCount = events.length;
  const cursorMax = Math.max(0, eventCount - 1);
  const cursor = Math.max(0, Math.min(state.cursor, cursorMax));

  const txnIndexRaw = TXN_SLUGS.indexOf(state.transaction);
  const txnIndex = txnIndexRaw >= 0 ? txnIndexRaw : 0;
  const txnEntry = TRANSACTIONS[txnIndex];
  const txnDisplayName = txnEntry ? txnEntry.name : state.transaction;

  const svgWidth = LEFT_PAD + eventCount * COL_W + RIGHT_PAD;

  const handlePresetSelect = (next: I2cDemoState): void => {
    setState({ transaction: next.transaction, cursor: 0 });
  };

  const handleTransactionSlider = (n: number): void => {
    const idx = Math.max(0, Math.min(TXN_SLUGS.length - 1, Math.round(n)));
    const slug = TXN_SLUGS[idx] ?? DEFAULT_STATE.transaction;
    setState({ transaction: slug as TxnSlug, cursor: 0 });
  };

  const handleCursorSlider = (n: number): void => {
    const next = Math.max(0, Math.min(cursorMax, Math.round(n)));
    setState({ ...state, cursor: next });
  };

  const handleReset = (): void => {
    reset();
  };

  const addrHex = toHex2(input.address);
  const rwLetter = input.read ? "R" : "W";
  const dataHex = input.data.map(toHex2).join(", ");
  const decodedSummary = `addr=${addrHex} (R/W=${rwLetter}) · bytes=[${dataHex}] · acks=${frame.ackCount}`;

  const cursorX = LEFT_PAD + cursor * COL_W + COL_W / 2;

  return (
    <div className="i2c-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly I2cPreset[] as unknown as {
            name: string;
            state: I2cDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="I2C transaction presets"
      />

      <div className="i2c-visualizer__hud" role="status" aria-live="polite">
        {`${txnDisplayName} · event ${cursor + 1} of ${eventCount}`}
      </div>

      <div className="i2c-visualizer__stage">
        <svg
          className="i2c-visualizer__svg"
          width={svgWidth}
          height={SVG_H}
          viewBox={`0 0 ${svgWidth} ${SVG_H}`}
          role="img"
          aria-label={`I2C waveform for ${txnDisplayName}`}
        >
          {/* Lane labels */}
          <text x={8} y={SCL_Y_HIGH + 4} className="i2c-visualizer__lane-label">
            SCL
          </text>
          <text x={8} y={SDA_Y_HIGH + 4} className="i2c-visualizer__lane-label">
            SDA
          </text>

          {/* Column backgrounds + labels */}
          {events.map((ev, i) => {
            const x = LEFT_PAD + i * COL_W;
            const kind = classifyEvent(ev.label);
            const bgClass =
              kind === "start"
                ? "i2c-visualizer__col-bg--start"
                : kind === "stop"
                  ? "i2c-visualizer__col-bg--stop"
                  : kind === "ack"
                    ? "i2c-visualizer__col-bg--ack"
                    : null;
            const labelClass =
              kind === "start"
                ? "i2c-visualizer__label i2c-visualizer__label--start"
                : kind === "stop"
                  ? "i2c-visualizer__label i2c-visualizer__label--stop"
                  : kind === "ack"
                    ? "i2c-visualizer__label i2c-visualizer__label--ack"
                    : "i2c-visualizer__label";
            return (
              <g key={`col-${i}`}>
                {bgClass ? (
                  <rect
                    x={x}
                    y={SCL_Y_HIGH - 10}
                    width={COL_W}
                    height={SDA_Y_LOW - SCL_Y_HIGH + 20}
                    className={bgClass}
                  />
                ) : null}
                <text
                  x={x + COL_W / 2}
                  y={LABEL_BASELINE}
                  className={labelClass}
                  textAnchor="end"
                  transform={`rotate(-30, ${x + COL_W / 2}, ${LABEL_BASELINE})`}
                >
                  {ev.label}
                </text>
              </g>
            );
          })}

          {/* SCL path */}
          {events.map((_, i) => (
            <path
              key={`scl-${i}`}
              d={sclPath(LEFT_PAD + i * COL_W)}
              fill="none"
              stroke="#2a6ed4"
              strokeWidth={2}
            />
          ))}

          {/* SDA path */}
          {events.map((ev, i) => (
            <path
              key={`sda-${i}`}
              d={sdaPath(LEFT_PAD + i * COL_W, ev.sda)}
              fill="none"
              stroke="#00693e"
              strokeWidth={2}
            />
          ))}

          {/* Cursor */}
          {eventCount > 0 ? (
            <line
              x1={cursorX}
              y1={SCL_Y_HIGH - 10}
              x2={cursorX}
              y2={SDA_Y_LOW + 10}
              className="i2c-visualizer__cursor"
            />
          ) : null}
        </svg>
      </div>

      <div className="i2c-visualizer__decoded">{decodedSummary}</div>

      <div className="i2c-visualizer__controls">
        <SliderRow
          label="Cursor (event idx)"
          min={0}
          max={cursorMax}
          step={1}
          value={cursor}
          onChange={handleCursorSlider}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Transaction"
          min={0}
          max={TXN_SLUGS.length - 1}
          step={1}
          value={txnIndex}
          onChange={handleTransactionSlider}
          format={{ precision: 0 }}
        />
      </div>

      <div className="i2c-visualizer__actions">
        <button
          type="button"
          className="i2c-visualizer__btn"
          onClick={handleReset}
          aria-label="Reset i2c protocol"
        >
          ↺ Reset
        </button>
        <span className="i2c-visualizer__counter" aria-live="off">
          {`acks: ${frame.ackCount} · bytes: ${frame.byteCount}`}
        </span>
      </div>
    </div>
  );
}

export default I2cProtocolVisualizer;
