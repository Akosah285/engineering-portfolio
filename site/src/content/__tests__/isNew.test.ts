import { describe, expect, it } from "vitest";
import { isNew } from "../isNew";

const NOW = new Date("2025-12-15T12:00:00Z");

describe("isNew", () => {
  it("returns false when publishedAt is null", () => {
    expect(isNew(null, NOW)).toBe(false);
  });

  it("returns true when published today", () => {
    expect(isNew("2025-12-15", NOW)).toBe(true);
  });

  it("returns true when published 1 day ago", () => {
    expect(isNew("2025-12-14", NOW)).toBe(true);
  });

  it("returns true when published 29 days ago", () => {
    expect(isNew("2025-11-16", NOW)).toBe(true);
  });

  it("returns true when published exactly 30 days ago (boundary, inclusive)", () => {
    expect(isNew("2025-11-15", NOW)).toBe(true);
  });

  it("returns false when published 31 days ago", () => {
    expect(isNew("2025-11-14", NOW)).toBe(false);
  });

  it("returns false when published 60 days ago", () => {
    expect(isNew("2025-10-16", NOW)).toBe(false);
  });

  it("returns false when published in the future", () => {
    expect(isNew("2026-01-01", NOW)).toBe(false);
  });

  it("returns false for unparseable date strings", () => {
    expect(isNew("not-a-date", NOW)).toBe(false);
    expect(isNew("", NOW)).toBe(false);
  });

  it("uses 'now' parameter for deterministic build-time computation", () => {
    const olderNow = new Date("2025-12-01T00:00:00Z");
    // 2025-11-25 is 6 days before olderNow but 20 days before NOW
    expect(isNew("2025-11-25", olderNow)).toBe(true);
    expect(isNew("2025-11-25", NOW)).toBe(true);
    // 2025-10-15 is 47 days before olderNow but 61 days before NOW
    expect(isNew("2025-10-15", olderNow)).toBe(false);
    expect(isNew("2025-10-15", NOW)).toBe(false);
  });

  it("respects custom window via opts.windowDays", () => {
    expect(isNew("2025-10-16", NOW, { windowDays: 60 })).toBe(true);
    expect(isNew("2025-10-16", NOW, { windowDays: 30 })).toBe(false);
  });

  it("treats a windowDays of 0 as 'never new' except today", () => {
    expect(isNew("2025-12-15", NOW, { windowDays: 0 })).toBe(true);
    expect(isNew("2025-12-14", NOW, { windowDays: 0 })).toBe(false);
  });
});
