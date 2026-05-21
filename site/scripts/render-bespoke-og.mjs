#!/usr/bin/env node
/**
 * Bespoke OG-card renderer (closes #9).
 *
 * Reads hand-authored SVGs from src/og-templates/ and renders them to
 * 1200×630 PNGs in public/og/. Unlike the templated course OG pipeline
 * (src/pages/og/courses/[slug].ts, which uses astro-og-canvas at build
 * time), the landing + About cards are committed as static PNGs so the
 * visual identity for the most-shared URLs is locked and design-reviewed
 * rather than regenerated from data.
 *
 * Run with:
 *   pnpm og:bespoke
 *
 * After editing either SVG, re-run this script and commit the resulting
 * PNGs along with the SVG changes.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, "..");
const templatesDir = resolve(siteRoot, "src/og-templates");
const outDir = resolve(siteRoot, "public/og");

const TARGETS = [
  { svg: "landing.svg", png: "landing.png" },
  { svg: "about.svg", png: "about.png" },
];

async function renderOne({ svg, png }) {
  const svgPath = resolve(templatesDir, svg);
  const pngPath = resolve(outDir, png);
  const svgBuf = await readFile(svgPath);
  // density: 300 mirrors the templated silhouette pipeline so rendered
  // type stays crisp at the OG card's display size.
  const pngBuf = await sharp(svgBuf, { density: 300 })
    .resize(1200, 630, {
      fit: "contain",
      background: { r: 252, g: 250, b: 246, alpha: 1 },
    })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await writeFile(pngPath, pngBuf);
  // eslint-disable-next-line no-console
  console.log(`✓ ${svg} → ${png} (${pngBuf.byteLength} bytes)`);
}

await Promise.all(TARGETS.map(renderOne));
