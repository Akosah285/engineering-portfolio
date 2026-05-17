/**
 * /404.astro contract test.
 *
 * GitHub Pages serves `/404.html` for any unknown path (the file Astro
 * generates from `src/pages/404.astro`). If the file disappears, every
 * unknown URL falls back to GH's generic plain-text 404 — a silent UX
 * regression that no other test currently catches.
 *
 * Asserts the source file exists and contains the minimum contract:
 *   - Astro frontmatter fence
 *   - Wraps content in <Layout> (so the wordmark + theme + nav appear)
 *   - Has a primary heading
 *   - Has a back-home link using BASE_URL
 *   - Is excluded from Pagefind (404 results in search are confusing)
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const NOT_FOUND_PATH = resolve(ROOT, "src/pages/404.astro");

describe("/404.astro contract", () => {
  it("exists at src/pages/404.astro", () => {
    expect(existsSync(NOT_FOUND_PATH)).toBe(true);
  });

  it("opens with Astro frontmatter fence", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    expect(body.startsWith("---")).toBe(true);
    const fenceEnd = body.indexOf("\n---", 3);
    expect(fenceEnd).toBeGreaterThan(0);
  });

  it("imports and uses <Layout>", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    expect(body).toMatch(/import\s+Layout\s+from\s+["']\.\.\/layouts\/Layout\.astro["']/);
    expect(body).toMatch(/<Layout[\s>]/);
  });

  it("renders a primary <h1> heading", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    expect(body).toMatch(/<h1[\s>]/);
  });

  it("links back to home via BASE_URL (so the link works under /engineering-portfolio/)", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    expect(body).toMatch(/import\.meta\.env\.BASE_URL/);
    // Asserts at least one <a> tag with href using BASE_URL.
    expect(body).toMatch(/<a[^>]+href=\{[^}]*BASE_URL/);
  });

  it("is excluded from Pagefind indexing", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    // Either data-pagefind-ignore on a wrapping element, or pagefindType="404"
    // to signal "don't show this in search results". Both patterns are accepted.
    const hasIgnore = /data-pagefind-ignore/.test(body);
    const hasTypeFlag = /pagefindType=["']404["']/.test(body);
    expect(hasIgnore || hasTypeFlag).toBe(true);
  });

  it("has an accessible title prop on <Layout>", () => {
    const body = readFileSync(NOT_FOUND_PATH, "utf8");
    // Astro requires the title prop; the test guards against accidental removal.
    expect(body).toMatch(/<Layout[^>]*title=/);
  });
});
