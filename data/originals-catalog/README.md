# `data/originals-catalog/`

Per-course catalogs of the source material in `archive/originals/`. The
PDFs themselves are gitignored per CONTENT-LICENSE.md (instructor-prepared
materials stay local). These catalogs are my own paraphrased summaries of
what's in the body of work — theme inventory, per-PDF descriptions,
featured-problem candidates — and are therefore safe to commit under
CC-BY-NC-SA.

**Purpose:** unblock authorship of course reflection paragraphs and
featured-problem `<FeaturedProblem>` blocks without requiring an interview
for every micro-decision. The catalogs are reference material for me and
for the project author; they don't render anywhere on the public site.

**Authoring discipline:**

- Describe themes and techniques in my own voice.
- Never reproduce a problem statement verbatim.
- Cite filenames so we can re-open the source PDF if needed.
- Flag featured-problem candidates with enough specificity that the
  on-page `<FeaturedProblem>` block can be written without re-reading the
  PDF.

**One file per course slug.** Machine Learning is intentionally excluded
(course had no PDF submissions).

## Catalog status

| Slug | Catalog | Source |
|---|---|---|
| `fourier-transforms` | ✅ committed | ENGS 92 (FA20), 17 PDFs, ~50 KB embedded text |
| `computational-methods` | ✅ committed | MATH 56 (SP20), 9 PDFs, ~12 KB embedded text |
| `solid-mechanics` | ✅ committed | ENGS 33 (FA20), 26 PDFs (many `_REV`), ~87 KB embedded text |
| `distributed-systems` | ✅ committed | ENGS 23 (WI20), 20 PDFs, ~218 KB embedded text |
| `mechatronics` | ✅ committed | ENGS 147 (SP21), 20 PDFs, ~77 KB embedded text |
| `digital-electronics` | ✅ committed | ENGS 31 (SP20), 10 PDFs (1 corrupt), ~111 KB embedded text |
| `embedded-systems` | ✅ committed | ENGS 85 (WI21), 14 PDFs (3 corrupt data dumps), ~16 KB embedded text |
| `discrete-probability` | ✅ committed | ENGS 27 (FA19), 10 PDFs, all scans (themes inferred — vision pass pending) |
| `machine-learning` | n/a | No PDF submissions (Jupyter notebooks live elsewhere) |

The `discrete-probability` catalog explicitly flags that per-PDF theme
attribution is provisional until the v2 OCR batch run (#43) lands JSON
sidecars from the page images.

