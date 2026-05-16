import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type SevenSegmentPattern,
  decodeHex,
  isRepresentable,
  segmentCount,
} from "./algorithm";
import { DEFAULT_STATE, PRESETS } from "./presets";
import "./SevenSegmentVisualizer.css";

/**
 * <SevenSegmentVisualizer> — embedded-systems demo for the seven-segment
 * decoder (#129). Renders an array of stylised LED-style digits driven by
 * a user-supplied string and a brightness slider.
 */

const PRESET_SLUGS = ["hello", "count-0-7", "hex-AbCdEF", "year", "blank"] as const;

const STATE_SCHEMA = {
  presetSlug: {
    type: "enum",
    default: DEFAULT_STATE.presetSlug,
    values: PRESET_SLUGS,
  },
  text: { type: "string", default: DEFAULT_STATE.text },
  brightness: { type: "number", default: DEFAULT_STATE.brightness },
} as const satisfies Schema;

const MAX_SLOTS = 8;
const SLOT_WIDTH = 70;
const SLOT_HEIGHT = 110;
const DIGIT_WIDTH = 60;
const DIGIT_HEIGHT = 90;
const ACTIVE_COLOR = "#cc1100";
const INACTIVE_COLOR = "#333333";

interface SegmentRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SEGMENT_RECTS: readonly SegmentRect[] = [
  { x: 10, y: 5, w: 40, h: 8 }, // a
  { x: 50, y: 13, w: 8, h: 35 }, // b
  { x: 50, y: 50, w: 8, h: 35 }, // c
  { x: 10, y: 85, w: 40, h: 8 }, // d
  { x: 2, y: 50, w: 8, h: 35 }, // e
  { x: 2, y: 13, w: 8, h: 35 }, // f
  { x: 10, y: 43, w: 40, h: 6 }, // g
];

function patternsFor(text: string): {
  patterns: SevenSegmentPattern[];
  hasUnrepresentable: boolean;
} {
  const patterns: SevenSegmentPattern[] = [];
  let hasUnrepresentable = false;
  for (const ch of text) {
    if (isRepresentable(ch)) {
      patterns.push(decodeHex(ch));
    } else {
      hasUnrepresentable = true;
      patterns.push([0, 0, 0, 0, 0, 0, 0]);
    }
  }
  return { patterns, hasUnrepresentable };
}

function drawDigit(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  pattern: SevenSegmentPattern,
  brightness: number,
): void {
  const activeAlpha = 0.1 + (brightness / 100) * 0.9;
  const inactiveAlpha = 0.05;
  for (let i = 0; i < SEGMENT_RECTS.length; i += 1) {
    const rect = SEGMENT_RECTS[i]!;
    const lit = pattern[i] === 1;
    ctx.globalAlpha = lit ? activeAlpha : inactiveAlpha;
    ctx.fillStyle = lit ? ACTIVE_COLOR : INACTIVE_COLOR;
    ctx.fillRect(originX + rect.x, originY + rect.y, rect.w, rect.h);
  }
  ctx.globalAlpha = 1;
}

export function SevenSegmentVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "seven-segment",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const trimmed = state.text.slice(0, MAX_SLOTS);
  const { patterns, hasUnrepresentable } = useMemo(() => patternsFor(trimmed), [trimmed]);
  const totalLit = useMemo(
    () => patterns.reduce((sum, p) => sum + segmentCount(p), 0),
    [patterns],
  );

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);

      const slotCount = Math.max(1, patterns.length);
      const totalWidth = slotCount * SLOT_WIDTH;
      const startX = (width - totalWidth) / 2;
      const slotY = (height - SLOT_HEIGHT) / 2;
      const digitOffsetX = (SLOT_WIDTH - DIGIT_WIDTH) / 2;
      const digitOffsetY = (SLOT_HEIGHT - DIGIT_HEIGHT) / 2;

      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      patterns.forEach((pattern, i) => {
        const slotX = startX + i * SLOT_WIDTH;
        drawDigit(
          ctx,
          slotX + digitOffsetX,
          slotY + digitOffsetY,
          pattern,
          state.brightness,
        );
        const ch = trimmed[i] ?? "";
        ctx.fillStyle = "#aaa";
        ctx.globalAlpha = 1;
        ctx.fillText(
          ch === " " ? "·" : ch,
          slotX + SLOT_WIDTH / 2,
          slotY + SLOT_HEIGHT + 18,
        );
      });
    },
    [patterns, state.brightness, trimmed],
  );

  const nibbleLine = (() => {
    if (trimmed.length === 0) return "";
    const ch = trimmed[0]!;
    const parsed = Number.parseInt(ch, 16);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 15) {
      return `\\text{nibble[0]: 0x${parsed.toString(16).toUpperCase()}}`;
    }
    return "";
  })();

  const hudLines = [
    `\\text{text: "${trimmed}"}`,
    `\\text{lit: ${totalLit}}`,
    `\\text{slots: ${trimmed.length}}`,
    ...(nibbleLine ? [nibbleLine] : []),
  ];

  const narrationTemplate = (s: typeof state): string => {
    const t = s.text.slice(0, MAX_SLOTS);
    const base = `Displaying "${t}" on a ${t.length}-digit 7-segment array. ${totalLit} segments lit total.`;
    return hasUnrepresentable
      ? `${base} Warning: some characters are not representable and render blank.`
      : base;
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  const handleReset = (): void => {
    reset();
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setState({ ...state, text: event.target.value.slice(0, MAX_SLOTS) });
  };

  return (
    <div className="sv-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Seven-segment presets"
      />

      <div className="sv-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Seven-segment display showing "${trimmed}"`}
          draw={draw}
        />
        <MathHud corner="top-right" lines={hudLines} />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="sv-visualizer__controls">
        <div className="sv-visualizer__text-row">
          <label className="slider-row__label" htmlFor="sv-text-input">
            Display text
          </label>
          <input
            id="sv-text-input"
            type="text"
            className="sv-visualizer__text-input"
            maxLength={MAX_SLOTS}
            value={state.text}
            aria-label="Display text"
            onChange={handleTextChange}
          />
        </div>
        <SliderRow
          label="Brightness"
          description="LED segment brightness (10–100%)."
          min={10}
          max={100}
          step={10}
          value={state.brightness}
          onChange={(brightness) => setState({ ...state, brightness })}
          format={{ precision: 0, unit: "%" }}
        />
      </div>

      <div className="sv-visualizer__actions">
        <button type="button" className="sv-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <div className="sv-visualizer__counter" aria-live="off">
          segments lit: {totalLit}
        </div>
      </div>
    </div>
  );
}
