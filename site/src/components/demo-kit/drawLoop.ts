/**
 * Draw-loop scheduler factory for <DemoCanvas>'s useDrawLoop hook (#15).
 *
 * Extracted so we can drive the loop with a mocked `requestAnimationFrame`
 * in tests without depending on JSDOM's RAF emulation. The factory takes
 * the raf/caf primitives as parameters; in production the hook injects
 * the browser's globals, in tests the spec injects spies.
 */

export interface DrawLoopController {
  /** Begin (or resume) the loop. No-op if already running. */
  start(): void;
  /** Pause the loop. The next start() resumes from the new "now". */
  stop(): void;
  /** True between start() and stop(). */
  isRunning(): boolean;
}

export interface DrawLoopOptions {
  raf: (cb: FrameRequestCallback) => number;
  caf: (handle: number) => void;
  /** Optional "now" provider so tests can drive deltaT deterministically. */
  now?: () => number;
}

export type DrawCallback = (deltaMs: number, totalMs: number) => void;

/**
 * Build a draw-loop controller that drives `callback` once per animation
 * frame. The callback receives the delta since the previous frame (in ms)
 * and the total elapsed time since `start()` (in ms). After `stop()` the
 * elapsed clock resets on the next `start()`.
 */
export function createDrawLoop(
  callback: DrawCallback,
  { raf, caf, now }: DrawLoopOptions,
): DrawLoopController {
  const clock = now ?? (() => Date.now());
  let running = false;
  let handle: number | null = null;
  let startedAt = 0;
  let lastFrameAt = 0;

  const tick = (): void => {
    if (!running) return;
    const t = clock();
    const delta = t - lastFrameAt;
    const total = t - startedAt;
    lastFrameAt = t;
    callback(delta, total);
    if (running) handle = raf(tick);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      startedAt = clock();
      lastFrameAt = startedAt;
      handle = raf(tick);
    },
    stop(): void {
      if (!running) return;
      running = false;
      if (handle !== null) {
        caf(handle);
        handle = null;
      }
    },
    isRunning(): boolean {
      return running;
    },
  };
}
