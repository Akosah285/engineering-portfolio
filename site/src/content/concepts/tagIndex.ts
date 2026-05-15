/**
 * tagIndex — pure helper that maps each known concept tag to the list of
 * course slugs that touch it. Used by the dynamic /concepts/{tag}/ route
 * to render auto-generated tag pages (plan §7.15).
 *
 * Kept pure + framework-free so it can be unit tested in isolation. The
 * Astro route just calls `buildTagIndex(courses, vocabulary)` to get the
 * full mapping at build time.
 */

export interface TagIndexEntry {
  tag: string;
  courses: readonly string[];
}

export interface CourseLike {
  slug: string;
  concepts: readonly string[];
}

/**
 * Build a tag → course-slug index from a course list and vocabulary.
 *
 * - Every tag in `vocabulary` appears in the result, even if no course uses it
 *   (the tag page renders "no courses yet" rather than 404'ing).
 * - Course slugs within an entry preserve the order they appear in `courses`
 *   (callers should pre-sort by displayOrder if they want curated ordering).
 * - Unknown concept tags on a course (i.e. not in vocabulary) are silently
 *   ignored — Zod schema validation upstream is responsible for rejecting them.
 *
 * @param courses Iterable of courses with their `concepts` arrays
 * @param vocabulary Master list of valid tags from `_tags.json`
 */
export function buildTagIndex(
  courses: readonly CourseLike[],
  vocabulary: readonly string[],
): TagIndexEntry[] {
  const known = new Set(vocabulary);
  const map = new Map<string, string[]>();
  for (const tag of vocabulary) map.set(tag, []);

  for (const course of courses) {
    for (const tag of course.concepts) {
      if (!known.has(tag)) continue;
      const list = map.get(tag);
      if (list && !list.includes(course.slug)) {
        list.push(course.slug);
      }
    }
  }

  return vocabulary.map((tag) => ({
    tag,
    courses: map.get(tag) ?? [],
  }));
}

/**
 * Look up a single tag entry from a pre-built index. Returns null for an
 * unknown tag (callers should treat this as a 404).
 */
export function lookupTag(
  index: readonly TagIndexEntry[],
  tag: string,
): TagIndexEntry | null {
  return index.find((entry) => entry.tag === tag) ?? null;
}
