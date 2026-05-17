/**
 * Sitemap configuration contract.
 *
 * The @astrojs/sitemap integration generates `dist/sitemap-index.xml` and
 * `dist/sitemap-0.xml` at build time. Search engines crawl that file to
 * discover every public URL on the site. If the integration is removed or
 * misconfigured, the site stops being indexable cleanly — a silent SEO
 * regression no other test catches.
 *
 * This test locks the *source* of the config (astro.config.mjs) rather
 * than running an integration test against dist/, because:
 *   1. Vitest runs in ~1s; an integration test would need `astro build`
 *      first (~15s) and a working dist/ tree.
 *   2. The integration itself is exercised by every CI build (the build
 *      log confirms `[@astrojs/sitemap] sitemap-index.xml created`).
 *   3. What we want to lock here is the *contract*: the integration is
 *      present, configured correctly, and the `/dev/*` filter is in place.
 *
 * Failure modes covered:
 *   - Someone removes @astrojs/sitemap from astro.config.mjs (test fails).
 *   - Someone drops the `filter` that excludes /dev/ (test fails).
 *   - Someone removes the `site` URL (sitemap entries would be invalid).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const CONFIG_PATH = resolve(ROOT, "astro.config.mjs");
const PACKAGE_PATH = resolve(ROOT, "package.json");

describe("sitemap configuration", () => {
  it("imports @astrojs/sitemap in astro.config.mjs", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    expect(cfg).toMatch(/import\s+sitemap\s+from\s+["']@astrojs\/sitemap["']/);
  });

  it("includes sitemap() in the integrations array", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    expect(cfg).toMatch(/sitemap\s*\(/);
  });

  it("declares @astrojs/sitemap as a dependency in package.json", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps["@astrojs/sitemap"]).toBeDefined();
  });

  it("filters /dev/ URLs out of the sitemap (the shakedown gallery must stay hidden)", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    // Should have a filter that excludes anything containing "/dev/".
    // The exact callback shape can vary; we just assert /dev/ is referenced
    // inside the sitemap config block.
    const sitemapBlock = cfg.match(/sitemap\s*\(\s*\{[\s\S]*?\}\s*\)/);
    expect(sitemapBlock, "sitemap() must be called with a config object").not.toBeNull();
    expect(sitemapBlock?.[0]).toMatch(/\/dev\//);
  });

  it("declares a `site` URL (required for sitemap entries to be absolute)", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    expect(cfg).toMatch(/site:\s*["']https?:\/\/[^"']+["']/);
  });

  it("declares a `base` path (the URLs in the sitemap must include the GH Pages subpath)", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    expect(cfg).toMatch(/base:\s*["']\/engineering-portfolio["']/);
  });

  it("declares `trailingSlash: 'always'` (sitemap URLs match route format)", () => {
    const cfg = readFileSync(CONFIG_PATH, "utf8");
    expect(cfg).toMatch(/trailingSlash:\s*["']always["']/);
  });
});
