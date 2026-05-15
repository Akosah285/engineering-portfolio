# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Layout

**Single-context repo.**

```
/
├── CONTEXT.md               # created lazily by /grill-with-docs
├── docs/
│   ├── adr/                 # created lazily by /grill-with-docs
│   ├── PLAN.md              # mirror of the session-state plan
│   └── agents/              # this folder
└── ...
```

If `CONTEXT.md` or any ADRs don't exist yet, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually crystallize.

## Use the glossary's vocabulary

When a skill output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms. If a concept isn't in the glossary yet, that's a signal — flag it for `/grill-with-docs` rather than inventing language.

## Flag ADR conflicts

If a skill output contradicts an existing ADR, surface it explicitly:

> _Contradicts ADR-XXXX (description) — but worth reopening because…_

## Project glossary (provisional)

While `CONTEXT.md` is empty, the following terms from the consolidated plan are the canonical vocabulary:

- **demo-kit** — shared component library at `site/src/components/demo-kit/`
- **demo** — interactive React island in `site/src/components/demos/{course}/{name}/`
- **course page** — MDX file at `site/src/content/courses/{slug}/index.mdx`
- **featured problem** — typeset KaTeX rendering of a coursework problem with author's solution or reflection
- **favorite page** — single hand-cropped, PII-redacted handwritten thumbnail per course
- **sidecar** — JSON file per OCR'd page at `data/sidecars/{course}/{pdf-stem}/page-N.json`
- **PII block** — the `pii` section of a sidecar (`names_detected`, `akwasi_present`, `needs_redaction_review`)
- **page-hash** — SHA-256 of page-image bytes; the OCR cache key
- **ocr_version** — semver string identifying the OCR prompt + model combination
- **concept tag** — entry in the controlled vocabulary at `site/src/content/concepts/_tags.json`
- **preset** — named entry in a demo's URL-fragment state schema
- **narration template** — the `<DemoNarration>` sentence template emitted to `aria-live`

These terms move into `CONTEXT.md` properly the first time `/grill-with-docs` runs.
