/**
 * Catalog ↔ MDX consistency invariants.
 *
 * Two sources of truth used to coexist: `_courses.json` (catalog: slug,
 * displayName, term, displayOrder, publishedAt, comingSoonPreview) and the
 * per-course MDX (`src/content/courses/{slug}.mdx`, with frontmatter for
 * concepts, techTags, oneLineTakeaway, etc.). Routes pull from both:
 *
 * - `/courses/[slug]/` publishes based on JSON.publishedAt + MDX.draft
 * - `/concepts/[tag]/` indexes based on MDX.concepts and MDX.draft
 * - `og/courses/[slug].png` uses MDX.oneLineTakeaway as the OG description
 *
 * Without these invariants, a Coming-Soon course can quietly slip into the
 * concept index, or an OG card can render with stale/mismatched metadata.
 * Failing fast at unit-test time prevents that drift.
 *
 * Per rubber-duck critique (blocking #1) for the v3+ Coming-Soon scaffold:
 *   1. Every catalog slug has a matching MDX file
 *   2. MDX.term === catalog.term
 *   3. MDX.publishedAt === catalog.publishedAt
 *   4. catalog.publishedAt === null  ↔  MDX.draft === true
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface CatalogCourse {
  slug: string;
  displayName: string;
  term: string;
  displayOrder: number;
  publishedAt: string | null;
  comingSoonPreview?: string;
}

interface MdxFrontmatter {
  title: string;
  term: string;
  publishedAt: string | null;
  draft: boolean;
  concepts: string[];
  techTags?: string[];
  oneLineTakeaway?: string;
  heroDemoLabel?: string;
}

const ROOT = resolve(process.cwd());
const CATALOG_PATH = resolve(ROOT, "src/content/_courses.json");
const MDX_DIR = resolve(ROOT, "src/content/courses");

const TEMPLATE_BASENAMES = new Set(["template.mdx"]);

function loadCatalog(): CatalogCourse[] {
  const raw = readFileSync(CATALOG_PATH, "utf8");
  return JSON.parse(raw) as CatalogCourse[];
}

function listMdxFiles(): string[] {
  return readdirSync(MDX_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !TEMPLATE_BASENAMES.has(f));
}

/**
 * Minimal YAML frontmatter parser — only handles the fields/forms our
 * course MDX uses (scalar strings, scalar nulls, scalar booleans, simple
 * arrays via leading dashes). Throws if the body doesn't open with `---`.
 */
function parseFrontmatter(mdx: string): MdxFrontmatter {
  if (!mdx.startsWith("---")) {
    throw new Error("MDX does not start with frontmatter fence `---`");
  }
  const end = mdx.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error("MDX frontmatter fence not closed");
  }
  const body = mdx.slice(3, end).trim();
  const lines = body.split("\n");

  const result: Record<string, unknown> = {};
  let currentList: string[] | null = null;
  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") continue;

    if (currentList !== null && line.startsWith("  - ")) {
      currentList.push(line.slice(4).trim());
      continue;
    }
    // line starts a new key
    currentList = null;
    currentKey = null;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();

    if (valueRaw === "") {
      currentList = [];
      currentKey = key;
      result[key] = currentList;
      continue;
    }
    if (valueRaw === "null") {
      result[key] = null;
      continue;
    }
    if (valueRaw === "true") {
      result[key] = true;
      continue;
    }
    if (valueRaw === "false") {
      result[key] = false;
      continue;
    }
    // strip surrounding quotes (single or double)
    const unquoted =
      (valueRaw.startsWith('"') && valueRaw.endsWith('"')) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
        ? valueRaw.slice(1, -1)
        : valueRaw;
    result[key] = unquoted;
  }
  void currentKey;
  return result as unknown as MdxFrontmatter;
}

function loadMdxFrontmatter(filename: string): MdxFrontmatter {
  const path = resolve(MDX_DIR, filename);
  const content = readFileSync(path, "utf8");
  return parseFrontmatter(content);
}

describe("catalog ↔ MDX consistency", () => {
  describe("schema coverage", () => {
    it("every catalog slug has a matching <slug>.mdx file (no orphans either way)", () => {
      const catalog = loadCatalog();
      const catalogSlugs = new Set(catalog.map((c) => c.slug));
      const mdxSlugs = new Set(listMdxFiles().map((f) => f.replace(/\.mdx$/, "")));
      const missingMdx = [...catalogSlugs].filter((s) => !mdxSlugs.has(s));
      const orphanMdx = [...mdxSlugs].filter((s) => !catalogSlugs.has(s));
      expect(missingMdx).toEqual([]);
      expect(orphanMdx).toEqual([]);
    });
  });

  describe("frontmatter values agree with catalog", () => {
    const catalog = loadCatalog();
    for (const course of catalog) {
      describe(`course: ${course.slug}`, () => {
        it("term matches catalog", () => {
          const front = loadMdxFrontmatter(`${course.slug}.mdx`);
          expect(front.term).toBe(course.term);
        });

        it("publishedAt matches catalog", () => {
          const front = loadMdxFrontmatter(`${course.slug}.mdx`);
          expect(front.publishedAt).toBe(course.publishedAt);
        });

        it("draft state mirrors catalog.publishedAt nullness", () => {
          const front = loadMdxFrontmatter(`${course.slug}.mdx`);
          if (course.publishedAt === null) {
            expect(front.draft).toBe(true);
          } else {
            expect(front.draft).toBe(false);
          }
        });

        it("title matches catalog.displayName", () => {
          const front = loadMdxFrontmatter(`${course.slug}.mdx`);
          expect(front.title).toBe(course.displayName);
        });
      });
    }
  });
});
