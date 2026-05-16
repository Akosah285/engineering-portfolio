/**
 * Course preview dispatch — single source of truth for which slugs get a
 * `<CoursePreview/{slug}.astro>` mounted inside the Coming-Soon variant
 * of `/courses/{slug}/`.
 *
 * Invariants (enforced by `coursePreviewMap.test.ts`):
 *   1. `COURSE_PREVIEW_SLUGS` exactly matches the slugs in `_courses.json`
 *      with `publishedAt: null`.
 *   2. Every entry has a matching `src/components/CoursePreview/{slug}.astro`
 *      file on disk.
 *   3. Published course slugs (e.g. `machine-learning`) MUST NOT appear —
 *      published pages render through `CoursePage.astro` and don't use
 *      the preview at all.
 *
 * When a course is promoted from Coming-Soon to published:
 *   - Set `publishedAt: "<ISO date>"` in `_courses.json` for that slug.
 *   - Remove the slug from `COURSE_PREVIEW_SLUGS` below.
 *   - Remove the matching import + map entry from `pages/courses/[slug].astro`.
 *   - Optionally delete `src/components/CoursePreview/{slug}.astro` if the
 *     published MDX mounts the demos itself.
 *   - The test suite will fail loudly if any of the three steps are skipped.
 */

export const COURSE_PREVIEW_SLUGS = [
  "computational-methods",
  "digital-electronics",
  "discrete-probability",
  "distributed-systems",
  "embedded-systems",
  "fourier-transforms",
  "mechatronics",
  "solid-mechanics",
] as const;

export type CoursePreviewSlug = (typeof COURSE_PREVIEW_SLUGS)[number];

/** Type guard: narrows `string` to `CoursePreviewSlug`. */
export function isCoursePreviewSlug(slug: string): slug is CoursePreviewSlug {
  return (COURSE_PREVIEW_SLUGS as readonly string[]).includes(slug);
}

/**
 * Dispatch predicate: returns true only when the Coming-Soon variant of
 * the course page should render its `<CoursePreview>` block.
 *
 * Published courses (`isPublished=true`) never render the preview — the
 * published MDX is responsible for mounting whichever demos belong in
 * the body.
 */
export function shouldShowPreview(slug: string, isPublished: boolean): boolean {
  if (isPublished) return false;
  return isCoursePreviewSlug(slug);
}
