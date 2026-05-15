/**
 * Build-output smoke test: every emitted HTML page must include the locked
 * footer attribution line (plan §7.10). Catches regressions where someone
 * accidentally bypasses Layout.astro or removes the Footer slot.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FOOTER_LINE =
  "Code MIT · Content CC-BY-NC-SA 4.0 · Featured problems adapted from Dartmouth";

function* walkHtml(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walkHtml(full);
    else if (name.endsWith(".html")) yield full;
  }
}

const distDir = join(process.cwd(), "dist");

describe("footer attribution smoke test", () => {
  it("every built HTML page contains the licensing footer line", () => {
    let distExists = true;
    try {
      statSync(distDir);
    } catch {
      distExists = false;
    }
    if (!distExists) {
      // The dist/ folder doesn't exist yet. Skip-tolerant: CI runs build
      // before tests so this only matters in fresh checkouts.
      console.warn("dist/ missing; skipping footer smoke test");
      return;
    }

    const pages = [...walkHtml(distDir)];
    expect(pages.length, "should have at least one built HTML page").toBeGreaterThan(0);

    const missing: string[] = [];
    for (const page of pages) {
      const html = readFileSync(page, "utf8");
      if (!html.includes(FOOTER_LINE)) {
        missing.push(page);
      }
    }

    expect(missing, `pages missing footer line:\n  ${missing.join("\n  ")}`).toEqual([]);
  });
});
