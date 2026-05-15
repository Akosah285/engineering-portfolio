# engineering-portfolio

A public, polished, intensively-interactive engineering portfolio capturing **9 Dartmouth Thayer School courses**. Bespoke per-course pages with multiple browser demos, featured problems transcribed from handwritten work into typeset KaTeX, and personal reflections.

> **Status:** building in public. v0 spine in progress.

**Author:** Akwasi Akosah · Dartmouth BA '21, TH '21
**Live site:** https://akosah285.github.io/engineering-portfolio/ *(pending v0 deploy)*
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
| Site | Astro · MDX · React 19 islands · KaTeX (SSR'd) |
| Math | KaTeX, server-side rendered at build |
| Search | Pagefind (build-time index) |
| Hosting | GitHub Pages |
| Styling | Biome (lint + format) |
| Package manager | pnpm |
| OCR tool | Python via `uv` · Anthropic Claude vision (provider-agnostic) |
| OCR types | `pyproject.toml` + ruff + mypy --strict + pytest |
| CI | GitHub Actions: type-check + Biome + build + Pagefind + lychee + cspell + Lighthouse CI (warn at v3, fail at v6) |

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

> v0 spine setup in progress. Setup commands will land in this section as they're implemented.

```bash
# Site
pnpm install
pnpm dev              # local dev server
pnpm build            # production build (incl. Pagefind index, OG cards, KaTeX SSR)

# OCR tool
cd tools/ocr-vault
uv sync
uv run ocr-vault --help
```

## License summary

> Code MIT · Content CC-BY-NC-SA 4.0 · Featured problems adapted from Dartmouth coursework
