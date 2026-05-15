/**
 * Course resolver — single source of truth for slug ↔ display-name mapping.
 *
 * Wraps `_courses.json` content with a small, well-typed interface used by
 * the sitemap, OG cards, search index, breadcrumbs, and route loaders.
 *
 * Construction-time validation: duplicate slugs and duplicate displayOrder
 * values throw, since both would corrupt downstream contracts (URLs vs
 * landing-grid slot order).
 */

export interface Course {
  slug: string;
  displayName: string;
  /** Term code, e.g., "SP20", "FA20", "WI21". */
  term: string;
  /** Position on the landing grid (1..N). Must be unique across courses. */
  displayOrder: number;
  /**
   * Publish date as ISO yyyy-mm-dd or null. When null, the course is a
   * "Coming Soon" placeholder and isPublished is false.
   */
  publishedAt: string | null;
  /**
   * One-sentence preview shown on hover/long-press of a Coming-Soon card.
   * Optional; when missing, the card hover falls back to a generic phrase.
   */
  comingSoonPreview?: string;
}

export class CourseNotFoundError extends Error {
  constructor(slug: string) {
    super(`No course with slug ${JSON.stringify(slug)}`);
    this.name = "CourseNotFoundError";
  }
}

export interface CourseResolver {
  toCourse(slug: string): Course;
  toDisplayName(slug: string): string;
  inOrder(): Course[];
  slugs(): string[];
  isPublished(slug: string): boolean;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** True iff `s` is a valid kebab-case slug (URL-safe, no double hyphens). */
export function isValidSlug(s: string): boolean {
  return s.length > 0 && SLUG_RE.test(s);
}

/**
 * Build a CourseResolver from a list of courses.
 *
 * @throws Error if `courses` is empty, contains duplicate slugs, or contains
 *   duplicate `displayOrder` values.
 */
export function buildCourseResolver(courses: readonly Course[]): CourseResolver {
  if (courses.length === 0) {
    throw new Error("CourseResolver requires at least one course");
  }

  const bySlug = new Map<string, Course>();
  const orderSeen = new Map<number, string>();

  for (const c of courses) {
    if (bySlug.has(c.slug)) {
      throw new Error(`duplicate slug: ${JSON.stringify(c.slug)}`);
    }
    const prevSlug = orderSeen.get(c.displayOrder);
    if (prevSlug !== undefined) {
      throw new Error(
        `duplicate displayOrder ${c.displayOrder}: ${JSON.stringify(
          prevSlug,
        )} and ${JSON.stringify(c.slug)}`,
      );
    }
    bySlug.set(c.slug, c);
    orderSeen.set(c.displayOrder, c.slug);
  }

  return {
    toCourse(slug) {
      const c = bySlug.get(slug);
      if (!c) throw new CourseNotFoundError(slug);
      return c;
    },
    toDisplayName(slug) {
      return this.toCourse(slug).displayName;
    },
    inOrder() {
      return [...bySlug.values()].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );
    },
    slugs() {
      return [...bySlug.keys()];
    },
    isPublished(slug) {
      return this.toCourse(slug).publishedAt !== null;
    },
  };
}
