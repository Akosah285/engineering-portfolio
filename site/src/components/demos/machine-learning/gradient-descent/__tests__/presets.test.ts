import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, PRESETS } from "../presets";
import { SURFACE_SLUGS } from "../surfaces";

describe("PRESETS", () => {
  it("ships at least 4 named presets (plan: 4-6)", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(PRESETS.length).toBeLessThanOrEqual(6);
  });

  it("each preset has a non-empty name", () => {
    for (const p of PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("preset names are unique", () => {
    const names = PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every preset references a real surface slug", () => {
    for (const p of PRESETS) {
      expect(SURFACE_SLUGS).toContain(p.state.surface);
    }
  });

  it("learning rate is positive and finite for every preset", () => {
    for (const p of PRESETS) {
      expect(p.state.lr).toBeGreaterThan(0);
      expect(Number.isFinite(p.state.lr)).toBe(true);
    }
  });

  it("momentum is in [0, 1) for every preset", () => {
    for (const p of PRESETS) {
      expect(p.state.momentum).toBeGreaterThanOrEqual(0);
      expect(p.state.momentum).toBeLessThan(1);
    }
  });
});

describe("DEFAULT_STATE", () => {
  it("uses a valid surface slug", () => {
    expect(SURFACE_SLUGS).toContain(DEFAULT_STATE.surface);
  });

  it("has positive learning rate and momentum in [0, 1)", () => {
    expect(DEFAULT_STATE.lr).toBeGreaterThan(0);
    expect(DEFAULT_STATE.momentum).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_STATE.momentum).toBeLessThan(1);
  });
});
