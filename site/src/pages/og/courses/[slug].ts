/**
 * Templated course OG cards via astro-og-canvas (plan §7.13, closes #8).
 *
 * Generates a 1200×630 PNG for every published course at build time.
 * Output URL pattern: `/og/courses/{slug}.png` — referenced by
 * `<HeadMeta ogImage>` in `CoursePage.astro`.
 *
 * Visual layout:
 *   - Warm-paper background (#fcfaf6 light, matches site bg)
 *   - Pine accent bar inline-start
 *   - Large serif course title
 *   - Term + one-line takeaway
 *
 * Demo deep-links inherit the parent course's OG (no per-demo PNGs).
 *
 * Requires `getCollection("courses")` for the takeaway sentence — falls
 * back to a generic descriptor when the MDX is missing (Coming-Soon).
 */
import { OGImageRoute } from "astro-og-canvas";
import { getCollection, type CollectionEntry } from "astro:content";
import coursesData from "../../../content/_courses.json";
import type { Course } from "../../../content/resolver";

interface Page {
  title: string;
  description: string;
  term: string;
  slug: string;
}

const courses = coursesData as Course[];
const entries = (await getCollection("courses")) as CollectionEntry<"courses">[];
const entriesBySlug = new Map(entries.map((e) => [e.slug, e]));

const pages: Record<string, Page> = {};
for (const course of courses) {
  const entry = entriesBySlug.get(course.slug);
  pages[course.slug] = {
    slug: course.slug,
    title: course.displayName,
    term: course.term,
    description:
      entry?.data.oneLineTakeaway ??
      course.comingSoonPreview ??
      `${course.displayName} — Engineering Portfolio`,
  };
}

const { getStaticPaths, GET } = await OGImageRoute({
  param: "slug",
  pages,
  getImageOptions: (_path, page: Page) => ({
    title: page.title,
    description: `${page.term} · ${page.description}`,
    bgGradient: [
      [252, 250, 246],
      [243, 241, 236],
    ],
    border: { color: [0, 105, 62], width: 16, side: "inline-start" },
    padding: 60,
    font: {
      title: {
        color: [26, 26, 26],
        size: 64,
        weight: "Bold",
        lineHeight: 1.1,
        families: ["Source Serif 4", "Georgia", "serif"],
      },
      description: {
        color: [82, 82, 82],
        size: 28,
        weight: "Normal",
        lineHeight: 1.4,
        families: ["Inter", "Helvetica", "sans-serif"],
      },
    },
  }),
});

export { getStaticPaths, GET };
