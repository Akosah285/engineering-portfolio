# Engineering Portfolio — Implementation Plan (Consolidated)

A public, polished, intensively-interactive portfolio of Akwasi Akosah's Dartmouth
engineering coursework. Framed as **legacy / portfolio of record** (not active job
search), but built to recruiter-grade standards because that's how good portfolios
look. Every course gets a bespoke, multi-demo treatment with featured transcribed
problems and a personal reflection.

> **Note on this document.** This plan consolidates all design decisions across two
> grilling sessions: Session 1 (29 decisions, captured in the prior session's plan.md
> at `639646f5-...\plan.md`) and Session 2 (19 new decisions on cross-cutting
> mechanics, content/curation policy, and OCR fine-print). 48 decisions total.

---

## 1. Problem Statement

Akwasi has 9 courses' worth of engineering submissions sitting in a Downloads folder
(~2 GB total): mostly handwritten math PDFs, some Jupyter notebooks, some VHDL/C/Arduino
source, and ~1.5 GB of robot/embedded demo videos. The raw material is rich but
inert — handwritten scans and code files don't communicate well to anyone (including
his future self).

**Goal:** transform this archive into a public, browsable, intensely interactive
"engineering laboratory" website where each course gets:

- A polished writeup with hero + concepts + reflection
- Multiple bespoke browser demos illustrating the course's actual concepts
- Featured problems transcribed from his handwritten work into typeset KaTeX,
  including some "Featured Reflection" wrong-answers-with-learning entries
- Tech tags + (optional) code & artifact links

Plus: a reusable OCR tool (`ocr-vault`) that turns handwritten PDFs into structured
JSON with LaTeX, kept and re-runnable for future coursework or other projects.

---

## 2. Locked Decisions — Session 1 (Architecture & Per-Course)

### 2.1 Audience & Framing

| # | Decision |
|---|---|
| Q1  | Public, recruiter-quality static site (mechanics) |
| Q10 | Purpose: legacy / portfolio of record (tone). No "Hire me" CTAs. |
| Q5  | Curated artifacts only on the public site. Raw originals never leave local. |

### 2.2 Tech Stack

| Layer | Pick |
|---|---|
| Site framework | **Astro** with **MDX** content, **React** islands for demos |
| Math rendering | **KaTeX** (SSR'd at build — see §7.4) |
| Hosting | **GitHub Pages** (no third-party deps; no PR previews — accepted tradeoff) |
| Public site search | **Pagefind** (build-time index, ~50 KB WASM, fully private) |
| Local archive search | **`ocr-vault search`** CLI hitting SQLite FTS5 |
| Site package manager | **pnpm** |
| Lint + format (site) | **Biome** (single binary, replaces eslint + prettier) |
| OCR tool language | **Python**, run via **`uv`** |
| OCR tool lint + format | **`ruff`** |
| OCR tool type-check | **`mypy --strict`** |
| OCR tool tests | **`pytest`** (mock the LLM calls) |
| Link check (CI) | **`lychee`** |
| Spell check (CI) | **`cspell`** |

### 2.3 OCR Pipeline

| Decision | Value |
|---|---|
| Engine | Multimodal LLM with LaTeX + prose + metadata extraction |
| Primary provider | Anthropic Claude (existing key). Provider-agnostic abstraction. |
| Escape hatches | `--provider gpt-4o`, `--provider gemini-flash` per-page or per-PDF |
| Cache key | SHA-256 of page-image bytes (re-runs are no-ops by default — see §7.16) |
| Storage | JSON sidecars per page (committed) + SQLite index (committed) + page PNGs (only used pages committed) |
| Cost cap | $50/run hard, $10/run soft warn, override via `--max-cost N` and `--warn-cost N` |
| Cost tracking | SQLite table logs every API call (timestamp, model, tokens, cost) |
| Live progress | "Page 12/47 \| this $0.03 \| total $0.41 \| est remaining $1.05" |
| Concurrency | Sequential by default; `--parallel N` opt-in |
| Retries | Exponential backoff on 429; max 3 retries → mark `needs_review` |
| Auto-routing | DOCX → `python-docx`. Typed PDFs → `pdfplumber`. Handwritten PDFs → vision LLM. |

**Sidecar schema (extended for §7.18 PII):**

```json
{
  "source": { "pdf": "...", "page": 3, "page_hash": "sha256:..." },
  "extracted": {
    "blocks": [
      { "type": "problem_statement", "problem_id": "3a", "prose": "...", "latex": "..." },
      { "type": "solution_step",     "problem_id": "3a", "prose": "...", "latex": "..." },
      { "type": "figure",            "caption": "...", "bbox": [0, 0, 0, 0] }
    ],
    "topics": ["fourier-series", "convergence"],
    "confidence": 0.86,
    "needs_review": false
  },
  "pii": {
    "names_detected": ["John Smith"],
    "akwasi_present": true,
    "needs_redaction_review": true
  },
  "model": { "provider": "anthropic", "model_id": "...", "ocr_version": "1.0.0" }
}
```

**CLI surface:**

```
ocr-vault add <pdf-path> --course "<name>"
ocr-vault status [--confidence-distribution]
ocr-vault search "<query>"
ocr-vault list-problems --course <slug>
ocr-vault list-pii --course <slug>
ocr-vault list-candidates --course <slug>
ocr-vault retry --provider <p> <page-hash>
ocr-vault crop --page-hash <hash> --bbox x,y,w,h
ocr-vault re-ocr [--course <slug>] [--low-confidence] [--needs-review] [--from-version X] [--page-hash <hash>] [--featured-only] [--all] [--keep-history] [--apply] [--confirm]
ocr-vault export --course <slug> --format mdx
```

### 2.4 Repo Layout

```
engineering-portfolio/
  archive/originals/                        # .gitignored, PDFs copied here
  data/
    sidecars/{course-slug}/{pdf-stem}/page-N.json   # committed
    page-images/{course-slug}/...           # committed only for site-used pages
    index.sqlite                            # committed
    ocr-config.json                         # committed; per-course thresholds (§7.17)
  tools/ocr-vault/                          # Python CLI (uv + pyproject.toml)
    src/ocr_vault/...
    tests/...
  site/                                     # Astro app
    src/pages/                              # routes
    src/content/courses/{slug}/index.mdx    # per-course writeups
    src/content/concepts/{tag}.mdx          # optional concept reflections (§7.13)
    src/content/concepts/_tags.json         # master tag vocabulary
    src/content/_courses.json               # slug → display name + order (§7.10, §7.11)
    src/components/                         # shared UI
    src/components/demo-kit/                # ★ shared demo primitives
    src/components/demos/{course-slug}/     # bespoke per-course demos
    public/videos/{course-slug}/            # compressed video reels
    public/about/                           # photo, etc.
  .github/workflows/deploy.yml              # build → deploy GH Pages
  LICENSE                                   # MIT (§7.9)
  CONTENT-LICENSE.md                        # CC-BY-NC-SA 4.0 reference (§7.9)
  README.md
  .gitignore
```

**Originals:** copied (not symlinked) into `archive/originals/`. Done once via `robocopy`.

### 2.5 Identity

- **Name (display):** Akwasi Akosah
- **School:** Dartmouth College, BA '21, TH '21
- **Repo:** `engineering-portfolio` → `github.com/akwasiakosah/engineering-portfolio`
- **Visibility:** Public from day 1 (v0 ships with a "built in public" landing)
- **Custom domain:** None for v1. Default URL `akwasiakosah.github.io/engineering-portfolio/`.
- **Contact:** LinkedIn + GitHub URLs on About page. No raw email.

### 2.6 Visual Identity (Dartmouth Theme)

**Typography:**
- UI / headings: Inter (variable, free)
- Body prose: Source Serif Pro (variable, free)
- Code: JetBrains Mono (variable, ligatures, free)

**Color palette:**

```
Light mode                           Dark mode
  bg:        #fcfaf6 (warm paper)      bg:        #0e0e0e
  surface:   #ffffff                   surface:   #1a1a1a
  text:      #1a1a1a / #525252 / #737373   text:  #fafaf9 / #a3a3a3 / #737373
  accent:    #00693e (Dartmouth Pine)  accent:    #3fb487 (lifted Pine)
  math-bg:   #f8f5ee                   math-bg:   #1f1f1f
  code-bg:   #f3f1ec                   code-bg:   #161616
```

**Other:**
- Wordmark: name as wordmark + "engineering portfolio" descriptor
- Hero: pure typography (large serif headline + sans subhead) + 9 course cards in 3×3 grid
- Navigation: top bar (wordmark left, Courses · About · Search right; hamburger on mobile)
- Per-course breadcrumb (Home / Courses / [Course Name])
- Demo container: bordered Pine-tinted card, ~12px radius, "Try it" badge, collapsed "About this demo" details below
- Code theme: Catppuccin Latte / Mocha
- Math: subtle warm background on display blocks, auto equation numbers right
- Icons: Lucide, used sparingly

### 2.7 Page Contract (every course page)

**Required sections:**
1. Hero header — course name, term, one-line "what I took away"
2. Concepts learned — 3–5 bullets, **tagged from controlled vocabulary** (§7.13)
3. Hero demo / video reel — the headline interactive
4. Featured problem(s) — 2–4 per course, typeset-only, KaTeX, **paraphrased + attributed** (§7.9)
   - Labeled either "Featured Solution" or "Featured Reflection"
   - No ratio cap between flavors
   - Hard rule: Solutions only feature problems Akwasi can currently explain unprompted
   - ONE "favorite page" handwritten thumbnail per course (§7.19)
5. Tech & tools — tag row
6. Reflection — 100–200 word interview-sourced paragraph

**Optional sections:**
- Code & artifacts (links to in-repo source or gists)
- Curated archive grid (selected page screenshots)
- Course metadata

### 2.8 Reflection Sourcing

Interview-driven (per course), 5 questions, drafted to 100–150 words, user-edited.
~20 min/course = ~3 hr total across the build.

### 2.9 About-Page Composition (extended in §7.15)

```
[Top]      Photo (~120-200px square) + 3-line bio
[Letter]   ~150-250 words: meta-foreword, why this site exists
[Journey]  ~600-1000 words: autobiographical engineering arc
[Closing]  LinkedIn · GitHub · "Built with Astro, Claude, and a lot of old PDFs"
```

(Q&A section deliberately omitted — too performance-y for the legacy framing.)

### 2.10 Featured-Problem Curation Workflow

For each course:
1. `ocr-vault list-problems --course X` surfaces all detected problems
2. Akwasi shortlists 5–8 candidates he remembers well
3. In the per-course interview, Akwasi explains each candidate's solution unprompted.
   Stumbles → out. Nails it → candidate.
4. Final 2–4 chosen by elegance + representativeness + personal meaning
5. Display: typeset only (no side-by-side scans) + ONE "favorite page" thumbnail (§7.19)
6. NEVER feature a problem with a wrong answer as a "Featured Solution".
   Wrong-answers belong in "Featured Reflection" with explicit labeling.
7. **Paraphrase in Akwasi's voice + attribution** per §7.9; verbatim only when mathematically essential, italicized + attributed.

### 2.11 Demo Policy

**Intensive and comprehensive.** No artificial cap. Every concept with a natural
interactive/visual representation gets its own demo. Anti-padding rule: each demo must
have a distinct pedagogical point.

**Per-course locked lineups (78 demos + 2 video reels):** see §4 below.

### 2.12 Build Order

| Phase | Goal |
|---|---|
| **v0** | Site spine — repo, Astro, GH Pages deploy, landing + About page (interview-sourced), demo-kit foundation primitives, OG card automation, controlled-vocab seed |
| **v1** | ML & Stats course (no OCR needed; validates site/page/demo pipeline) |
| **v2** | `ocr-vault` tool + run over all 9 courses |
| **v3** | Fourier Transforms course (validates curation flow on hardest content) |
| **v4–v9** | Remaining 7 courses, easier-first: Discrete & Prob → Comp Methods → Solid Mechanics → Distributed Sys & Fields → Mechatronics → Digital Electronics → Embedded |
| **v∞** | Deferred-by-policy items: `/archive/` route, `/favorites/` gallery, custom domain, per-course visual accent tweaks |

### 2.13 CI/CD

**v0 pipeline:** type-check (`astro check`) + Biome + build + Pagefind index + lychee + cspell + deploy on main.
**v1+:** add Vitest for demo logic.
**v3+:** add Playwright (E2E) and `pa11y` (a11y). Lighthouse CI added as warn (§7.7).
**v6+:** Lighthouse CI gates as fail (§7.7).
**Deferred indefinitely:** visual regression screenshots.

PRs run all checks, never deploy. Main triggers deploy. `workflow_dispatch` enabled
for manual re-deploys. Cache pnpm store + Astro build cache.

---

## 3. Cross-Cutting Workstreams

### 3.1 Shared Demo Component Library (`site/src/components/demo-kit/`)

Built incrementally as ML demos demand them in v1, then leveraged by every subsequent
course.

**Locked demo-kit primitives** (Sessions 1 + 2):

- `<DemoChrome>` — bordered card, title, "Try it" badge, collapsed "About this demo", auto Share button (§7.4) + GitHub-source link (§7.8)
- `<DemoCanvas>` — sized canvas with `requestAnimationFrame` lifecycle; reserves explicit `width`/`height` for CLS budget
- `<SliderRow>` — labeled native `<input type="range">` + value display + min/max ticks
- `<MathExpression>` — KaTeX wrapper for inline + block math; SSR'd at build (§7.7); emits hidden raw-LaTeX for Pagefind (§7.12)
- `<PlotPanel>` — axis-aware 2D plot with grid, gridlines, optional log-scale
- `<TimeSeriesPlot>` — specialized time-series with sliding window
- `<VectorFieldPlot>` — arrow grid for E-field / B-field / generic 2D vector field
- `<ColorBar>` — heatmap legend
- `<CodeReveal>` — Shiki-tokenized source toggle, per-demo opt-in (§7.8)
- `<MathHud>` — overlay current parameters as LaTeX in corner of demo
- **`<DemoNarration>`** *(§7.6)* — `aria-live="polite"` transcript-text region; takes the same state object that drives the canvas, returns a sentence template that updates on state change
- **`<PresetCarousel>`** *(§7.5)* — preset-state chip selector; serves as desktop preset-selector AND mobile-fallback for canvas-drag demos
- **`<ShareButton>`** *(§7.4)* — auto-rendered in `<DemoChrome>` when `useDemoState({ shareable: true })`
- **`<DemoNoScriptFallback>`** *(§7.10)* — `<noscript>` block using narration text
- **`<FavoritePage>`** *(§7.19)* — wraps `astro:assets` with lightbox + LQIP + caption
- **`<HeadMeta>`** *(§7.11)* — shared head component for `<title>`, description, OG, Twitter, canonical, RSS (none — §7.14)

### 3.2 Video Reel Curation (Mechatronics + Embedded)

- Deduplicate raw `.mov`/`.mp4` files (drop `-1` suffixed dupes after picking best take)
- Compress with `ffmpeg` to ~5–15 MB each, MP4 H.264, max 720p
- Generate poster frames
- Add chapter markers / annotations explaining engineering context
- Total budget: ~80–120 MB across both courses (within GH Pages 1 GB limit)

### 3.3 OCR Cost & Quality Audit

- After v2 (initial OCR pass), generate per-course quality report:
  - Pages with `confidence < threshold` (per-course threshold from `ocr-config.json`, §7.17) → flagged for `--provider gpt-4o` retry via `re-ocr --low-confidence` (§7.16)
  - Pages with `needs_review: true` → manual review queue
  - Pages with `pii.needs_redaction_review: true` → PII review queue (§7.18)
  - Total spend per course
- Re-OCR strategically: featured-problem source pages first (§7.16 `--featured-only`), then bulk later

### 3.4 Privacy / PII (§7.18)

- Names of group members in original PDFs: **public-facing redaction by default**, opt-in credit on a per-teammate basis with Akwasi's explicit decision
- PII auto-detected during OCR, surfaced via `ocr-vault list-pii --course <slug>`
- Instructor names: omit from course metadata unless Akwasi opts in per-course
- Akwasi's name: appears as wordmark + About page; intentional
- TA names: same default as group members (redact)

---

## 4. Per-Course Demo Lineups (Detail)

Each demo in this section becomes its own todo when implementation begins.

### 4.1 Machine Learning & Statistical Data Analysis (SP20) — v1

| # | Demo | Source in coursework |
|---|---|---|
| 1 | **Gradient Descent Visualizer** *(hero)* | HW1 — autograd, manual GD, learning rate exploration |
| 2 | Polynomial Regression w/ Regularization | HW2 — Ridge / Lasso / "Best Model" |
| 3 | K-Means Image Compression | Final Q2 — "Living within your means" |

### 4.2 Fourier Transforms & Complex Variables (FA20) — v3

| # | Demo |
|---|---|
| 1 | **Epicycle Drawing Animation** *(hero)* |
| 2 | Fourier Series Builder |
| 3 | FT of Common Signals |
| 4 | Convolution Animation |
| 5 | Audio Filtering Demo |
| 6 | Complex Domain Coloring |
| 7 | Conformal Mapping |
| 8 | Residue Theorem Helper |

### 4.3 Discrete & Probabilistic Systems (FA19) — v4

| # | Demo |
|---|---|
| 1 | **Markov Chain Visualizer** *(hero)* |
| 2 | Gambler's Ruin / Coin-flip Monte Carlo |
| 3 | Bayes' Theorem Interactive |
| 4 | Central Limit Theorem Demonstrator |
| 5 | Birthday Paradox Simulator |
| 6 | Erdős-Rényi Random Graph |
| 7 | Hypothesis Testing Visualizer |
| 8 | Combinations & Permutations Calculator |
| 9 | Monte Carlo π Estimator (probability framing) |
| 10 | PageRank Toy |

### 4.4 Computational Methods (SP20) — v5

| # | Demo |
|---|---|
| 1 | **Runge-Kutta ODE Solver (Lorenz default)** *(hero)* |
| 2 | Newton's Method Visualizer |
| 3 | Bisection Method Visualizer |
| 4 | Numerical Integration Comparator |
| 5 | Gaussian Elimination Step-by-Step |
| 6 | LU Decomposition |
| 7 | Lagrange vs Cubic Spline Interpolation |
| 8 | Monte Carlo Integration (numerical-methods framing) |
| 9 | Least Squares Curve Fitting |
| 10 | Eigenvalue Power Iteration |
| 11 | Discrete Fourier Transform (numerical view) |

### 4.5 Solid Mechanics (FA20) — v6

| # | Demo |
|---|---|
| 1 | **Interactive Truss Analyzer** *(hero)* |
| 2 | Beam Deflection Calculator |
| 3 | Mohr's Circle |
| 4 | Stress-Strain Curve Plotter |
| 5 | Euler Buckling Calculator |
| 6 | Torsion of Shafts |
| 7 | Failure Criteria Explorer |
| 8 | Bending Stress Distribution |
| 9 | 3D Stress State Visualizer |
| 10 | Shear & Moment Diagrams |

### 4.6 Distributed Systems & Fields (WI20) — v7

| # | Demo |
|---|---|
| 1 | **Charge Field Plotter** *(hero)* |
| 2 | Wave Equation Simulator (1D string) |
| 3 | Heat Equation Simulator (1D rod) |
| 4 | Laplace in a Rectangle |
| 5 | Vector Field Visualizer |
| 6 | RC/RL Step Response |
| 7 | Biot-Savart B-Field from Current Loops |
| 8 | 2D Wave Interference |
| 9 | Faraday's Law / Induced EMF |

### 4.7 Mechatronics (SP21) — v8

| # | Demo |
|---|---|
| ★ | **Video Reel** *(hero)* — drive_straight, turn_an_angle, wall_follow, maze_navigation, position_low_level |
| 1 | PID Step Response Simulator *(co-hero, interactive)* |
| 2 | DC Motor Model |
| 3 | Maze Pathfinding Visualizer |
| 4 | Sensor Fusion (Encoder + IMU) |
| 5 | 2-Link Inverse Kinematics |
| 6 | Bode Plot Builder |
| 7 | State Machine Visualizer (decision_making.ino) |
| 8 | Step Position Control |

### 4.8 Digital Electronics (SP20) — v9

| # | Demo |
|---|---|
| 1 | **FSM Simulator (Stopwatch preset)** *(hero)* |
| 2 | Logic Gate Truth Table Builder |
| 3 | Karnaugh Map Minimizer |
| 4 | VHDL → Animated Waveform (GHDL pre-compiled) |
| 5 | Counter Simulator |
| 6 | ALU Bit-Slice Explorer |
| 7 | Latch vs Flip-Flop |
| 8 | Datapath Visualizer (lab4_datapath.vhd) |
| 9 | Stopwatch FSM Animation (Lab 3 specific) |

### 4.9 Embedded Systems (WI21) — v10

| # | Demo |
|---|---|
| ★ | **Video Reel** *(hero)* — Solar Tracker, Traffic Crossing (3 modes), RPM Display, accelerometer |
| 1 | Traffic Light FSM Animation (AIO_MQTT_traffic_control) |
| 2 | Solar Tracker Logic Simulator |
| 3 | ADC Sampling / Aliasing Visualizer |
| 4 | I²C Protocol Visualizer |
| 5 | PWM Visualizer |
| 6 | Accelerometer Live Demo (uses visitor's phone DeviceMotion API; iOS gesture-unlock per §7.10) |
| 7 | Seven-Segment Display Decoder |
| 8 | Interrupt vs Polling Animation |
| 9 | RPM Measurement Visualizer |
| 10 | MQTT IoT Message Flow |

---

## 5. Notes & Considerations (Session 1)

### 5.1 Honest Scope

- ~80 demos × 3–8 hours each = a **multi-month build**, even with reused components
- ~25–30 featured problems require curation + transcription review
- 9 reflection interviews × ~20 min = ~3 hours of Akwasi's time
- 1 About-page interview × ~30 min (13 questions, §7.15)
- OCR pipeline runs once, ~30–60 min wall-clock for all 9 courses
- API cost: estimated ~$15–30 one-time

### 5.2 Risk Mitigation

- Shared component library dramatically reduces marginal cost per demo after v1
- Build order ships something usable at v0 (landing + About) — recruiters/visitors can find the site immediately even before any course is done
- Pagefind at v0 means search works as soon as content lands
- Per-course honest scoping within the demo lineup — if a particular demo turns out too ambitious during v4+, defer it explicitly rather than shipping broken

### 5.3 Quality Bars

- Featured Solutions: Akwasi must be able to explain the solution unprompted today
- Demos: must work on mobile + desktop, light + dark mode, no horizontal scroll (mobile policy refined in §7.5)
- Math: KaTeX-rendered, no images of equations
- Performance budget per page: see §7.7
- Accessibility: keyboard navigable, screen-reader labels on all interactive controls — see §7.6 for the canvas-demo `<DemoNarration>` pattern

### 5.4 Open Questions Resolved in Session 2

| Originally | Resolution |
|---|---|
| "Per-course visual identity tweaks" | Deferred to v∞ — accent variations only if compelling per-course |
| "Whether to expose OCR sidecars via `/archive/` route" | **Deferred to v∞** with explicit re-trigger conditions (§7.20) |
| "Domain purchase" | Deferred indefinitely; can swap in later without breaking GH Pages |
| "Group-member privacy" | **Resolved** — public-facing redaction default + opt-in credit (§7.18) |

### 5.5 Tools to Acquire Before Starting

- `uv` (Python tool runner): `pip install uv`
- `pnpm`: `npm install -g pnpm` (or via corepack)
- `ffmpeg` (for video compression): platform-specific
- `ghdl` (for VHDL waveform pre-computation, v9 only): can defer install
- `astro-og-canvas` (npm; for OG card automation, §7.11)
- Existing: Anthropic API key (confirmed)

---

## 6. Locked Decisions Summary — Session 2 at a Glance

| # | Bucket | Topic | Decision |
|---|---|---|---|
| A1 | Site mechanics | Demo state | URL fragment, default-on, opt-out per demo |
| A2 | Site mechanics | Mobile UX | Hybrid: native controls everywhere + `<PresetCarousel>` mobile fallback for canvas-drag; per-demo opt-in for first-class touch on ~3–5 hero/manipulation demos |
| A3 | Site mechanics | A11y for canvas | AA + `<DemoNarration>` transcript-text pattern |
| A4 | Site mechanics | Perf + hydration | `client:idle` hero, `client:visible` below-fold, KaTeX SSR, React 19, perf budgets, Lighthouse CI (warn v3 → fail v6) |
| A5 | Site mechanics | Browsers + iOS + no-JS | Latest 2 mainstream + iOS DeviceMotion gesture-unlock with slider fallback + no-JS readability + no polyfills |
| A6 | Site mechanics | `<CodeReveal>` | Per-demo opt-in with split defaults (algorithm-centric ON, viz-centric OFF) + always-show GitHub link |
| B1 | Content/policy | Licensing | MIT (code) + CC-BY-NC-SA 4.0 (content) + paraphrase + attribution + redaction |
| B2 | Content/policy | Slugs + URLs | Medium 2-3 word slugs + `/courses/{slug}/` + trailing slash |
| B3 | Content/policy | Landing grid | Curated default order + greyed Coming Soon (no click) + 30-day New pill + typography-only cards |
| B4 | Content/policy | OG cards | Hybrid: bespoke landing + About; templated course OGs via `astro-og-canvas`; demo pages inherit course OG |
| B5 | Content/policy | Search scope | LaTeX-source indexing + code-reveal at weight 0.3 + demo-narration indexed + filters (course, type) + 3 UI surfaces (Cmd-K + nav button + `/search/`) |
| B6 | Content/policy | Concepts | Controlled vocabulary + auto-generated `/concepts/{tag}/` pages, Zod-validated, max 5 tags per course |
| B7 | Content/policy | Publishing posture | No RSS, No comments, No analytics — true legacy artifact |
| B8 | Content/policy | About interview | 13 questions in 3 sections, 4-component structure, locked as v0 todo contract |
| C1 | OCR fine-print | Re-OCR policy | Explicit `re-ocr` command + overwrite-by-default + `--keep-history` opt-in + dry-run-by-default + `--apply` + `--confirm` for >$5 |
| C2 | OCR fine-print | Confidence threshold | Tunable per-command + persisted per-course in `data/ocr-config.json` + status histograms |
| C3 | OCR fine-print | `/archive/` route | **Deferred to v∞** — revisit post-v10 or per specific request |
| C4 | OCR fine-print | Group-member privacy | Public-facing redaction default + opt-in credit + PII auto-detection in OCR (`pii` block in sidecar) |
| C5 | OCR fine-print | Favorite-page thumbnail | Hand-cropped + ~600×800 display + 400 DPI source + lazy + LQIP + lightbox + auto-rotation + PII overlay |

---

## 7. Mechanics & Conventions — Session 2 Detail

### 7.1 Demo State Lives in URL Fragment (A1)

Every interactive demo serializes share-relevant state to the URL hash via a single
`useDemoState<T>(schema, defaults, opts?)` hook in `demo-kit/`.

- Default: `shareable: true`. Opt-out per demo via `useDemoState(..., { shareable: false })`
- Hash format: `#demo=lorenz&sigma=10&beta=2.667&rho=28&seed=42`
- `<ShareButton>` automatically rendered by `<DemoChrome>` when shareable
- "Reset to defaults" button = clear the fragment
- Featured-problem pages can deep-link demo configurations
- Each demo defines a small URL param schema (~30 lines) — Zod or hand-rolled

### 7.2 Mobile UX Policy (A2)

- Detection: `@media (pointer: coarse)` — never UA / viewport width
- Default: native HTML controls (`<input type="range">`, buttons) for all demos — work on touch for free
- Canvas-drag demos: ship a `<PresetCarousel>` fallback on touch devices (hide drag handles, show preset chips with ◀ Prev / Next ▶)
- Same `<PresetCarousel>` doubles as desktop UX win (sighted user can hit a preset before figuring out what to drag)
- Per-demo opt-in for first-class touch on ~3–5 demos: hero demos + demos whose sole pedagogical point is direct manipulation (Truss Analyzer, FSM Simulator)
- Authoring complex new structures from scratch is desktop-only; that's an acknowledged tradeoff
- Every demo's TODO grows a "define 3–6 named presets" sub-task (~30 min)

### 7.3 Accessibility — `<DemoNarration>` Transcript Pattern (A3)

- WCAG 2.2 AA on chrome (controls, descriptions, labels)
- `<DemoNarration>` primitive: `aria-live="polite"` region; takes same state object as canvas, emits sentence-template that updates with state
- Screen-reader users get the *meaning* of every demo even if not the picture
- Pure-spectacle demos (e.g., epicycle animation) get `aria-label` only — accepted
- Narration template doubles as Pagefind index entry (§7.12) and `<noscript>` fallback (§7.10)
- pa11y in CI catches HTML/ARIA failures from v3+
- Each demo's TODO grows a "write narration template" sub-task (~10–15 min)

### 7.4 KaTeX Strategy + Hydration Strategy (A4)

- KaTeX: **SSR at build time** — zero KaTeX JS shipped to browser. Single biggest perf win.
- Hero demo: `client:idle` — page is interactive instantly, demo mounts ~within idle frame
- Below-fold demos: `client:visible` — only mount on scroll into viewport
- Framework: React 19 via `@astrojs/react` (Preact rejected — compat risk too high for ~50-demo build)

### 7.5 Performance Budgets (A4)

| Metric | Budget |
|---|---|
| LCP (course pages) | < 1.5s simulated 4G mobile |
| LCP (landing) | < 1.2s |
| INP | < 100ms |
| CLS | < 0.05 (canvas height reserved; KaTeX SSR avoids math reflow) |
| Per-page JS (excl. hero demo) | < 250 KB transferred |
| Per-demo JS | < 80 KB gzipped |
| Lighthouse mobile score | ≥ 95 |
| Lighthouse desktop score | ≥ 98 |
| Lighthouse CI | Warn from v3, fail from v6 |

### 7.6 Browser Support Matrix (A5)

- Desktop: latest 2 versions of Chrome, Firefox, Safari, Edge
- Mobile: latest 1 version of Chrome (Android) + Safari (iOS)
- Out: IE11, legacy Edge, Opera Mini, anything pre-2023
- Browserslist string: `last 2 chrome versions, last 2 firefox versions, last 2 safari versions, last 2 edge versions, last 1 ios version, last 1 android version`
- No polyfills — all targets support ES2022, Web Audio, Canvas, RAF, IntersectionObserver, View Transitions

### 7.7 iOS DeviceMotion + Audio Gesture Unlock (A5)

- iOS 13+: `DeviceMotionEvent.requestPermission()` from a tap
- UX: "Tap to enable motion" button → native iOS prompt → live tilt OR fallback to manual sliders simulating pitch/roll
- Non-iOS / non-mobile: skip permission; if events fire use them, else show sliders
- Web Audio (audio filtering demo): same gesture-unlock pattern via `AudioContext.resume()`
- Util in `demo-kit/audio.ts`

### 7.8 No-JS Posture (A5)

- Astro SSR ⇒ course pages fully readable without JS (text, KaTeX, featured problems, code blocks, images)
- Demos render `<DemoNoScriptFallback>`: "Enable JavaScript to interact. Description: <narration text from §7.6>"
- OCR'd archive becomes JS-apocalypse-proof knowledge artifact

### 7.9 `<CodeReveal>` Convention (A6)

- Per-demo opt-in (default split: algorithm-centric ON, visualization-centric OFF)
- "The source" = algorithmically-meaningful function only, not React rendering layer
- Pattern: each opt-in demo extracts core algorithm to sibling `algorithm.ts`; React component imports both the function (run) and `algorithm.ts?raw` (display) — one source of truth
- Shiki tokenizes at build (already in MDX stack); zero runtime JS for highlighting
- Default state: collapsed
- "View on GitHub" link **always present** on every demo regardless of opt-in (handled by `<DemoChrome>` via shared `repoBaseUrl` config)
- Default-ON list (heuristic, confirmed at per-demo TODO): most of Comp Methods, ML, Discrete & Prob, audio filtering, FSM transition functions
- Default-OFF list: Truss, Charge Field, Vector Field, Mohr's Circle, Beam Deflection, 3D Stress, Wave/Heat rendering, Domain Coloring, Conformal Mapping
- Demo file structure: `demos/{course}/{name}/{ ComponentName.tsx, algorithm.ts, presets.ts }`

### 7.10 Licensing (B1)

- **Code:** MIT — `LICENSE` at repo root
- **Content:** CC-BY-NC-SA 4.0 — `CONTENT-LICENSE.md` at repo root
- **Featured problems:** paraphrased in Akwasi's voice with *"Adapted from Dartmouth ENGS XX, [term]"* attribution. Verbatim only when mathematically essential, italicized + attributed.
- **No instructor materials republished** — exam PDFs, lecture slides, original problem sets stay local in `archive/originals/` (gitignored)
- **Favorite-page thumbnails:** redacted per §7.18
- **Footer text:** *"Code MIT · Content CC-BY-NC-SA 4.0 · Featured problems adapted from Dartmouth coursework"*
- **README** has a clear "What's licensed how" table

### 7.11 Course Slugs + URL Structure (B2)

| Course | Slug |
|---|---|
| Machine Learning & Statistical Data Analysis | `machine-learning` |
| Fourier Transforms & Complex Variables | `fourier-transforms` |
| Discrete & Probabilistic Systems | `discrete-probability` |
| Computational Methods | `computational-methods` |
| Solid Mechanics | `solid-mechanics` |
| Distributed Systems & Fields | `distributed-systems` |
| Mechatronics | `mechatronics` |
| Digital Electronics | `digital-electronics` |
| Embedded Systems | `embedded-systems` |

- URL pattern: `/courses/{slug}/` with **trailing slash**
- Slug → display name mapping: `site/src/content/_courses.json` (single source of truth used by sitemap, OG cards, search index, breadcrumbs)
- Slugs are part of the public contract — once shipped, never rename without 301 redirect

### 7.12 Landing Grid Order + Coming Soon (B3)

**Default curated order (Akwasi tweaks during v0):**

| Slot | Course |
|---|---|
| 1 | Mechatronics |
| 2 | Embedded Systems |
| 3 | Computational Methods |
| 4 | Machine Learning |
| 5 | Fourier Transforms |
| 6 | Discrete & Probabilistic |
| 7 | Solid Mechanics |
| 8 | Distributed Systems & Fields |
| 9 | Digital Electronics |

- Order field in `_courses.json` (`displayOrder: 1..9`)
- Coming-soon cards: greyed, hover/long-press shows one-sentence preview ("Coming soon: Truss Analyzer + 9 more interactive demos"), **no click**
- "New" pill for 30 days post-publish, computed from `publishedAt` frontmatter at build
- Cards: typography-only for v0 (no per-course icons / illustrations)

### 7.13 OG / Twitter Cards (B4)

- **Hand-curated:** landing, About — designed once
- **Templated via `astro-og-canvas`:** course pages — 1200×630 PNG
- Course OG layout:
  - Background: course-accent-tinted bg
  - Top-left: small wordmark "Akwasi Akosah · engineering portfolio"
  - Center-left: large serif course title + term
  - Center-right: hero-demo silhouette (SVG, designed per course)
  - Bottom: "Engineering portfolio · Dartmouth"
- Demo deep-links: inherit parent course's OG (no per-demo PNGs)
- Meta tags: `<HeadMeta>` Astro component sets `og:image`, `og:image:width=1200`, `og:image:height=630`, `twitter:card="summary_large_image"`, `og:type` (`website` for landing/About, `article` for course pages), `<title>`, description, canonical URL
- Each course's TODO grows: "design hero-demo silhouette SVG" (~30 min)

### 7.14 Pagefind Search Scope (B5)

**5-part config:**

1. **KaTeX:** `<MathExpression>` always emits visible KaTeX + hidden `data-pagefind-body` raw-LaTeX span; visible KaTeX span tree is `data-pagefind-ignore`d
2. **`<CodeReveal>`:** indexed at `data-pagefind-weight="0.3"`
3. **"About this demo":** indexed at full weight
4. **`<DemoNarration>` template:** indexed (build-time default state values)
5. **Filter facets:** `course` (slug values) and `type` (`course-page`, `demo`, `featured-problem`, `reflection`, `about`, `concept`)

**Three UI surfaces:**

- **Cmd-K modal** (vim-style; standard for modern docs)
- **Top-nav search button** (always visible; opens the modal)
- **`/search/` page** (direct-link + SEO; standard Pagefind UI)

### 7.15 Concepts Controlled Vocabulary (B6)

- Master list in `site/src/content/concepts/_tags.json` (~20–30 tags at v0, grows per course)
- Astro Content Collection schema: `concepts: Tag[]` with Zod validation against master list
- Cap: 5 tags per course's "Concepts learned" section
- Granularity rule: tag = noun, named theorem/algorithm OR appears in 2+ courses OR substantial pedagogical chunk. So: `monte-carlo` ✅, `rk4-integration` ✅. Not: `calculus` (too broad), `chain-rule` (too narrow).
- Flat lowercase kebab-case, no namespacing (URL: `/concepts/monte-carlo/` not `/concepts/numerical/monte-carlo/`)
- Auto-generated `/concepts/{tag}/` pages list every demo / featured problem / reflection touching that tag, with optional Akwasi-authored definition + reflection (in `src/content/concepts/{tag}.mdx`)
- Concept pages: indexed by Pagefind, included in sitemap
- Demos and featured problems can also opt-in to tags individually for granularity
- Discipline reminder: keep master list clean; avoid 200-tag sprawl

### 7.16 Publishing Posture (B7)

- **No RSS feed**
- **No comments**
- **No analytics** (no GoatCounter, no GA, no Plausible, nothing)
- True legacy artifact — site exists; no observation, no discussion infrastructure, no publishing apparatus
- Footer / About make no mention of these absences

### 7.17 About-Page Interview Structure (B8)

13 questions, ~30 min total. Locked as the v0 About-page TODO contract.

**3-line bio (3 Qs):**
1. In one sentence, who are you professionally / what do you do today?
2. In one sentence, what's your engineering background?
3. In one sentence, what's one other true thing about you?

**Letter — meta-foreword (3 Qs):**
1. Why does this site exist? What prompted you to build it now?
2. What do you hope someone gets from spending 10 minutes here?
3. What did you *not* want this site to be?

**Journey — autobiographical arc (7 Qs):**
1. What got you interested in engineering originally?
2. What was the moment you knew you'd actually do it as a career?
3. What were the high points of Dartmouth — academic, social, project-wise?
4. What were the low points or near-misses?
5. What did you do post-Dartmouth that's relevant to this site?
6. What do you want to do with engineering next, if anything?
7. What's a personal thing that shapes how you think about engineering?

- Photo: square crop, 120–200px display; legacy framing means it doesn't need to be a corporate headshot. Path: `site/public/about/akwasi.{jpg|png|webp}`. `astro:assets` generates AVIF + WebP variants.
- Page structure: 4 distinct components — `<Bio>`, `<Letter>`, `<Journey>`, `<Closing>` — each individually editable

### 7.18 Re-OCR Command Surface (C1)

```bash
ocr-vault re-ocr --course <slug>
ocr-vault re-ocr --low-confidence
ocr-vault re-ocr --needs-review
ocr-vault re-ocr --from-version 0.x
ocr-vault re-ocr --page-hash <hash>
ocr-vault re-ocr --featured-only
ocr-vault re-ocr --all                     # requires --confirm
ocr-vault re-ocr --course X --keep-history # preserve old sidecars
```

- `ocr-vault add` is **idempotent** — same input → same output, no surprise costs
- All `re-ocr` invocations: dry-run by default, require `--apply` to execute, `--confirm` for >$5
- Honor `--max-cost` and `--warn-cost` from `add`
- Show before/after diff on a sample page so user can sanity-check the new prompt
- Default: overwrite. `--keep-history` preserves old sidecars as `page-{N}.v{ocr_version}.json`
- SQLite cost table tags `re-ocr` invocations separately so per-course spend audit survives re-runs

### 7.19 Confidence Threshold (C2)

- Default: 0.7 globally
- Tunable per-command: `--low-confidence-threshold 0.6`
- Persisted per-course in `data/ocr-config.json`:
  ```json
  {
    "global": { "low_confidence_threshold": 0.7 },
    "per_course": {
      "discrete-probability": { "low_confidence_threshold": 0.6 },
      "fourier-transforms":   { "low_confidence_threshold": 0.65 }
    }
  }
  ```
- `ocr-vault status` prints per-course distribution + threshold + sparkline histogram
- Featured-problem source pages get **manual review regardless of confidence**

### 7.20 `/archive/` Route — Deferred to v∞ (C3)

- No `/archive/` route in v0–v10
- Sidecars + page images committed per existing layout
- Re-decide post-v10 OR when a specific use case emerges (instructor/Dartmouth advisor request, citation request, "show me everything" ask from a friend or recruiter)
- Until then, no further architectural work needed for `/archive/` (it's a routing+UI question; data is already in place)

### 7.21 Group-Member Privacy (C4)

- Default: **public-facing redaction** (thumbnails, visible text)
  - Thumbnails: black-bar overlay on detected name regions
  - Visible text: `[teammate]` or `[group member]` substitution
  - Course writeup default: *"I worked with two others on this project"*
- Sidecars retain names (internal data, consistent with §7.20)
- **Opt-in attribution:** Akwasi can name a teammate per editorial decision, especially when relationship + reachability + likely consent align
- PII auto-detected during OCR (`pii.names_detected`, `pii.akwasi_present`, `pii.needs_redaction_review` in sidecar)
- `ocr-vault list-pii --course <slug>` surfaces names + pages for review
- Per-course workflow: PII review step before any thumbnail or featured-problem from that course goes live (~10 min per course)
- Akwasi's name whitelisted (it's the wordmark)
- Instructor names: omit unless Akwasi opts in per-course
- TA names: same default as group members (redact)
- README "Privacy" section briefly explains the policy

### 7.22 Favorite-Page Thumbnail (C5)

| Aspect | Pick |
|---|---|
| Cropping | Hand-cropped per page to a meaningful region; never full-page |
| Display max | ~600×800px (served as ~800×1066 source for retina via responsive `srcset`) |
| Source | PDF re-rendered at 400 DPI for thumbnails (OCR uses 300 DPI), cropped from that |
| Master format | PNG (lossless); `astro:assets` generates AVIF + WebP responsive variants |
| Loading | `loading="lazy"` + LQIP placeholder via `astro:assets` |
| Click | Lightbox modal (full-resolution; dismiss on Esc / click-outside / mobile swipe-down); no new tab |
| Rotation | Auto-detected during OCR (or hand-corrected); always served right-side-up |
| PII | Black-bar overlay on detected names per §7.18 |
| Caption | Short ~20-word italic caption under thumbnail |
| File path | `data/page-images/{course-slug}/{pdf-stem}/page-{N}-favorite.png` |
| Component | `<FavoritePage src="..." caption="..." />` in demo-kit |
| Curation flow | `list-candidates` → pick → `ocr-vault crop --bbox` → MDX reference |
| Repo weight | 9 favorites × ~300 KB AVIF source ≈ ~3 MB; ~50 KB AVIF served per visit |
| Per-course TODO step | Pick + crop + caption (~30 min, post-OCR) |
| Deferred | A `/favorites/` gallery page (revisit at v∞ alongside `/archive/`) |

---

## 8. Todo Tracking

Todos are tracked in this session's SQL database with kebab-case IDs like `v0-repo-init`,
`v1-ml-grad-descent-demo`, etc. Run `SELECT * FROM todos WHERE status = 'pending'`
to see what's ready.

Todo seeding happens when the user transitions out of plan mode and into implementation.
Seeding scope:

- v0 spine work, fully decomposed (init Astro, demo-kit foundation, About interview, OG hand-design, controlled-vocab seed, `_courses.json`, deploy workflow, etc.)
- v1 ML & Stats course (3 demos as parent todos, with sub-tasks for narration template, presets, code-reveal, optional first-class touch)
- `ocr-vault` v2 work as one parent todo with sub-tasks per command

Per-course interviews (reflection sourcing + featured-problem curation + favorite-page
crop + PII review) are explicit todos, gated to run after that course's content is
staged.

Build-order dependencies (`todo_deps`):

- Every demo depends on `demo-kit-foundation` (Cycle 1 of v1) being complete
- Each course's `featured-problem-curation` depends on its `ocr-pass` completing
- Each course's `favorite-page-crop` depends on its `ocr-pass` + PII review
- v3+ courses depend on `ocr-vault-batch-run` (v2) completing
