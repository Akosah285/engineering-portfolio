/**
 * /dev/gallery/ completeness invariant.
 *
 * The dev gallery (`src/pages/dev/gallery.astro`) mounts every Visualizer
 * component on one page as a build-time shakedown — it's how we verify each
 * demo compiles, hydrates, and renders without runtime errors in production
 * mode. The plan §2.13 lists this as a v0 spine artifact.
 *
 * Failure mode without this test: someone adds a new demo (TDD'd algorithm
 * + React shell + Visualizer), wires it into the relevant course MDX,
 * but forgets to add it to the gallery. The build still passes, the
 * course page renders fine, but the shakedown loses coverage for that
 * Visualizer — and any production-only hydration regression in that
 * single demo slips through CI silently.
 *
 * What this test asserts:
 *   1. Every `*Visualizer.tsx` file under `src/components/demos/**` (excluding
 *      `__tests__/`) is imported by `src/pages/dev/gallery.astro`.
 *   2. The gallery file itself is well-formed (parses, has imports section).
 *   3. Every import in the gallery resolves to a real file on disk
 *      (catches stale entries after a Visualizer is renamed/deleted).
 *
 * What this test does NOT assert (out of scope):
 *   - That the Visualizer is actually rendered in the gallery body (the
 *     compiler catches dead imports of named/default exports already).
 *   - That every Visualizer has a `__tests__/` peer (separate invariant).
 *   - That the gallery is reachable via nav (intentionally not — it's a
 *     dev-only URL).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const DEMOS_DIR = resolve(ROOT, "src/components/demos");
const GALLERY_PATH = resolve(ROOT, "src/pages/dev/gallery.astro");
const GALLERY_DIR = dirname(GALLERY_PATH);

function listVisualizerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...listVisualizerFiles(full));
    } else if (stats.isFile() && /Visualizer\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function readGallery(): string {
  return readFileSync(GALLERY_PATH, "utf8");
}

function basenameNoExt(file: string): string {
  const base = file.split(/[/\\]/).pop() ?? file;
  return base.replace(/\.tsx$/, "");
}

describe("dev gallery completeness", () => {
  it("imports every Visualizer.tsx from src/components/demos/**", () => {
    const visualizers = listVisualizerFiles(DEMOS_DIR);
    const gallery = readGallery();

    expect(visualizers.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const file of visualizers) {
      const name = basenameNoExt(file);
      // Match the trailing path segment (directory + filename without .tsx),
      // which is unique per Visualizer regardless of named-vs-default export.
      const relFromDemos = file
        .substring(DEMOS_DIR.length + 1)
        .replace(/\\/g, "/")
        .replace(/\.tsx$/, "");
      // Gallery imports look like:
      //   from "../../components/demos/{course}/{slug}/{ComponentName}"
      const fragment = `components/demos/${relFromDemos}`;
      if (!gallery.includes(fragment)) {
        missing.push(name);
      }
    }

    expect(
      missing,
      `These Visualizers are not imported by /dev/gallery.astro: ${missing.join(
        ", ",
      )}. Add the import + a <DemoChrome> mount block to src/pages/dev/gallery.astro.`,
    ).toEqual([]);
  });

  it("the gallery file is well-formed (has Astro frontmatter fence + imports section)", () => {
    const gallery = readGallery();
    expect(gallery.startsWith("---")).toBe(true);
    const fenceEnd = gallery.indexOf("\n---", 3);
    expect(fenceEnd).toBeGreaterThan(0);
    const frontmatter = gallery.slice(3, fenceEnd);
    expect(frontmatter).toMatch(/import\s+.+from\s+["'].+["'];/);
  });

  it("does not import any non-existent Visualizer paths (catches stale gallery entries)", () => {
    const gallery = readGallery();
    const importLines = gallery
      .split("\n")
      .filter((l) => /^import .+ from .+demos\/.+Visualizer/.test(l));

    const stale: string[] = [];
    for (const line of importLines) {
      const match = line.match(/from\s+["'](.+?)["']/);
      if (!match) continue;
      const importPath = match[1]!;
      const resolved = resolve(GALLERY_DIR, `${importPath}.tsx`);
      try {
        statSync(resolved);
      } catch {
        stale.push(importPath);
      }
    }

    expect(
      stale,
      `These gallery imports point to non-existent files: ${stale.join(
        ", ",
      )}. Either restore the deleted Visualizer or remove the gallery import.`,
    ).toEqual([]);
  });

  it("imports at least one Visualizer per course slug from the catalog", () => {
    // Pulls the canonical 9 course slugs from _courses.json and asserts each
    // appears in at least one gallery import path. Catches the case where an
    // entire course's demo fleet vanishes from the shakedown.
    const catalogPath = resolve(ROOT, "src/content/_courses.json");
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
      slug: string;
    }>;
    const gallery = readGallery();

    const coursesWithoutVisualizers: string[] = [];
    for (const { slug } of catalog) {
      // Skip courses where no demos have been built yet on disk — the
      // first invariant catches missing-on-disk-but-skipped cases.
      const courseDir = join(DEMOS_DIR, slug);
      let hasDemos = false;
      try {
        hasDemos = listVisualizerFiles(courseDir).length > 0;
      } catch {
        hasDemos = false;
      }
      if (!hasDemos) continue;

      const fragment = `components/demos/${slug}/`;
      if (!gallery.includes(fragment)) {
        coursesWithoutVisualizers.push(slug);
      }
    }

    expect(
      coursesWithoutVisualizers,
      `These course slugs have Visualizers on disk but none are imported by /dev/gallery.astro: ${coursesWithoutVisualizers.join(
        ", ",
      )}.`,
    ).toEqual([]);
  });
});
