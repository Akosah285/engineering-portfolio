import { describe, expect, it } from "vitest";
import {
  type Course,
  CourseNotFoundError,
  buildCourseResolver,
  isValidSlug,
} from "../resolver";

const COURSES: Course[] = [
  {
    slug: "mechatronics",
    displayName: "Mechatronics",
    term: "SP21",
    displayOrder: 1,
    publishedAt: null,
  },
  {
    slug: "machine-learning",
    displayName: "Machine Learning & Statistical Data Analysis",
    term: "SP20",
    displayOrder: 4,
    publishedAt: null,
  },
  {
    slug: "embedded-systems",
    displayName: "Embedded Systems",
    term: "WI21",
    displayOrder: 2,
    publishedAt: null,
  },
];

describe("buildCourseResolver", () => {
  it("returns the display name for a known slug", () => {
    const r = buildCourseResolver(COURSES);
    expect(r.toDisplayName("mechatronics")).toBe("Mechatronics");
    expect(r.toDisplayName("machine-learning")).toBe(
      "Machine Learning & Statistical Data Analysis",
    );
  });

  it("throws CourseNotFoundError for unknown slug", () => {
    const r = buildCourseResolver(COURSES);
    expect(() => r.toDisplayName("nonexistent")).toThrow(CourseNotFoundError);
  });

  it("returns the full course object via toCourse", () => {
    const r = buildCourseResolver(COURSES);
    const c = r.toCourse("mechatronics");
    expect(c).toEqual({
      slug: "mechatronics",
      displayName: "Mechatronics",
      term: "SP21",
      displayOrder: 1,
      publishedAt: null,
    });
  });

  it("throws CourseNotFoundError on toCourse for unknown slug", () => {
    const r = buildCourseResolver(COURSES);
    expect(() => r.toCourse("not-real")).toThrow(CourseNotFoundError);
  });

  it("returns courses sorted by displayOrder via inOrder()", () => {
    const r = buildCourseResolver(COURSES);
    const ordered = r.inOrder();
    expect(ordered.map((c) => c.slug)).toEqual([
      "mechatronics",
      "embedded-systems",
      "machine-learning",
    ]);
  });

  it("inOrder is a stable copy, not the input array", () => {
    const r = buildCourseResolver(COURSES);
    const ordered = r.inOrder();
    expect(ordered).not.toBe(COURSES);
    ordered.push({} as Course);
    expect(r.inOrder()).toHaveLength(3);
  });

  it("returns all known slugs via slugs()", () => {
    const r = buildCourseResolver(COURSES);
    const slugs = r.slugs();
    expect(slugs.sort()).toEqual(
      ["embedded-systems", "machine-learning", "mechatronics"].sort(),
    );
  });

  it("isPublished is false when publishedAt is null", () => {
    const r = buildCourseResolver(COURSES);
    expect(r.isPublished("mechatronics")).toBe(false);
  });

  it("isPublished is true when publishedAt is set", () => {
    const r = buildCourseResolver([
      {
        slug: "x",
        displayName: "X",
        term: "SP20",
        displayOrder: 1,
        publishedAt: "2025-01-15",
      },
    ]);
    expect(r.isPublished("x")).toBe(true);
  });

  it("rejects duplicate slugs at construction time", () => {
    expect(() =>
      buildCourseResolver([
        ...COURSES,
        {
          slug: "mechatronics",
          displayName: "Duplicate",
          term: "SP21",
          displayOrder: 99,
          publishedAt: null,
        },
      ]),
    ).toThrow(/duplicate slug/i);
  });

  it("rejects duplicate displayOrder values at construction time", () => {
    expect(() =>
      buildCourseResolver([
        ...COURSES,
        {
          slug: "extra",
          displayName: "Extra",
          term: "FA21",
          displayOrder: 1,
          publishedAt: null,
        },
      ]),
    ).toThrow(/duplicate displayOrder/i);
  });

  it("rejects empty input", () => {
    expect(() => buildCourseResolver([])).toThrow(/at least one course/i);
  });
});

describe("isValidSlug (URL-shape predicate)", () => {
  it.each([
    "machine-learning",
    "fourier-transforms",
    "embedded-systems",
    "x",
    "ab-cd-ef",
  ])("accepts %s", (s) => {
    expect(isValidSlug(s)).toBe(true);
  });

  it.each([
    "Machine-Learning",
    "machine_learning",
    "machine learning",
    "machine--learning",
    "-leading",
    "trailing-",
    "",
    "with/slash",
    "with.dot",
  ])("rejects %s", (s) => {
    expect(isValidSlug(s)).toBe(false);
  });
});
