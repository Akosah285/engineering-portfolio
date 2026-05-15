# Agent Skills — Configuration for `engineering-portfolio`

This file configures the engineering skills (`to-prd`, `to-issues`, `triage`, `tdd`, `diagnose`, `improve-codebase-architecture`, `zoom-out`) for this repository.

## Issue tracker

Issues and PRDs live as **GitHub Issues** in this repository (`akwasiakosah-microsoft/engineering-portfolio`). Use the `gh` CLI for all operations. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

## Triage labels

Five canonical triage labels mapped 1:1 to the matt-pocock vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

## Domain docs

Single-context repo. `CONTEXT.md` and `docs/adr/` will live at the repo root once they exist (created lazily by `/grill-with-docs`). See [`docs/agents/domain.md`](docs/agents/domain.md).

## Plan of record

The consolidated implementation plan from two grilling sessions (48 design decisions across architecture, cross-cutting mechanics, content/curation policy, and OCR fine-print) is published as Issue #1 (PRD) and broken into vertical-slice issues via `/to-issues`. The full plan also lives at `docs/PLAN.md` (mirror of session-state plan.md).
