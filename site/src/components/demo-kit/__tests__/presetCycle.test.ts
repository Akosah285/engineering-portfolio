import { describe, expect, it } from "vitest";
import { cyclePresetIndex } from "../presetCycle";

describe("cyclePresetIndex", () => {
  describe("next direction", () => {
    it("advances by one", () => {
      expect(cyclePresetIndex(0, 5, "next")).toBe(1);
      expect(cyclePresetIndex(2, 5, "next")).toBe(3);
    });

    it("wraps from last to first", () => {
      expect(cyclePresetIndex(4, 5, "next")).toBe(0);
    });

    it("handles single-element lists (next loops to self)", () => {
      expect(cyclePresetIndex(0, 1, "next")).toBe(0);
    });
  });

  describe("prev direction", () => {
    it("retreats by one", () => {
      expect(cyclePresetIndex(2, 5, "prev")).toBe(1);
      expect(cyclePresetIndex(4, 5, "prev")).toBe(3);
    });

    it("wraps from first to last", () => {
      expect(cyclePresetIndex(0, 5, "prev")).toBe(4);
    });

    it("handles single-element lists (prev loops to self)", () => {
      expect(cyclePresetIndex(0, 1, "prev")).toBe(0);
    });
  });

  describe("defensive behavior", () => {
    it("returns 0 when total is zero", () => {
      expect(cyclePresetIndex(0, 0, "next")).toBe(0);
      expect(cyclePresetIndex(3, 0, "prev")).toBe(0);
    });

    it("returns 0 when total is negative", () => {
      expect(cyclePresetIndex(0, -1, "next")).toBe(0);
    });

    it("returns 0 when current is out of range", () => {
      expect(cyclePresetIndex(10, 5, "next")).toBe(0);
      expect(cyclePresetIndex(-1, 5, "prev")).toBe(0);
    });

    it("returns 0 when current is not an integer", () => {
      expect(cyclePresetIndex(1.5, 5, "next")).toBe(0);
      expect(cyclePresetIndex(Number.NaN, 5, "next")).toBe(0);
    });
  });
});
