# OCR Vault — Batch Run Runbook

**Audience:** Akwasi (or anyone the toolchain owner explicitly delegates to).
**Scope:** Walks the operator through a real, money-spending OCR batch across all 9 courses, closing issue [#43](https://github.com/Akosah285/engineering-portfolio/issues/43).
**Prerequisites:** Real provider SDK + real PDF loader must be wired first — see the **Prerequisites still open** section at the bottom. Until those land, this runbook is a dry-run-only doc you can use to project spend (`ocr-vault plan`) and rehearse the cost-checkpoint protocol.

This doc lives at `docs/ocr-vault-batch-runbook.md` so it can be linked from the issue tracker and updated as the toolchain evolves.

---

## 1. Pre-flight checklist

Before placing any PDFs:

1. **Update `data/batch-manifest.json`** (copy from `data/batch-manifest.example.json`) with the real `pdf_count` and `total_pages` for each course. Use `qpdf --show-npages source.pdf` to count pages per PDF.
2. **Run the estimator**:

   ```powershell
   cd C:\Users\akwasiakosah\repos\playCopilot\playAgency\engineering-portfolio
   .\tools\ocr-vault\.venv\Scripts\Activate.ps1
   ocr-vault plan --data-dir data
   ```

   Read the per-course rows and the final `[ok] / [WARN] / [STOP]` line. If you see `[STOP]`, the projection exceeds the $50 hard cap — reduce scope (drop a PDF, drop low-priority pages) before continuing.
3. **Confirm the API key is set**:

   ```powershell
   $env:ANTHROPIC_API_KEY = "<paste your key>"
   ```

   Do **not** commit the key. It is the operator's responsibility to keep this out of shell history (`Set-PSReadlineOption -HistorySaveStyle SaveNothing` for the session if paranoid).
4. **Confirm `data/ocr-config.json`** lists every course you plan to OCR. The scaffold already registers all 9.

## 2. Place source PDFs

Copy each PDF into the per-course folder under `archive/originals/`:

```
archive/originals/
  computational-methods/<scan-name>.pdf
  digital-electronics/<scan-name>.pdf
  ...
```

The `crop` and `add` commands resolve PDFs against this exact layout (`archive/originals/<course-slug>/<pdf-name>`). A flat layout works too as a fallback, but per-course folders are cleaner.

## 3. Per-course run loop

For each course, do **all four steps** before moving on. The point is the cost-checkpoint at step 4 — don't batch through 9 courses and only check spend at the end.

### Step 3a — Add (the actual API spend)

```powershell
ocr-vault add `
  archive/originals/<course-slug>/<pdf-name>.pdf `
  --course <course-slug> `
  --provider anthropic `
  --max-cost 5 `
  --warn-cost 2 `
  --data-dir data
```

Per-PDF cap is intentionally tight (`--max-cost 5`) so a runaway PDF can't drain the full $50 budget. If a PDF legitimately needs more, re-run with a higher cap *and* a confirmation reread of the manifest.

### Step 3b — Check status

```powershell
ocr-vault status --data-dir data
```

Reads every sidecar on disk and prints per-course low-confidence / needs-review / needs-redaction counts. Anything in the `low-conf` or `review` column above ~10% of total pages should be flagged for follow-up.

### Step 3c — Check cumulative spend

```powershell
ocr-vault cost --by-course --data-dir data
```

Read the totals. If `total spend` is more than 60% of $50 ($30) and you still have more than 3 courses to go, **stop** and re-project with `ocr-vault plan` based on what you've actually spent per page so far (rough rule: average per-page cost so far × remaining pages).

### Step 3d — Commit + push

```powershell
git add data/sidecars/<course-slug> data/page-images/<course-slug>
git commit -m "chore(ocr-vault): batch run results for <course-slug>"
git push
```

Per-course commits keep the diff readable and let any catastrophe (e.g. accidental key check-in, bad sidecar shape) be reverted course-by-course.

## 4. Final reporting

After all 9 courses are through the loop:

```powershell
ocr-vault status --data-dir data > status-final.txt
ocr-vault cost --by-course --data-dir data > cost-final.txt
```

Post both as a comment on issue #43. Suggested template:

```markdown
## v2 OCR batch run — complete

**Total spend:** $XX.XX (under $50 hard cap ✅)
**Total pages OCR'd:** NNN across 9 courses

### Per-course summary

<paste status-final.txt here>

### Cost breakdown

<paste cost-final.txt here>

### Needs-review flags (follow-up issues)

- `<course-slug>`: NN pages flagged needs_review — opening follow-up issue
- `<course-slug>`: MM pages flagged PII redaction — opening follow-up issue
- ...
```

For each flagged-for-review course, open a new follow-up issue using `gh issue create` with the `area:content` label so it enters the normal triage flow.

## 5. Abort criteria

Stop the batch *immediately* and ask before continuing if any of these fire:

- `BudgetExceededError` raised by the orchestrator (means the hard cap is about to trip on the next call — the call did not happen).
- Any HTTP 5xx loop from the provider for more than 3 consecutive PDFs.
- A single PDF blowing through $5 by itself (something is wrong with the page count or token estimate).
- An assertion failure or sidecar-schema validation error — sidecars are the source of truth; never paper over a validation error.

When aborting: do **not** delete partial sidecars. The cache (`data/index.sqlite`) means a resumed run skips already-done pages. Just `git status` to confirm nothing else is dirty, then revisit the manifest / cost projection.

## 6. Prerequisites still open

The runbook above describes the *intended* operator flow. These prereqs must be closed before any of this actually spends money:

- **Real PDF rendering** — `tools/ocr-vault/src/ocr_vault/cli.py::_build_pdf_loader` only supports `MockPdfLoader` today. Real `pypdfium2` wiring is tracked under plan §2.3 / #36.
- **Real provider SDK calls** — `AnthropicProvider.call`, `OpenAIProvider.call`, `GeminiProvider.call` all raise `NotImplementedError`. The construction and selection logic is already there, but the actual HTTP call is stubbed.
- **PDFs in `archive/originals/<course-slug>/`** — Akwasi must copy scanned coursework PDFs from his local archive into the repo layout. The PDFs are not committed (they're under `archive/originals/` which is gitignored); only the OCR sidecars + page images are.

Until those three prereqs are closed, every command in this runbook except `ocr-vault plan`, `ocr-vault status`, and `ocr-vault cost` will either error out (real `add` with `anthropic`) or be a synthetic dry-run (real `add` with `--mock-pages N --provider mock`).

## 7. Related issues

- [#43](https://github.com/Akosah285/engineering-portfolio/issues/43) — v2 OCR batch run (this runbook's audience).
- [#36](https://github.com/Akosah285/engineering-portfolio/issues/36) — Real PDF rendering (blocker).
- Plan §2.3 — full v2 design rationale.
