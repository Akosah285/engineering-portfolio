# engineering-portfolio

A public, polished, intensively-interactive engineering portfolio capturing **9 Dartmouth Thayer School courses**. Bespoke per-course pages with multiple browser demos, featured problems transcribed from handwritten work into typeset KaTeX, and personal reflections.

> **Status:** v0 spine deployed. 9 course pages live (1 published, 8 pre-interview preview). ~80 algorithm brains TDD'd + 75 React shell demos in `/dev/gallery`. 1797 TS tests + 330 Python tests passing.

**Author:** Akwasi Akosah · Dartmouth BA '21, TH '21
**Live site:** https://akosah285.github.io/engineering-portfolio/
**Repo:** https://github.com/Akosah285/engineering-portfolio

---

## What's here

```
engineering-portfolio/
  archive/originals/      .gitignored — copies of source PDFs (~2 GB, never committed)
  data/                   committed OCR sidecars + page images + SQLite index
  tools/ocr-vault/        Python CLI for OCR'ing handwritten coursework (uv + pyproject.toml)
  site/                   Astro app (the website itself)
  docs/agents/            engineering-skills config (issue tracker, triage, domain layout)
  .github/workflows/      build → deploy GitHub Pages
```

Full plan, decisions, and todos live in this session's plan.md (linked from issue #1).

## Stack

| Layer | Pick |
|---|---|
| Site | Astro 5 · MDX · React 19 islands · KaTeX (SSR'd) |
| Math | KaTeX, server-side rendered at build |
| Search | Pagefind (build-time index, indexed with custom weights via `<MathExpression>` / `<CodeReveal>` / `<DemoNarration>`) |
| SEO | `@astrojs/sitemap` (sitemap-index + per-section), `public/robots.txt`, branded `src/pages/404.astro`, templated OG cards via `astro-og-canvas` |
| Hosting | GitHub Pages (`https://akosah285.github.io/engineering-portfolio/`) |
| Styling | Biome (lint + format, 0 warnings) |
| Package manager | pnpm (corepack-pinned `pnpm@10.15.0`) |
| OCR tool | Python via `uv` · Anthropic Claude vision (provider-agnostic, with OpenAI / Gemini / Mock fallbacks) |
| OCR quality | `pyproject.toml` + ruff + mypy --strict + pytest |
| CI gates | type-check (`tsc`) · `astro check` · Biome · Vitest · pytest · ruff · `pnpm build` (incl. Pagefind index) · Lighthouse CI (warn at v3) · lychee link check (warn at v3) · GH Pages deploy on main |

## Demo kit

Demos live under `site/src/components/demos/{course-slug}/{demo-slug}/` with a paired `algorithm.ts` (pure math, TDD'd in `__tests__/algorithm.test.ts`) and a React Visualizer that imports both the function (to run) and `algorithm.ts?raw` (to display via `<CodeReveal>`) so there's one source of truth. The shared primitives in `site/src/components/demo-kit/` cover chrome, math, plotting, narration (`aria-live` transcript for canvas demos per plan §7.3), share/state-in-URL serialization, preset carousels, no-JS fallback, and favorite-page lightbox. Browse the full fleet at [/engineering-portfolio/dev/gallery/](https://akosah285.github.io/engineering-portfolio/dev/gallery/) (developer shakedown — excluded from search + sitemap).

## Reuse

| Surface | License |
|---|---|
| Code (Astro components, demos, OCR tool, scripts) | **MIT** — see `LICENSE` |
| Site content (writeups, reflections, demo narrations, illustrations) | **CC-BY-NC-SA 4.0** — see `CONTENT-LICENSE.md` |
| Featured problem statements | Paraphrased in author's voice with attribution: *"Adapted from Dartmouth ENGS XX, [term]"* |
| Original instructor materials | Not republished; stay local in `archive/originals/` (gitignored) |

## Privacy

This site occasionally references group projects with other students. Default protocol:
- Non-author names redacted in public-facing surfaces (thumbnails, visible text)
- Course writeups default to *"I worked with two others on this project"* without naming
- Opt-in attribution: a teammate is named only when the author has explicitly decided to credit them
- TA and instructor names omitted unless explicit opt-in per course

PII is auto-detected during OCR and surfaced via `ocr-vault list-pii` for review.

## Build & deploy

```bash
# Site
cd site
pnpm install
pnpm dev              # local dev server (http://localhost:4321/engineering-portfolio/)
pnpm build            # production build (KaTeX SSR + Pagefind index + sitemap + OG cards)
pnpm test             # Vitest (1797 tests across 199 files)
pnpm run lint         # Biome (0 errors, 0 warnings)
pnpm run typecheck    # tsc --noEmit
pnpm run check        # astro check

# OCR tool
cd tools/ocr-vault
uv sync
uv run ocr-vault --help
uv run pytest         # 330 tests
```

Deploys happen automatically when commits land on `main` — see `.github/workflows/deploy.yml`. PRs run all CI gates but never deploy. Performance + accessibility regressions surface via `.github/workflows/lighthouse.yml` (matrix: mobile + desktop). Broken-link drift surfaces via `.github/workflows/lychee.yml` (push + PR + weekly Monday cron).

## License summary

> Code MIT · Content CC-BY-NC-SA 4.0 · Featured problems adapted from Dartmouth coursework
