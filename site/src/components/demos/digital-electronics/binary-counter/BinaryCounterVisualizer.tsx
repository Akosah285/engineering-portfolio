import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type TraceFrame, type TraceInput, trace } from "./algorithm";
import { type BinaryCounterDemoState, DEFAULT_STATE, PRESETS } from "./presets";
import "./BinaryCounterVisualizer.css";

/**
 * <BinaryCounterVisualizer> — v9 Digital Electronics counter demo (#118).
 *
 * Wraps the pure `algorithm.ts` (makeCounter / tick / trace) in a 2-panel
 * canvas: per-bit square-wave traces with a dashed carry pulse train on
 * top, plus a live LED bubble panel showing the current count.
 */

const FRAME_INTERVAL_MS = 250;

const STATE_SCHEMA = {
  bits: { type: "number", default: DEFAULT_STATE.bits },
  nTicks: { type: "number", default: DEFAULT_STATE.nTicks },
  initial: { type: "number", default: DEFAULT_STATE.initial },
  direction: {
    type: "enum",
    default: DEFAULT_STATE.direction,
    values: ["up", "down"] as const,
  },
} as const satisfies Schema;

function paintTraces(
  ctx: CanvasRenderingContext2D,
  frames: readonly TraceFrame[],
  bits: number,
  cursor: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, width, height);

  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Rows: carry on top, then bit (bits-1) down to bit 0 (LSB at bottom).
  const rows = bits + 1;
  const rowH = plotH / rows;
  const stepW = plotW / Math.max(1, frames.length - 1);

  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#555";

  // Axis labels
  ctx.fillText("C", 8, padT + rowH * 0.5);
  for (let b = 0; b < bits; b += 1) {
    const rowIdx = 1 + (bits - 1 - b);
    ctx.fillText(`b${b}`, 8, padT + rowH * (rowIdx + 0.5));
  }

  // Carry row — dashed pulse train
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 1.5;
  const carryTop = padT + rowH * 0.25;
  const carryBot = padT + rowH * 0.75;
  ctx.beginPath();
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i]!;
    const x0 = padL + i * stepW;
    const x1 = padL + Math.min(frames.length - 1, i + 1) * stepW;
    const y = f.carry ? carryTop : carryBot;
    if (i === 0) ctx.moveTo(x0, y);
    else ctx.lineTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  ctx.restore();

  // Bit rows — square waves
  ctx.strokeStyle = "#00693e";
  ctx.lineWidth = 1.75;
  for (let b = 0; b < bits; b += 1) {
    const rowIdx = 1 + (bits - 1 - b);
    const yTop = padT + rowH * (rowIdx + 0.2);
    const yBot = padT + rowH * (rowIdx + 0.8);
    ctx.beginPath();
    let prevY = yBot;
    for (let i = 0; i < frames.length; i += 1) {
      const v = frames[i]!.bits[b]!;
      const x0 = padL + i * stepW;
      const x1 = padL + Math.min(frames.length - 1, i + 1) * stepW;
      const y = v === 1 ? yTop : yBot;
      if (i === 0) {
        ctx.moveTo(x0, y);
      } else if (y !== prevY) {
        ctx.lineTo(x0, prevY);
        ctx.lineTo(x0, y);
      }
      ctx.lineTo(x1, y);
      prevY = y;
    }
    ctx.stroke();
  }

  // Moving cursor
  const cx = padL + cursor * stepW;
  ctx.strokeStyle = "rgba(207, 79, 79, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, padT);
  ctx.lineTo(cx, padT + plotH);
  ctx.stroke();

  // Baseline tick labels
  ctx.fillStyle = "#888";
  ctx.fillText("0", padL, height - 6);
  const lastLabel = String(frames.length - 1);
  ctx.fillText(lastLabel, padL + plotW - 14, height - 6);
}

export function BinaryCounterVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "binary-counter",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  // Clamp `initial` if `bits` shrinks under it.
  useEffect(() => {
    const max = 2 ** state.bits - 1;
    if (state.initial > max) {
      setState({ ...state, initial: max });
    }
  }, [state, setState]);

  const frames = useMemo<TraceFrame[]>(() => {
    const input: TraceInput = {
      bits: state.bits,
      nTicks: state.nTicks,
      initial: Math.min(state.initial, 2 ** state.bits - 1),
      direction: state.direction,
    };
    return trace(input);
  }, [state.bits, state.nTicks, state.initial, state.direction]);

  const carryCount = useMemo(
    () => frames.reduce((acc, f) => acc + (f.carry ? 1 : 0), 0),
    [frames],
  );

  const cursorRef = useRef(0);
  const accRef = useRef(0);
  const [cursorTick, setCursorTick] = useState(0);

  // Reset cursor when frames change.
  useEffect(() => {
    cursorRef.current = 0;
    accRef.current = 0;
    setCursorTick(0);
  }, [frames]);

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      accRef.current += deltaMs;
      let advanced = false;
      while (accRef.current >= FRAME_INTERVAL_MS) {
        accRef.current -= FRAME_INTERVAL_MS;
        cursorRef.current = (cursorRef.current + 1) % frames.length;
        advanced = true;
      }
      if (advanced) setCursorTick(cursorRef.current);
      paintTraces(ctx, frames, state.bits, cursorRef.current);
    },
    [frames, state.bits],
  );

  const currentFrame = frames[cursorTick] ?? frames[0]!;
  const decimal = currentFrame.count;
  const hex = `0x${decimal
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(state.bits / 4), "0")}`;
  const binary = Array.from({ length: state.bits }, (_, i) =>
    currentFrame.bits[state.bits - 1 - i]! === 1 ? "1" : "0",
  ).join("");

  const handleReset = (): void => {
    reset();
    cursorRef.current = 0;
    accRef.current = 0;
    setCursorTick(0);
  };

  const handlePresetSelect = (next: BinaryCounterDemoState): void => {
    setState(next);
  };

  const initialMax = 2 ** state.bits - 1;

  return (
    <div className="bc-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly {
            name: string;
            state: typeof DEFAULT_STATE;
          }[] as { name: string; state: typeof state }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Binary counter presets"
      />

      <div className="bc-visualizer__stage">
        <div className="bc-visualizer__panel">
          <DemoCanvas
            width={640}
            height={320}
            ariaLabel={`Binary counter waveform: ${state.bits}-bit ${state.direction}-counter over ${state.nTicks} ticks`}
            draw={draw}
          />
        </div>
        <div className="bc-visualizer__panel bc-visualizer__state">
          <div className="bc-visualizer__leds" aria-label="Current count bits">
            {Array.from({ length: state.bits }, (_, b) => {
              const on = currentFrame.bits[b]! === 1;
              return (
                <div
                  key={b}
                  className={
                    on
                      ? "bc-visualizer__led bc-visualizer__led--on"
                      : "bc-visualizer__led"
                  }
                  title={`bit ${b}`}
                >
                  {b}
                </div>
              );
            })}
          </div>
          <div className="bc-visualizer__readouts">
            <div>dec: {decimal}</div>
            <div>hex: {hex}</div>
            <div>bin: {binary}</div>
          </div>
        </div>
      </div>

      <div className="bc-visualizer__hud" aria-label="Counter HUD">
        <span>bits: {state.bits}</span>
        <span>count: {decimal}</span>
        <span>direction: {state.direction}</span>
        <span>carry-cycles: {carryCount}</span>
      </div>

      <div className="bc-visualizer__controls">
        <SliderRow
          label="bits"
          description="Counter width (number of flip-flops)."
          min={1}
          max={8}
          step={1}
          value={state.bits}
          onChange={(bits) => setState({ ...state, bits })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="nTicks"
          description="How many clock ticks to simulate and plot."
          min={4}
          max={64}
          step={4}
          value={state.nTicks}
          onChange={(nTicks) => setState({ ...state, nTicks })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="initial (start)"
          description="Starting count value (parallel load)."
          min={0}
          max={initialMax}
          step={1}
          value={Math.min(state.initial, initialMax)}
          onChange={(initial) => setState({ ...state, initial })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="bc-visualizer__actions">
        <button type="button" className="bc-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="bc-visualizer__counter" aria-live="off">
          count {decimal} · carry cycles {carryCount}
        </span>
      </div>
    </div>
  );
}

export default BinaryCounterVisualizer;
