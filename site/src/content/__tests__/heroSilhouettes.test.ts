/**
 * #44-#51 — Hero-demo silhouette SVGs for every published course.
 *
 * The templated OG card pipeline (src/pages/og/courses/[slug].ts)
 * opportunistically embeds a silhouette PNG when one exists at
 * public/og-silhouettes/{slug}.svg. Without it, the course OG card
 * falls back to title + description only.
 *
 * This test asserts every published course (i.e. publishedAt !== null)
 * has a silhouette SVG and that each SVG meets the shared contract:
 * monochrome Dartmouth Pine, 480×480 viewBox, accessible <title>, no
 * raster content. Closes the "Hero-demo silhouette SVG for OG card
 * committed" criterion across v3-v10 epics.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import coursesData from "../_courses.json";

const SITE_ROOT = resolve(__dirname, "../../..");
const SILHOUETTES_DIR = resolve(SITE_ROOT, "public/og-silhouettes");
const DARTMOUTH_PINE = "#00693e";

interface Course {
  slug: string;
  publishedAt: string | null;
}

const PUBLISHED_SLUGS = (coursesData as Course[])
  .filter((c) => c.publishedAt !== null)
  .map((c) => c.slug);

describe("hero-demo silhouettes (#44-#51 OG criterion)", () => {
  it("sanity: at least one published course is in the catalog", () => {
    expect(PUBLISHED_SLUGS.length).toBeGreaterThan(0);
  });

  for (const slug of PUBLISHED_SLUGS) {
    describe(slug, () => {
      const svgPath = resolve(SILHOUETTES_DIR, `${slug}.svg`);

      it("has a silhouette SVG at public/og-silhouettes/{slug}.svg", () => {
        expect(existsSync(svgPath)).toBe(true);
      });

      it("uses the Dartmouth Pine stroke colour", () => {
        const svg = readFileSync(svgPath, "utf8").toLowerCase();
        expect(svg).toContain(DARTMOUTH_PINE);
      });

      it("declares a 480×480 viewBox", () => {
        const svg = readFileSync(svgPath, "utf8");
        expect(svg).toMatch(/viewBox\s*=\s*"0\s+0\s+480\s+480"/);
      });

      it("includes a <title> for screen readers", () => {
        const svg = readFileSync(svgPath, "utf8");
        expect(svg).toMatch(/<title>[^<]+<\/title>/);
      });

      it("contains no raster <image> tags (must be pure vector)", () => {
        const svg = readFileSync(svgPath, "utf8");
        expect(svg).not.toMatch(/<image\b/i);
      });
    });
  }
});
