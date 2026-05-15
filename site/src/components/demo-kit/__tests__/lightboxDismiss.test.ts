import { describe, expect, it } from "vitest";
import { shouldDismissOnSwipeDown } from "../lightboxDismiss";

describe("shouldDismissOnSwipeDown", () => {
  describe("dismisses on deliberate downward flicks", () => {
    it("dismisses on a fast 200px downward swipe in 300ms", () => {
      const start = { y: 100, t: 0 };
      const end = { y: 300, t: 300 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(true);
    });

    it("dismisses exactly at the minimum distance + maximum duration boundary", () => {
      const start = { y: 0, t: 0 };
      const end = { y: 80, t: 400 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(true);
    });

    it("dismisses on a snappy 100px in 100ms swipe", () => {
      const start = { y: 50, t: 0 };
      const end = { y: 150, t: 100 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(true);
    });
  });

  describe("does not dismiss on accidental or non-downward gestures", () => {
    it("does not dismiss on upward swipes", () => {
      const start = { y: 300, t: 0 };
      const end = { y: 100, t: 200 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });

    it("does not dismiss on tiny downward taps", () => {
      const start = { y: 100, t: 0 };
      const end = { y: 110, t: 50 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });

    it("does not dismiss on slow downward drags (likely scroll)", () => {
      const start = { y: 100, t: 0 };
      const end = { y: 200, t: 2000 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });

    it("does not dismiss on zero-distance gestures", () => {
      const start = { y: 100, t: 0 };
      const end = { y: 100, t: 200 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });

    it("does not dismiss on zero-duration gestures (defensive)", () => {
      const start = { y: 100, t: 100 };
      const end = { y: 300, t: 100 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });

    it("does not dismiss when duration is negative (clock skew)", () => {
      const start = { y: 100, t: 500 };
      const end = { y: 300, t: 100 };

      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
    });
  });

  describe("respects custom options", () => {
    it("honors a custom minDistance threshold (stricter)", () => {
      const start = { y: 0, t: 0 };
      const end = { y: 100, t: 200 };

      expect(shouldDismissOnSwipeDown(start, end, { minDistance: 150 })).toBe(
        false,
      );
      expect(shouldDismissOnSwipeDown(start, end, { minDistance: 50 })).toBe(
        true,
      );
    });

    it("honors a custom maxDuration threshold", () => {
      const start = { y: 0, t: 0 };
      const end = { y: 200, t: 800 };

      // Default maxDuration is 600 — this is too slow.
      expect(shouldDismissOnSwipeDown(start, end)).toBe(false);
      // But with a relaxed 1000ms max, it passes.
      expect(shouldDismissOnSwipeDown(start, end, { maxDuration: 1000 })).toBe(
        true,
      );
    });

    it("honors a custom minVelocity threshold", () => {
      const start = { y: 0, t: 0 };
      const end = { y: 100, t: 500 };
      // velocity = 0.2 px/ms — at the default threshold.

      expect(shouldDismissOnSwipeDown(start, end)).toBe(true);
      // Bump the threshold above the gesture's velocity.
      expect(shouldDismissOnSwipeDown(start, end, { minVelocity: 0.5 })).toBe(
        false,
      );
    });
  });
});
