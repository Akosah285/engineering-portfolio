import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { createDrawLoop, type DrawCallback } from "./drawLoop";
import "./DemoCanvas.css";

/**
 * <DemoCanvas> — sized canvas + draw-loop (plan §3.1, #15).
 *
 * Reserves explicit width/height up front so the canvas contributes
 * zero CLS, then runs `draw(ctx, deltaMs, totalMs)` once per animation
 * frame via the bundled `useDrawLoop` hook (no consumer-side RAF
 * boilerplate).
 *
 * Pass a `ref` to access the underlying `<canvas>` element for hit
 * testing, snapshot, etc.
 *
 * @example
 *   <DemoCanvas
 *     width={640}
 *     height={360}
 *     ariaLabel="Gradient-descent trajectory on a parabola"
 *     draw={(ctx, dt, t) => {
 *       ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
 *       // ... custom render ...
 *     }}
 *   />
 */

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  deltaMs: number,
  totalMs: number,
) => void;

export interface DemoCanvasProps {
  width: number;
  height: number;
  draw: DrawFn;
  /** Accessible label describing the canvas content. Required for a11y. */
  ariaLabel: string;
  /** Pause the loop without unmounting. Default false. */
  paused?: boolean;
  /** Optional className for sizing/styling the wrapper. */
  className?: string;
}

/**
 * Standalone hook so consumers that already own a canvas ref can drive
 * an animation loop without using the full <DemoCanvas> component.
 */
export function useDrawLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  drawFn: DrawFn,
  options: { paused?: boolean } = {},
): void {
  const drawRef = useRef(drawFn);
  drawRef.current = drawFn;

  const { paused = false } = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const callback: DrawCallback = (delta, total) => {
      drawRef.current(ctx, delta, total);
    };

    const loop = createDrawLoop(callback, {
      raf:
        typeof window !== "undefined" && window.requestAnimationFrame
          ? window.requestAnimationFrame.bind(window)
          : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number,
      caf:
        typeof window !== "undefined" && window.cancelAnimationFrame
          ? window.cancelAnimationFrame.bind(window)
          : (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
      now: () =>
        typeof performance !== "undefined" ? performance.now() : Date.now(),
    });

    loop.start();
    return () => loop.stop();
  }, [canvasRef, paused]);
}

export const DemoCanvas = forwardRef<HTMLCanvasElement, DemoCanvasProps>(
  function DemoCanvas(
    { width, height, draw, ariaLabel, paused = false, className },
    ref,
  ) {
    const innerRef = useRef<HTMLCanvasElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLCanvasElement);

    const drawCb = useCallback(draw, [draw]);
    useDrawLoop(innerRef, drawCb, { paused });

    return (
      <canvas
        ref={innerRef}
        width={width}
        height={height}
        className={className ?? "demo-canvas"}
        role="img"
        aria-label={ariaLabel}
        style={{
          display: "block",
          aspectRatio: `${width} / ${height}`,
          maxWidth: "100%",
          height: "auto",
        }}
      />
    );
  },
);
