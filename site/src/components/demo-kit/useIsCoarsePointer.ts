/**
 * useIsCoarsePointer — detects touch-style input devices.
 *
 * Matches the `@media (pointer: coarse)` CSS media query, which is the
 * web platform's recommended way to detect touch-primary devices
 * (plan §6.2). Distinct from UA sniffing or viewport-width hacks.
 *
 * SSR-safe: returns `false` during server-side rendering, then updates
 * after hydration when `matchMedia` is available.
 *
 * Used by canvas-drag demos to switch to the <PresetCarousel> fallback
 * on touch devices where pixel-precise dragging is awkward.
 */
import { useEffect, useState } from "react";

const COARSE_QUERY = "(pointer: coarse)";

/**
 * @returns `true` when the primary pointing device is coarse (finger-on-screen),
 *          `false` otherwise (mouse, trackpad, stylus).
 */
export function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(COARSE_QUERY);
    setIsCoarse(mql.matches);

    const handler = (event: MediaQueryListEvent): void => {
      setIsCoarse(event.matches);
    };

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // Safari < 14 fallback (rare in our browserslist, but safe to include).
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return isCoarse;
}
