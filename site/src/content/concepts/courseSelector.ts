/**
 * courseSelector — pure helper that joins the catalog (`_courses.json`)
 * with the loaded MDX entries and produces a list of "indexable" courses
 * ready to feed into the concept tag index.
 *
 * Why this exists separately from `buildTagIndex`:
 *
 *   The Astro `/concepts/[tag]/` route needs to combine two sources before
 *   tagIndex can do its work — it has to (a) sort entries by the catalog's
 *   curated displayOrder, (b) classify each catalog/MDX pair as Published,
 *   Coming-Soon, or Inconsistent, and (c) drop the Inconsistent rows so a
 *   half-edited course never silently leaks into the concept pages.
 *
 *   That join logic used to live in the `.astro` file. Astro pages aren't
 *   directly unit-testable, so the classification rule was only checked
 *   indirectly via "the build doesn't crash". A bug like "Coming-Soon
 *   courses dropped because the truthiness flip is reversed" wouldn't fail
 *   the build at all — it would silently un-list those courses from the
 *   concept pages. Extracting here lets vitest assert the exact behaviour.
 *
 * Contract:
 *   - Pair states recognised: PUBLISHED (catalog.publishedAt non-null AND
 *     mdx.draft === false) and COMING_SOON (catalog.publishedAt === null
 *     AND mdx.draft === true). Anything else is INCONSISTENT and dropped.
 *   - Output is sorted by catalog.displayOrder ascending.
 *   - Output preserves a `comingSoon: boolean` flag so callers can render
 *     "Coming soon" badges without re-doing the classification.
 *   - Pure: no Astro, no fs, no Date.now() — deterministic for a given input.
 */

export interface CatalogEntry {
  slug: string;
  displayName: string;
  term: string;
  displayOrder: number;
  publishedAt: string | null;
  comingSoonPreview?: string;
}

export interface MdxEntryLike {
  slug: string;
  data: {
    draft: boolean;
    concepts: readonly string[];
    interviewPending: boolean;
  };
}

export interface IndexableCourse {
  slug: string;
  concepts: readonly string[];
  comingSoon: boolean;
  /**
   * True when the course MDX is non-draft but the author interview is
   * still pending (the body is shipped as a "published preview" with a
   * visible banner instead of a finalized authorial reflection).
   *
   * Orthogonal to `comingSoon`: a course is `comingSoon: true` OR
   * `interviewPending: true` OR neither, never both.
   */
  interviewPending: boolean;
}

export type PairState = "published" | "coming-soon" | "inconsistent";

/**
 * Classify a single catalog/MDX pair. Exposed so callers (e.g. dev tooling,
 * lint scripts) can introspect a single course without running the whole
 * selector pipeline.
 */
export function classifyCatalogMdxPair(
  catalog: CatalogEntry | undefined,
  mdx: MdxEntryLike,
): PairState {
  if (catalog === undefined) return "inconsistent";
  const catalogPublished = catalog.publishedAt !== null;
  const mdxPublished = mdx.data.draft !== true;
  if (catalogPublished && mdxPublished) return "published";
  if (!catalogPublished && !mdxPublished) return "coming-soon";
  return "inconsistent";
}

/**
 * Select the courses that should appear in the concept index, in
 * displayOrder. Inconsistent pairs are dropped.
 */
export function selectIndexableCourses(
  catalog: readonly CatalogEntry[],
  mdxEntries: readonly MdxEntryLike[],
): IndexableCourse[] {
  const catalogBySlug = new Map(catalog.map((c) => [c.slug, c]));
  const sortedEntries = [...mdxEntries].sort((a, b) => {
    const aOrder = catalogBySlug.get(a.slug)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = catalogBySlug.get(b.slug)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

  const out: IndexableCourse[] = [];
  for (const mdx of sortedEntries) {
    const catalogEntry = catalogBySlug.get(mdx.slug);
    const state = classifyCatalogMdxPair(catalogEntry, mdx);
    if (state === "inconsistent") continue;
    const comingSoon = state === "coming-soon";
    // interviewPending only makes sense on the published branch; for
    // Coming-Soon courses the flag is forced to false to keep the
    // (comingSoon, interviewPending) state space disjoint.
    const interviewPending = !comingSoon && mdx.data.interviewPending === true;
    out.push({
      slug: mdx.slug,
      concepts: mdx.data.concepts,
      comingSoon,
      interviewPending,
    });
  }
  return out;
}
