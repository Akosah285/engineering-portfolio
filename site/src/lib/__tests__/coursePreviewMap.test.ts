import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import coursesData from "../../content/_courses.json";
import {
  COURSE_PREVIEW_SLUGS,
  isCoursePreviewSlug,
  shouldShowPreview,
} from "../coursePreviewMap";

interface CourseJson {
  slug: string;
  publishedAt: string | null;
}

const courses = coursesData as CourseJson[];
const here = dirname(fileURLToPath(import.meta.url));
const previewDir = resolve(here, "..", "..", "components", "CoursePreview");

describe("shouldShowPreview", () => {
  it("returns false when the course is already published", () => {
    expect(shouldShowPreview("fourier-transforms", true)).toBe(false);
    expect(shouldShowPreview("machine-learning", true)).toBe(false);
  });

  it("returns true for a known preview slug on a Coming-Soon page", () => {
    expect(shouldShowPreview("fourier-transforms", false)).toBe(true);
    expect(shouldShowPreview("discrete-probability", false)).toBe(true);
  });

  it("returns false for an unknown slug, even on a Coming-Soon page", () => {
    expect(shouldShowPreview("does-not-exist", false)).toBe(false);
  });

  it("returns false for the published-by-default ML course slug", () => {
    expect(shouldShowPreview("machine-learning", false)).toBe(false);
  });
});

describe("isCoursePreviewSlug", () => {
  it("recognises every slug listed in COURSE_PREVIEW_SLUGS", () => {
    for (const slug of COURSE_PREVIEW_SLUGS) {
      expect(isCoursePreviewSlug(slug)).toBe(true);
    }
  });

  it("rejects unknown slugs", () => {
    expect(isCoursePreviewSlug("nope")).toBe(false);
    expect(isCoursePreviewSlug("")).toBe(false);
  });
});

describe("COURSE_PREVIEW_SLUGS invariants", () => {
  it("contains exactly the slugs that have publishedAt: null in _courses.json", () => {
    const expected = new Set(
      courses.filter((c) => c.publishedAt === null).map((c) => c.slug),
    );
    const actual = new Set(COURSE_PREVIEW_SLUGS as readonly string[]);
    expect(actual).toEqual(expected);
  });

  it("does NOT contain any slug that is already published", () => {
    const published = courses.filter((c) => c.publishedAt !== null).map((c) => c.slug);
    for (const slug of published) {
      expect(COURSE_PREVIEW_SLUGS as readonly string[]).not.toContain(slug);
    }
  });

  it("every slug has a matching CoursePreview/{slug}.astro file on disk", () => {
    for (const slug of COURSE_PREVIEW_SLUGS) {
      const path = resolve(previewDir, `${slug}.astro`);
      expect(existsSync(path), `missing ${path}`).toBe(true);
    }
  });
});
