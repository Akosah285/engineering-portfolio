import { describe, expect, it, vi } from "vitest";
import { createDrawLoop } from "../drawLoop";

/**
 * A mocked RAF that lets the test drive the loop one frame at a time.
 * Each scheduled callback is stored in a queue; `tick()` runs the head.
 */
function makeMockRaf() {
  const queue: Array<() => void> = [];
  let nextHandle = 1;
  const raf = vi.fn((cb: FrameRequestCallback) => {
    queue.push(() => cb(performance.now()));
    return nextHandle++;
  });
  const caf = vi.fn((_handle: number) => {
    // For our purposes, dropping the queue is fine; we never cancel mid-test
    queue.length = 0;
  });
  const tick = (): boolean => {
    const head = queue.shift();
    if (!head) return false;
    head();
    return true;
  };
  return { raf, caf, tick, queue };
}

describe("createDrawLoop", () => {
  it("starts not running", () => {
    const { raf, caf } = makeMockRaf();
    const loop = createDrawLoop(() => undefined, { raf, caf });
    expect(loop.isRunning()).toBe(false);
  });

  it("transitions to running after start() and back after stop()", () => {
    const { raf, caf } = makeMockRaf();
    const loop = createDrawLoop(() => undefined, { raf, caf });
    loop.start();
    expect(loop.isRunning()).toBe(true);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it("schedules a frame on start() via raf", () => {
    const { raf, caf } = makeMockRaf();
    const loop = createDrawLoop(() => undefined, { raf, caf });
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("calls the draw callback each tick and reschedules itself", () => {
    const { raf, caf, tick } = makeMockRaf();
    const draw = vi.fn();
    const loop = createDrawLoop(draw, { raf, caf });
    loop.start();
    tick();
    tick();
    tick();
    expect(draw).toHaveBeenCalledTimes(3);
    expect(raf).toHaveBeenCalledTimes(4); // start + 3 reschedules
  });

  it("does not call the draw callback after stop()", () => {
    const { raf, caf, tick } = makeMockRaf();
    const draw = vi.fn();
    const loop = createDrawLoop(draw, { raf, caf });
    loop.start();
    tick();
    loop.stop();
    tick(); // Should be a no-op queue drain
    expect(draw).toHaveBeenCalledTimes(1);
    expect(caf).toHaveBeenCalledTimes(1);
  });

  it("passes delta and total time to the callback using the injected clock", () => {
    const { raf, caf, tick } = makeMockRaf();
    let t = 1000;
    const now = () => t;
    const draw = vi.fn();
    const loop = createDrawLoop(draw, { raf, caf, now });
    loop.start(); // startedAt = lastFrameAt = 1000
    t = 1016; // ~60Hz
    tick();
    t = 1033;
    tick();
    expect(draw).toHaveBeenNthCalledWith(1, 16, 16);
    expect(draw).toHaveBeenNthCalledWith(2, 17, 33);
  });

  it("ignores a double start()", () => {
    const { raf, caf } = makeMockRaf();
    const loop = createDrawLoop(() => undefined, { raf, caf });
    loop.start();
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("ignores stop() before start()", () => {
    const { raf, caf } = makeMockRaf();
    const loop = createDrawLoop(() => undefined, { raf, caf });
    loop.stop();
    expect(caf).not.toHaveBeenCalled();
    expect(loop.isRunning()).toBe(false);
  });

  it("resumes from a fresh clock after restart", () => {
    const { raf, caf, tick } = makeMockRaf();
    let t = 100;
    const now = () => t;
    const draw = vi.fn();
    const loop = createDrawLoop(draw, { raf, caf, now });
    loop.start();
    t = 116;
    tick();
    loop.stop();
    t = 5000;
    loop.start(); // restart, startedAt = 5000
    t = 5016;
    tick();
    expect(draw).toHaveBeenLastCalledWith(16, 16);
  });
});
