/**
 * Tests for the useDemoState React hook.
 *
 * The hook composes the already-tested serialize/deserialize pure
 * functions, so these tests focus on the hook-specific behaviour:
 *   - Mount-time fragment parsing
 *   - Debounced fragment writes
 *   - share() and reset() controls
 *   - shareable: false opt-out
 *   - Stable setState identity
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Schema, type StateOf, useDemoState } from "../useDemoState";

const sliderSchema = {
  sigma: { type: "number" as const, default: 10 },
  beta: { type: "number" as const, default: 2.667 },
  label: { type: "string" as const, default: "trace" },
  mode: { type: "enum" as const, default: "fast", values: ["fast", "slow"] as const },
} satisfies Schema;

type SliderState = StateOf<typeof sliderSchema>;

function setHash(hash: string): void {
  // jsdom doesn't let us set location.href directly, but `location.hash` works.
  window.location.hash = hash;
}

function clearHash(): void {
  // Reset via history.replaceState so listeners don't fire spuriously.
  window.history.replaceState(null, "", window.location.pathname);
}

describe("useDemoState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearHash();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearHash();
  });

  describe("initial state", () => {
    it("returns initialState when no fragment is present", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };

      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      expect(result.current[0]).toEqual(initial);
    });

    it("parses an existing fragment on mount and overrides defaults", () => {
      setHash("#demo=lorenz&sigma=20&beta=4&label=run-1&mode=slow");

      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      expect(result.current[0]).toEqual({
        sigma: 20,
        beta: 4,
        label: "run-1",
        mode: "slow",
      });
    });

    it("falls back to defaults for malformed numeric values in the fragment", () => {
      setHash("#demo=lorenz&sigma=not-a-number");

      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      expect(result.current[0].sigma).toBe(10);
    });

    it("falls back to defaults for out-of-range enum values", () => {
      setHash("#demo=lorenz&mode=ludicrous");

      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      expect(result.current[0].mode).toBe("fast");
    });

    it("ignores unknown keys in the fragment", () => {
      setHash("#demo=lorenz&sigma=20&unknown=42&extra=foo");

      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      expect(result.current[0].sigma).toBe(20);
      // No "unknown" or "extra" key should appear on the state object.
      expect(Object.keys(result.current[0]).sort()).toEqual([
        "beta",
        "label",
        "mode",
        "sigma",
      ]);
    });
  });

  describe("setState writes debounced fragments", () => {
    it("writes the fragment after the default 100ms debounce window", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      // Flush the mount-time effect (writes the initial fragment).
      act(() => {
        vi.advanceTimersByTime(150);
      });
      const initialHash = window.location.hash;
      expect(initialHash).toMatch(/sigma=10/);

      act(() => {
        result.current[1]({ ...result.current[0], sigma: 25 });
      });

      // Pre-debounce: hash unchanged.
      expect(window.location.hash).toBe(initialHash);

      // Advance past the debounce window.
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(window.location.hash).toMatch(/sigma=25/);
    });

    it("collapses many rapid setState calls into a single fragment write", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      act(() => {
        for (let v = 11; v <= 20; v++) {
          result.current[1]({ ...result.current[0], sigma: v });
        }
      });

      // Advance only halfway through the debounce - nothing written yet.
      act(() => {
        vi.advanceTimersByTime(50);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // After settling, the hash should reflect ONLY the last value.
      expect(window.location.hash).toMatch(/sigma=20/);
      expect(window.location.hash).not.toMatch(/sigma=15/);
    });

    it("respects a custom debounceMs", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() =>
        useDemoState("lorenz", sliderSchema, initial, { debounceMs: 500 }),
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current[1]({ ...result.current[0], sigma: 99 });
      });

      // 100ms (default) should NOT be enough for the custom debounce.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(window.location.hash).not.toMatch(/sigma=99/);

      // After the full 500ms, it lands.
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(window.location.hash).toMatch(/sigma=99/);
    });

    it("accepts an updater function in setState (useState parity)", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      act(() => {
        result.current[1]((prev) => ({ ...prev, sigma: prev.sigma + 5 }));
      });

      expect(result.current[0].sigma).toBe(15);
    });
  });

  describe("share()", () => {
    it("returns the full URL with the current fragment", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      act(() => {
        result.current[1]({ ...result.current[0], sigma: 42 });
      });

      const url = result.current[2].share();

      expect(url).toContain(window.location.origin);
      expect(url).toContain(window.location.pathname);
      expect(url).toContain("demo=lorenz");
      expect(url).toContain("sigma=42");
    });
  });

  describe("reset()", () => {
    it("returns state to defaults", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      act(() => {
        result.current[1]({ ...result.current[0], sigma: 999 });
      });
      expect(result.current[0].sigma).toBe(999);

      act(() => {
        result.current[2].reset();
      });

      expect(result.current[0]).toEqual(initial);
    });

    it("clears the URL fragment", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() => useDemoState("lorenz", sliderSchema, initial));

      // Get a fragment written.
      act(() => {
        result.current[1]({ ...result.current[0], sigma: 50 });
      });
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(window.location.hash).toMatch(/sigma=50/);

      act(() => {
        result.current[2].reset();
      });

      expect(window.location.hash).toBe("");
    });
  });

  describe("shareable: false opt-out", () => {
    it("does not write the fragment when shareable is false", () => {
      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() =>
        useDemoState("lorenz", sliderSchema, initial, { shareable: false }),
      );

      act(() => {
        result.current[1]({ ...result.current[0], sigma: 77 });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(window.location.hash).toBe("");
    });

    it("does not read the fragment on mount when shareable is false", () => {
      setHash("#demo=lorenz&sigma=999");

      const initial: SliderState = {
        sigma: 10,
        beta: 2.667,
        label: "trace",
        mode: "fast",
      };
      const { result } = renderHook(() =>
        useDemoState("lorenz", sliderSchema, initial, { shareable: false }),
      );

      // The fragment is on the URL but we ignored it.
      expect(result.current[0].sigma).toBe(10);
    });
  });
});
