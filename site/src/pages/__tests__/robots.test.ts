/**
 * robots.txt contract.
 *
 * `site/public/robots.txt` is served at the site root after build (Astro
 * copies `public/*` verbatim into `dist/`). Search engines fetch it before
 * crawling, so the sitemap reference here is what makes the sitemap
 * discoverable.
 *
 * Failure modes covered:
 *   - File deleted entirely.
 *   - Sitemap reference removed or pointed at a stale URL.
 *   - /dev/ path accidentally opened to crawlers (would expose the
 *     shakedown gallery as indexable content).
 *
 * Note: we lock both the file content and the conventional URL paths.
 * The base path here (`/engineering-portfolio/`) must match
 * astro.config.mjs's `base` setting — locked separately by
 * sitemap.test.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const ROBOTS_PATH = resolve(ROOT, "public/robots.txt");

describe("robots.txt contract", () => {
  it("exists at public/robots.txt", () => {
    expect(existsSync(ROBOTS_PATH)).toBe(true);
  });

  it("contains a User-agent: * directive", () => {
    const body = readFileSync(ROBOTS_PATH, "utf8");
    expect(body).toMatch(/User-agent:\s*\*/);
  });

  it("references the sitemap index by absolute URL", () => {
    const body = readFileSync(ROBOTS_PATH, "utf8");
    expect(body).toMatch(
      /Sitemap:\s*https:\/\/akosah285\.github\.io\/engineering-portfolio\/sitemap-index\.xml/,
    );
  });

  it("disallows /engineering-portfolio/dev/ from crawlers (keeps the shakedown gallery out of indexes)", () => {
    const body = readFileSync(ROBOTS_PATH, "utf8");
    expect(body).toMatch(/Disallow:\s*\/engineering-portfolio\/dev\//);
  });
});
