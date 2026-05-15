import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsCoarsePointer } from "../useIsCoarsePointer";

interface MockMQL {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
}

function makeMQL(matches: boolean): MockMQL {
  return {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe("useIsCoarsePointer", () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("returns false initially (SSR-safe default)", () => {
    const mql = makeMQL(true);
    let observedDuringFirstRender: boolean | undefined;

    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    renderHook(() => {
      const value = useIsCoarsePointer();
      if (observedDuringFirstRender === undefined) {
        observedDuringFirstRender = value;
      }
      return value;
    });

    expect(observedDuringFirstRender).toBe(false);
  });

  it("returns true after hydration when (pointer: coarse) matches", () => {
    const mql = makeMQL(true);
    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useIsCoarsePointer());

    expect(result.current).toBe(true);
  });

  it("returns false after hydration when (pointer: coarse) does not match", () => {
    const mql = makeMQL(false);
    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useIsCoarsePointer());

    expect(result.current).toBe(false);
  });

  it("updates when the media query result changes", () => {
    let storedHandler:
      | ((event: MediaQueryListEvent) => void)
      | undefined;

    const mql = makeMQL(false);
    mql.addEventListener.mockImplementation((event, handler) => {
      if (event === "change") storedHandler = handler;
    });
    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useIsCoarsePointer());

    expect(result.current).toBe(false);

    act(() => {
      storedHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it("unsubscribes the listener on unmount", () => {
    const mql = makeMQL(true);
    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    const { unmount } = renderHook(() => useIsCoarsePointer());

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("queries '(pointer: coarse)' specifically", () => {
    const mql = makeMQL(false);
    const matchMediaSpy = vi.fn(() => mql);
    window.matchMedia = matchMediaSpy as unknown as typeof window.matchMedia;

    renderHook(() => useIsCoarsePointer());

    expect(matchMediaSpy).toHaveBeenCalledWith("(pointer: coarse)");
  });
});
