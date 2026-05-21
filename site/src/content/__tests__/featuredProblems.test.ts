/**
 * #27 + #44-#51 — Featured-problem writeups across every published course.
 *
 * The <FeaturedProblem> component (src/components/FeaturedProblem.astro)
 * carries paraphrased problem statements + author-voice solutions with
 * KaTeX-typeset math, labeled "Featured Solution" or "Featured Reflection".
 *
 * Every published course must ship at least 2 fully-authored featured
 * problems (no `placeholder={true}`), each:
 *   - attributed to Dartmouth + the course term
 *   - typeset with at least one <MathExpression> (KaTeX, not images)
 *
 * The course MDX must not contain a stub message saying writeups are
 * "pending" the author interview — those signal the author hasn't
 * shipped real content yet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import coursesData from "../_courses.json";

interface Course {
  slug: string;
  term: string;
  publishedAt: string | null;
}

const COURSES_DIR = resolve(__dirname, "..", "courses");

const PUBLISHED_COURSES = (coursesData as Course[]).filter(
  (c) => c.publishedAt !== null,
);

function readMdx(slug: string): string {
  return readFileSync(resolve(COURSES_DIR, `${slug}.mdx`), "utf8");
}

/**
 * Extract the body of every <FeaturedProblem ...>...</FeaturedProblem>
 * block from raw MDX. Returns an array of { openTag, body } objects.
 */
function extractFeaturedProblems(
  mdx: string,
): Array<{ openTag: string; body: string }> {
  const results: Array<{ openTag: string; body: string }> = [];
  const openPattern = /<FeaturedProblem\b/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((match = openPattern.exec(mdx)) !== null) {
    const openStart = match.index;
    const openEnd = mdx.indexOf(">", openStart);
    if (openEnd === -1) continue;
    const openTag = mdx.slice(openStart, openEnd + 1);
    const closeStart = mdx.indexOf("</FeaturedProblem>", openEnd);
    if (closeStart === -1) continue;
    const body = mdx.slice(openEnd + 1, closeStart);
    results.push({ openTag, body });
  }
  return results;
}

describe.each(PUBLISHED_COURSES)(
  "featured problems — $slug",
  (course: Course) => {
    const mdx = readMdx(course.slug);
    const problems = extractFeaturedProblems(mdx);

    it("has at least 2 <FeaturedProblem> blocks", () => {
      expect(problems.length).toBeGreaterThanOrEqual(2);
    });

    it("ships every problem without placeholder={true}", () => {
      for (const { openTag } of problems) {
        expect(openTag).not.toContain("placeholder={true}");
      }
    });

    it("attributes every problem to Dartmouth + the course term", () => {
      for (const { openTag } of problems) {
        const attrMatch = openTag.match(/attribution="([^"]+)"/);
        expect(attrMatch, `attribution missing on: ${openTag}`).not.toBeNull();
        const attribution = attrMatch![1];
        expect(attribution).toMatch(/Dartmouth/i);
        expect(attribution).toContain(course.term);
      }
    });

    it("does not say writeups are pending the author interview", () => {
      expect(mdx).not.toMatch(/pending the (v\d+ )?author interview/i);
      expect(mdx).not.toMatch(/placeholder restatement pending/i);
      expect(mdx).not.toMatch(/will replace this paragraph after/i);
    });

    it("labels every problem as Featured Solution or Featured Reflection", () => {
      for (const { openTag } of problems) {
        const kindMatch = openTag.match(/kind="([^"]+)"/);
        expect(kindMatch, `kind missing on: ${openTag}`).not.toBeNull();
        const kind = kindMatch![1];
        expect(["Featured Solution", "Featured Reflection"]).toContain(kind);
      }
    });

    it("typesets every problem with at least one KaTeX <MathExpression>", () => {
      for (const { body } of problems) {
        expect(body).toContain("<MathExpression");
      }
    });

    it("imports FeaturedProblem + MathExpression in the MDX", () => {
      expect(mdx).toMatch(
        /import\s+FeaturedProblem\s+from\s+"\.\.\/\.\.\/components\/FeaturedProblem\.astro"/,
      );
      expect(mdx).toMatch(
        /import\s+MathExpression\s+from\s+"\.\.\/\.\.\/components\/demo-kit\/MathExpression\.astro"/,
      );
    });
  },
);
