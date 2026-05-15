import { describe, expect, it } from "vitest";
import { buildTagIndex, lookupTag } from "../tagIndex";

const VOCAB = ["alpha", "beta", "gamma"] as const;

describe("buildTagIndex", () => {
  it("returns one entry per vocabulary tag, all empty when no courses", () => {
    const result = buildTagIndex([], VOCAB);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.tag)).toEqual(["alpha", "beta", "gamma"]);
    expect(result.every((e) => e.courses.length === 0)).toBe(true);
  });

  it("preserves vocabulary order in the returned entries", () => {
    const courses = [{ slug: "c1", concepts: ["gamma", "alpha"] }];
    const result = buildTagIndex(courses, VOCAB);
    expect(result.map((e) => e.tag)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("collects each course slug under each of its concept tags", () => {
    const courses = [
      { slug: "c1", concepts: ["alpha", "beta"] },
      { slug: "c2", concepts: ["alpha"] },
    ];
    const result = buildTagIndex(courses, VOCAB);
    expect(result.find((e) => e.tag === "alpha")?.courses).toEqual(["c1", "c2"]);
    expect(result.find((e) => e.tag === "beta")?.courses).toEqual(["c1"]);
    expect(result.find((e) => e.tag === "gamma")?.courses).toEqual([]);
  });

  it("preserves the input course order within an entry's courses array", () => {
    const courses = [
      { slug: "c2", concepts: ["alpha"] },
      { slug: "c1", concepts: ["alpha"] },
      { slug: "c3", concepts: ["alpha"] },
    ];
    const result = buildTagIndex(courses, VOCAB);
    expect(result.find((e) => e.tag === "alpha")?.courses).toEqual(["c2", "c1", "c3"]);
  });

  it("silently ignores unknown tags on a course (validator's job)", () => {
    const courses = [{ slug: "c1", concepts: ["alpha", "unknown-tag"] }];
    const result = buildTagIndex(courses, VOCAB);
    expect(result.find((e) => e.tag === "alpha")?.courses).toEqual(["c1"]);
    expect(result.find((e) => e.tag === "unknown-tag")).toBeUndefined();
  });

  it("dedupes a course slug if it appears twice with the same tag", () => {
    const courses = [{ slug: "c1", concepts: ["alpha", "alpha"] }];
    const result = buildTagIndex(courses, VOCAB);
    expect(result.find((e) => e.tag === "alpha")?.courses).toEqual(["c1"]);
  });

  it("works with the full real vocabulary shape (>20 tags)", () => {
    const big = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    const courses = [
      { slug: "c1", concepts: ["tag-0", "tag-15", "tag-29"] },
      { slug: "c2", concepts: ["tag-15"] },
    ];
    const result = buildTagIndex(courses, big);
    expect(result).toHaveLength(30);
    expect(result.find((e) => e.tag === "tag-15")?.courses).toEqual(["c1", "c2"]);
    expect(result.find((e) => e.tag === "tag-1")?.courses).toEqual([]);
  });
});

describe("lookupTag", () => {
  it("returns the matching entry for a known tag", () => {
    const index = buildTagIndex([{ slug: "c1", concepts: ["beta"] }], VOCAB);
    expect(lookupTag(index, "beta")).toEqual({
      tag: "beta",
      courses: ["c1"],
    });
  });

  it("returns null for a tag that's not in the index", () => {
    const index = buildTagIndex([], VOCAB);
    expect(lookupTag(index, "not-a-real-tag")).toBeNull();
  });

  it("returns the empty-courses entry for a known but unused tag", () => {
    const index = buildTagIndex([], VOCAB);
    expect(lookupTag(index, "alpha")).toEqual({ tag: "alpha", courses: [] });
  });
});
