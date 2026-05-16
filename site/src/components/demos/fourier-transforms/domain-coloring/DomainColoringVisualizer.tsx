import { useCallback, useEffect, useMemo, useRef } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type ComplexF,
  type HSV,
  colorGrid,
  hsvToRgb,
} from "./algorithm";
import {
  DEFAULT_STATE,
  FN_SLOTS,
  type FnSlot,
  PRESETS,
} from "./presets";
import "./DomainColoringVisualizer.css";

/**
 * <DomainColoringVisualizer> — visualises f: C → C via HSV domain coloring.
 *
 * Wires the algorithm in `./algorithm.ts` to the demo-kit primitives (sliders,
 * preset carousel, URL-shareable state) and paints the resulting grid to a
 * canvas with axis + grid overlays.
 */

const CANVAS_PX = 360;
const X_MIN = -2;
const X_MAX = 2;
const Y_MIN = -2;
const Y_MAX = 2;

type ComplexFn = (z: ComplexF) => ComplexF;

const FN_TABLE: Record<FnSlot, ComplexFn> = {
  z: (z) => z,
  z2: (z) => ({ re: z.re * z.re - z.im * z.im, im: 2 * z.re * z.im }),
  z3: (z) => {
    const z2: ComplexF = {
      re: z.re * z.re - z.im * z.im,
      im: 2 * z.re * z.im,
    };
    return {
      re: z2.re * z.re - z2.im * z.im,
      im: z2.re * z.im + z2.im * z.re,
    };
  },
  "1/z": (z) => {
    const r2 = z.re * z.re + z.im * z.im;
    if (r2 === 0) return { re: Number.POSITIVE_INFINITY, im: 0 };
    return { re: z.re / r2, im: -z.im / r2 };
  },
  "z2-1": (z) => ({
    re: z.re * z.re - z.im * z.im - 1,
    im: 2 * z.re * z.im,
  }),
  "sin-z": (z) => ({
    re: Math.sin(z.re) * Math.cosh(z.im),
    im: Math.cos(z.re) * Math.sinh(z.im),
  }),
  "exp-z": (z) => ({
    re: Math.exp(z.re) * Math.cos(z.im),
    im: Math.exp(z.re) * Math.sin(z.im),
  }),
};

const FN_LABEL: Record<FnSlot, string> = {
  z: "f(z) = z",
  z2: "f(z) = z²",
  z3: "f(z) = z³",
  "1/z": "f(z) = 1/z",
  "z2-1": "f(z) = z² − 1",
  "sin-z": "f(z) = sin(z)",
  "exp-z": "f(z) = exp(z)",
};

const STATE_SCHEMA = {
  gridSize: { type: "number", default: DEFAULT_STATE.gridSize },
  fnSlot: { type: "enum", default: DEFAULT_STATE.fnSlot, values: FN_SLOTS },
} as const satisfies Schema;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function safeHsvToRgb(hsv: HSV): { r: number; g: number; b: number } {
  const h = hsv.h >= 1 ? 0 : hsv.h < 0 ? 0 : hsv.h;
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);
  return hsvToRgb({ h, s, v });
}

function worldToCanvasX(x: number): number {
  return ((x - X_MIN) / (X_MAX - X_MIN)) * CANVAS_PX;
}

function worldToCanvasY(y: number): number {
  // image-space y descends, so y=Y_MAX -> top (0)
  return ((Y_MAX - y) / (Y_MAX - Y_MIN)) * CANVAS_PX;
}

function paintDomainColoring(
  ctx: CanvasRenderingContext2D,
  f: ComplexFn,
  gridSize: number,
): void {
  const pixels = colorGrid(f, {
    xMin: X_MIN,
    xMax: X_MAX,
    yMin: Y_MIN,
    yMax: Y_MAX,
    width: gridSize,
    height: gridSize,
  });

  // Render at native gridSize into an offscreen canvas, then upscale.
  const tmp = document.createElement("canvas");
  tmp.width = gridSize;
  tmp.height = gridSize;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;

  const img = tctx.createImageData(gridSize, gridSize);
  for (let j = 0; j < gridSize; j++) {
    for (let i = 0; i < gridSize; i++) {
      const idx = j * gridSize + i;
      const hsv = pixels[idx]!;
      const rgb = safeHsvToRgb(hsv);
      const k = idx * 4;
      img.data[k] = Math.round(clamp01(rgb.r) * 255);
      img.data[k + 1] = Math.round(clamp01(rgb.g) * 255);
      img.data[k + 2] = Math.round(clamp01(rgb.b) * 255);
      img.data[k + 3] = 255;
    }
  }
  tctx.putImageData(img, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
  ctx.drawImage(tmp, 0, 0, CANVAS_PX, CANVAS_PX);

  // Faint grid at ±0.5, ±1.0, ±1.5, ±2.0
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  const ticks = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
  for (const v of ticks) {
    const cx = worldToCanvasX(v);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, CANVAS_PX);
    ctx.stroke();
    const cy = worldToCanvasY(v);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(CANVAS_PX, cy);
    ctx.stroke();
  }

  // Axis cross at the origin
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 1.25;
  const ox = worldToCanvasX(0);
  const oy = worldToCanvasY(0);
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, CANVAS_PX);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(CANVAS_PX, oy);
  ctx.stroke();
}

function snapGridSize(n: number): number {
  const stepped = Math.round(n / 20) * 20;
  if (stepped < 40) return 40;
  if (stepped > 200) return 200;
  return stepped;
}

function DomainColoringVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "domain-coloring",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const fnSlot = state.fnSlot;
  const gridSize = snapGridSize(state.gridSize);

  const f = useMemo<ComplexFn>(() => FN_TABLE[fnSlot], [fnSlot]);
  const fnLabel = FN_LABEL[fnSlot];
  const fAtOrigin = useMemo(() => f({ re: 0, im: 0 }), [f]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Redraw on any input change. No animation loop — the image is static.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintDomainColoring(ctx, f, gridSize);
  }, [f, gridSize]);

  const handlePresetSelect = useCallback(
    (next: typeof DEFAULT_STATE) => {
      setState(next);
    },
    [setState],
  );

  const fnIndex = FN_SLOTS.indexOf(fnSlot);

  const formatComplex = (z: ComplexF): string => {
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return "∞";
    const re = z.re.toFixed(2);
    const sign = z.im >= 0 ? "+" : "−";
    const im = Math.abs(z.im).toFixed(2);
    return `${re} ${sign} ${im}i`;
  };

  return (
    <div className="dc-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Domain coloring presets"
      />

      <div className="dc-visualizer__stage">
        <canvas
          ref={canvasRef}
          className="dc-visualizer__canvas"
          width={CANVAS_PX}
          height={CANVAS_PX}
          role="img"
          aria-label={`Domain coloring of ${fnLabel} on the square [-2, 2] × [-2, 2]`}
        />
        <div className="dc-visualizer__hud" role="group" aria-label="Current parameters">
          <span className="dc-visualizer__hud-line">{fnLabel}</span>
          <span className="dc-visualizer__hud-line">
            grid {gridSize}×{gridSize} px
          </span>
          <span className="dc-visualizer__hud-line">
            f(0+0i) = {formatComplex(fAtOrigin)}
          </span>
        </div>
      </div>

      <div className="dc-visualizer__controls">
        <SliderRow
          label="Grid resolution"
          description="Samples per axis. Higher = sharper, but slower to recompute."
          min={40}
          max={200}
          step={20}
          value={gridSize}
          onChange={(gs) => setState({ ...state, gridSize: snapGridSize(gs) })}
          format={{ precision: 0, unit: "px" }}
        />
        <SliderRow
          label="f(z) function"
          description="Pick a complex map. Hue encodes arg(f); brightness encodes |f|."
          min={0}
          max={FN_SLOTS.length - 1}
          step={1}
          value={fnIndex}
          onChange={(idx) => {
            const i = Math.max(0, Math.min(FN_SLOTS.length - 1, Math.round(idx)));
            const slot = FN_SLOTS[i] ?? DEFAULT_STATE.fnSlot;
            setState({ ...state, fnSlot: slot });
          }}
          format={{ precision: 0 }}
          hideTicks
        />
      </div>

      <div className="dc-visualizer__actions">
        <button type="button" className="dc-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="dc-visualizer__counter" aria-live="off">
          {fnLabel} · grid {gridSize}×{gridSize} px
        </span>
      </div>
    </div>
  );
}

export default DomainColoringVisualizer;
export { DomainColoringVisualizer };
