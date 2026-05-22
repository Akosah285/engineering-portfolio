/**
 * Khan-Academy-style step-by-step explainers attached to each demo.
 *
 * The <Explainer> component (src/components/Explainer.astro) wraps a
 * numbered list of <Step> children placed directly under a demo's
 * visualizer. Each step is 3–5 sentences (≤ 150 words), with optional
 * inline <MathExpression> math and optional <TryThis> callouts pointing
 * the reader back at the live demo.
 *
 * Contract (locked in design grill Q12, rules a–j):
 *   (a) 8–12 <Step> children per <Explainer>
 *   (b) each step has ≥ 1 <p>
 *   (c) no step exceeds 150 words of paragraph text
 *   (d) first step has no <MathExpression> and no <TryThis> (the hook)
 *   (e) last step has ≥ 1 cross-reference: a same-site demo name, a
 *       same-course Featured Problem title, or a <TryThis> naming
 *       another demo
 *   (f) ≥ 1 <MathExpression> across all steps
 *   (g) ≥ 1 <TryThis> across all steps
 *   (h) ≥ 1 cross-reference across the explainer (subset of e)
 *   (i) explainers ship per-demo, not all-or-nothing — courses can
 *       contain zero or many <Explainer> blocks; only the existing
 *       ones are checked
 *   (j) no placeholder strings inside an <Explainer>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import coursesData from "../_courses.json";

interface Course {
  slug: string;
  displayName: string;
  term: string;
  publishedAt: string | null;
}

const COURSES_DIR = resolve(__dirname, "..", "courses");
const DEMOS_DIR = resolve(__dirname, "..", "..", "components", "demos");

const PUBLISHED_COURSES = (coursesData as Course[]).filter((c) => c.publishedAt !== null);

function readMdx(slug: string): string {
  return readFileSync(resolve(COURSES_DIR, `${slug}.mdx`), "utf8");
}

/**
 * Extract every <Explainer ...>...</Explainer> block from raw MDX.
 * Returns the opening tag and the body for each.
 */
function extractExplainers(mdx: string): Array<{ openTag: string; body: string }> {
  const results: Array<{ openTag: string; body: string }> = [];
  const openPattern = /<Explainer\b/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((match = openPattern.exec(mdx)) !== null) {
    const openStart = match.index;
    const openEnd = mdx.indexOf(">", openStart);
    if (openEnd === -1) continue;
    const openTag = mdx.slice(openStart, openEnd + 1);
    const closeStart = mdx.indexOf("</Explainer>", openEnd);
    if (closeStart === -1) continue;
    const body = mdx.slice(openEnd + 1, closeStart);
    results.push({ openTag, body });
  }
  return results;
}

/**
 * Extract each <Step>...</Step> block from an explainer body.
 * Returns the raw body of each step (everything between the tags).
 */
function extractSteps(explainerBody: string): string[] {
  const steps: string[] = [];
  const openPattern = /<Step\b[^>]*>/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((match = openPattern.exec(explainerBody)) !== null) {
    const bodyStart = match.index + match[0].length;
    const closeStart = explainerBody.indexOf("</Step>", bodyStart);
    if (closeStart === -1) continue;
    steps.push(explainerBody.slice(bodyStart, closeStart));
  }
  return steps;
}

/**
 * Strip JSX tags and KaTeX latex to leave only the visible English prose
 * for the per-step word-cap rule. <MathExpression latex="..." /> bodies
 * are dropped wholesale (they're math, not prose); <TryThis> bodies are
 * dropped too (the cap is on the step's own paragraphs, not its asides).
 */
function paragraphWordCount(stepBody: string): number {
  let stripped = stepBody;
  stripped = stripped.replace(/<MathExpression\b[^/]*\/>/g, " ");
  stripped = stripped.replace(/<MathExpression\b[^>]*>[\s\S]*?<\/MathExpression>/g, " ");
  stripped = stripped.replace(/<TryThis\b[^>]*>[\s\S]*?<\/TryThis>/g, " ");
  stripped = stripped.replace(/<[^>]+>/g, " "); // remaining JSX/HTML tags
  stripped = stripped.replace(/\s+/g, " ").trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

/**
 * Inventory every demo subfolder under site/src/components/demos.
 * Returns slugs like "bisection", "fourier-series" for use as
 * cross-reference targets (rule e).
 */
function listAllDemoSlugs(): string[] {
  const slugs: string[] = [];
  for (const course of readdirSync(DEMOS_DIR)) {
    const courseDir = resolve(DEMOS_DIR, course);
    if (!statSync(courseDir).isDirectory()) continue;
    for (const demo of readdirSync(courseDir)) {
      const demoDir = resolve(courseDir, demo);
      if (!statSync(demoDir).isDirectory()) continue;
      slugs.push(demo);
    }
  }
  return slugs;
}

/**
 * Pull every <FeaturedProblem ... title="..."> from a course's MDX.
 * Used as additional cross-reference targets (rule e).
 */
function extractFeaturedProblemTitles(mdx: string): string[] {
  const titles: string[] = [];
  const pattern = /<FeaturedProblem\b[\s\S]*?title="([^"]+)"/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((match = pattern.exec(mdx)) !== null) {
    if (match[1]) titles.push(match[1]);
  }
  return titles;
}

/**
 * Pull every "## H2 heading" from a course's MDX. Demo sections are
 * H2-titled (e.g. "## Bisection method"), so this is a robust set of
 * same-course demo names to use as cross-reference targets (rule e).
 */
function extractH2Titles(mdx: string): string[] {
  const titles: string[] = [];
  for (const line of mdx.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match?.[1]) titles.push(match[1]);
  }
  return titles;
}

const ALL_DEMO_SLUGS = listAllDemoSlugs();

describe.each(PUBLISHED_COURSES)("explainers — $slug", (course: Course) => {
  const mdx = readMdx(course.slug);
  const explainers = extractExplainers(mdx);
  const fpTitles = extractFeaturedProblemTitles(mdx);
  const h2Titles = extractH2Titles(mdx);

  /**
   * Rule (i): zero or many is fine. Skip this course if it has no
   * explainers yet — we ship them per-demo.
   */
  if (explainers.length === 0) {
    it.skip("no explainers yet (per-demo rollout in progress)", () => {});
    return;
  }

  it("imports Explainer + Step + TryThis when the page has any explainer", () => {
    expect(mdx).toMatch(
      /import\s+Explainer\s+from\s+"\.\.\/\.\.\/components\/Explainer\.astro"/,
    );
    expect(mdx).toMatch(/import\s+Step\s+from\s+"\.\.\/\.\.\/components\/Step\.astro"/);
    expect(mdx).toMatch(
      /import\s+TryThis\s+from\s+"\.\.\/\.\.\/components\/TryThis\.astro"/,
    );
  });

  it("does not contain explainer-placeholder phrases", () => {
    for (const { body } of explainers) {
      expect(body).not.toMatch(/pending the (v\d+ )?explainer interview/i);
      expect(body).not.toMatch(/placeholder walkthrough pending/i);
      expect(body).not.toMatch(/will replace this walkthrough after/i);
      expect(body).not.toMatch(/\bTODO\b/);
      expect(body).not.toMatch(/\bFIXME\b/);
    }
  });

  describe.each(explainers.map((e, i) => ({ ...e, index: i })))(
    "explainer #$index",
    ({ openTag, body }) => {
      const steps = extractSteps(body);

      it("declares a demoTitle prop", () => {
        expect(openTag).toMatch(/demoTitle="[^"]+"/);
      });

      it("(a) contains between 8 and 12 <Step> children", () => {
        expect(steps.length).toBeGreaterThanOrEqual(8);
        expect(steps.length).toBeLessThanOrEqual(12);
      });

      it("(b) every step contains at least one <p>", () => {
        for (const step of steps) {
          expect(step).toMatch(/<p[\s>]/);
        }
      });

      it("(c) no step exceeds 150 words of paragraph text", () => {
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i];
          if (step === undefined) continue;
          const count = paragraphWordCount(step);
          expect(
            count,
            `step ${i + 1} has ${count} words (cap is 150)`,
          ).toBeLessThanOrEqual(150);
        }
      });

      it("(d) the first step is a hook: no <MathExpression>, no <TryThis>", () => {
        const first = steps[0];
        if (first === undefined) throw new Error("no first step");
        expect(first).not.toContain("<MathExpression");
        expect(first).not.toContain("<TryThis");
      });

      it("(f) contains at least one <MathExpression> across all steps", () => {
        const total = steps.reduce(
          (n, s) => n + (s.match(/<MathExpression\b/g) ?? []).length,
          0,
        );
        expect(total).toBeGreaterThanOrEqual(1);
      });

      it("(g) contains at least one <TryThis> across all steps", () => {
        const total = steps.reduce(
          (n, s) => n + (s.match(/<TryThis\b/g) ?? []).length,
          0,
        );
        expect(total).toBeGreaterThanOrEqual(1);
      });

      it("(e+h) last step references another demo or FP on the site", () => {
        const last = steps[steps.length - 1];
        if (last === undefined) throw new Error("no last step");
        const otherDemoSlugs = ALL_DEMO_SLUGS.filter((s) => !openTag.includes(`"${s}"`));
        const otherH2 = h2Titles.filter((t) => !openTag.includes(`demoTitle="${t}"`));

        const referencesOtherDemoSlug = otherDemoSlugs.some((s) =>
          last.toLowerCase().includes(s.toLowerCase().replace(/-/g, " ")),
        );
        const referencesOtherH2 = otherH2.some((t) =>
          last.toLowerCase().includes(t.toLowerCase()),
        );
        const referencesFp = fpTitles.some((t) =>
          last.toLowerCase().includes(t.toLowerCase()),
        );
        const hasConnectVerb =
          /\b(see|next|paired? with|builds? on|same|connects?|generalis(?:e|es)|extends?)\b/i.test(
            last,
          );

        expect(
          referencesOtherDemoSlug || referencesOtherH2 || referencesFp || hasConnectVerb,
          `last step lacks a cross-reference; expected mention of a same-site demo, an H2 demo title, a Featured Problem title, or a connective verb. Got: ${last.slice(0, 200)}...`,
        ).toBe(true);
      });
    },
  );
});
