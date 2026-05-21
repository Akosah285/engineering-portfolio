/**
 * #9 — Bespoke OG cards for landing + About.
 *
 * Asserts:
 *   - Source SVGs exist in src/og-templates/ and contain the visual brand
 *     anchors (Dartmouth Pine accent, wordmark text, page-specific
 *     descriptor).
 *   - Rendered PNGs are committed to public/og/ at exactly 1200×630.
 *   - The landing + about pages reference the bespoke PNGs via
 *     <HeadMeta ogImage>.
 *   - The bespoke-render script is wired as an npm script so contributors
 *     can re-render after editing the SVGs.
 *
 * These are not templated — they're committed-once visual identity assets
 * shared on social. The tests guard their existence + dimensions so a
 * future refactor that deletes them surfaces immediately.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SITE_ROOT = resolve(__dirname, "../../..");
const LANDING_SVG = resolve(SITE_ROOT, "src/og-templates/landing.svg");
const ABOUT_SVG = resolve(SITE_ROOT, "src/og-templates/about.svg");
const LANDING_PNG = resolve(SITE_ROOT, "public/og/landing.png");
const ABOUT_PNG = resolve(SITE_ROOT, "public/og/about.png");
const INDEX_ASTRO = resolve(SITE_ROOT, "src/pages/index.astro");
const ABOUT_ASTRO = resolve(SITE_ROOT, "src/pages/about.astro");
const PACKAGE_JSON = resolve(SITE_ROOT, "package.json");
const RENDER_SCRIPT = resolve(SITE_ROOT, "scripts/render-bespoke-og.mjs");

const DARTMOUTH_PINE = "#00693e";

/** Read the IHDR width/height from a PNG buffer without decoding pixels. */
function readPngDimensions(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  // PNG signature is 8 bytes, then IHDR chunk: 4 length + "IHDR" + 4 width + 4 height
  const sig = buf.subarray(0, 8).toString("hex");
  if (sig !== "89504e470d0a1a0a") {
    throw new Error(`${path} is not a valid PNG (signature ${sig})`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe("#9 — bespoke OG cards", () => {
  describe("source SVGs", () => {
    it("landing.svg exists", () => {
      expect(existsSync(LANDING_SVG)).toBe(true);
    });

    it("about.svg exists", () => {
      expect(existsSync(ABOUT_SVG)).toBe(true);
    });

    it("landing.svg uses Dartmouth Pine accent", () => {
      const svg = readFileSync(LANDING_SVG, "utf8");
      expect(svg.toLowerCase()).toContain(DARTMOUTH_PINE);
    });

    it("about.svg uses Dartmouth Pine accent", () => {
      const svg = readFileSync(ABOUT_SVG, "utf8");
      expect(svg.toLowerCase()).toContain(DARTMOUTH_PINE);
    });

    it("landing.svg includes the wordmark + descriptor", () => {
      const svg = readFileSync(LANDING_SVG, "utf8");
      expect(svg).toContain("Akwasi Akosah");
      expect(svg.toLowerCase()).toContain("engineering portfolio");
    });

    it("about.svg includes the About headline", () => {
      const svg = readFileSync(ABOUT_SVG, "utf8");
      expect(svg).toContain("About Akwasi Akosah");
      expect(svg.toLowerCase()).toContain("engineering portfolio");
    });

    it("both SVGs declare a 1200×630 viewBox", () => {
      for (const path of [LANDING_SVG, ABOUT_SVG]) {
        const svg = readFileSync(path, "utf8");
        // Either explicit width/height or viewBox="0 0 1200 630"
        expect(svg).toMatch(/viewBox\s*=\s*"0\s+0\s+1200\s+630"/);
      }
    });
  });

  describe("committed PNGs", () => {
    it("public/og/landing.png exists", () => {
      expect(existsSync(LANDING_PNG)).toBe(true);
    });

    it("public/og/about.png exists", () => {
      expect(existsSync(ABOUT_PNG)).toBe(true);
    });

    it("landing.png is exactly 1200×630", () => {
      const { width, height } = readPngDimensions(LANDING_PNG);
      expect(width).toBe(1200);
      expect(height).toBe(630);
    });

    it("about.png is exactly 1200×630", () => {
      const { width, height } = readPngDimensions(ABOUT_PNG);
      expect(width).toBe(1200);
      expect(height).toBe(630);
    });
  });

  describe("page wiring", () => {
    it("index.astro references the bespoke landing OG via HeadMeta", () => {
      const body = readFileSync(INDEX_ASTRO, "utf8");
      expect(body).toMatch(/og\/landing\.png/);
      // Must pass through Layout/HeadMeta ogImage prop, not a raw <meta>.
      expect(body).toMatch(/ogImage/);
    });

    it("about.astro references the bespoke about OG via HeadMeta", () => {
      const body = readFileSync(ABOUT_ASTRO, "utf8");
      expect(body).toMatch(/og\/about\.png/);
      expect(body).toMatch(/ogImage/);
    });
  });

  describe("render pipeline", () => {
    it("render script exists at scripts/render-bespoke-og.mjs", () => {
      expect(existsSync(RENDER_SCRIPT)).toBe(true);
    });

    it("script renders both landing + about SVGs", () => {
      const body = readFileSync(RENDER_SCRIPT, "utf8");
      expect(body).toContain("landing.svg");
      expect(body).toContain("about.svg");
      expect(body).toContain("landing.png");
      expect(body).toContain("about.png");
      // Uses sharp (same dep as the templated OG pipeline)
      expect(body).toMatch(/from\s+["']sharp["']|require\(["']sharp["']\)/);
    });

    it("package.json exposes an 'og:bespoke' npm script", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts["og:bespoke"]).toBeDefined();
      expect(pkg.scripts["og:bespoke"]).toContain("render-bespoke-og");
    });
  });
});
