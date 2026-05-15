"""Sidecar listings — pure ranking/listing logic for ``ocr-vault list-*`` (closes #39).

Three side-effect-free functions over a ``Sequence[Sidecar]``:

    list_problems   — every problem_statement block, sorted by (pdf, page)
    list_pii        — every page flagged for PII review, sorted by (pdf, page)
    rank_candidates — top-N favorite-page candidates by composite score:
                          score = work_density + confidence - pii_penalty
                      where:
                          work_density  = log(1 + total_block_chars) / log(1001)
                          confidence    = sidecar.extracted.confidence
                          pii_penalty   = 0.3 if needs_redaction_review else 0

The CLI layer is responsible for formatting (Rich tables); these functions
are deterministic dataclass producers tested in isolation.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, field

from ocr_vault.sidecar_schema import Block, Sidecar

_PROBLEM_BLOCK_TYPE = "problem_statement"
_SNIPPET_MAX = 100
_PII_PENALTY = 0.3
_WORK_DENSITY_NORMALIZER = math.log(1001.0)  # 1000 chars -> ~1.0


@dataclass(frozen=True, slots=True)
class ProblemListing:
    pdf: str
    page: int
    problem_id: str
    confidence: float
    snippet: str


@dataclass(frozen=True, slots=True)
class PiiListing:
    pdf: str
    page: int
    names_detected: list[str]
    akwasi_present: bool


@dataclass(frozen=True, slots=True)
class CandidateListing:
    pdf: str
    page: int
    page_hash: str
    score: float
    breakdown: dict[str, float] = field(default_factory=dict)


# ---------- list_problems ----------


def _block_snippet(block: Block, max_chars: int = _SNIPPET_MAX) -> str:
    text = block.prose if block.prose else block.latex
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def list_problems(sidecars: Sequence[Sidecar]) -> list[ProblemListing]:
    rows: list[ProblemListing] = []
    for sc in sidecars:
        for block in sc.extracted.blocks:
            if block.type != _PROBLEM_BLOCK_TYPE:
                continue
            rows.append(
                ProblemListing(
                    pdf=sc.source.pdf,
                    page=sc.source.page,
                    problem_id=block.problem_id or "",
                    confidence=sc.extracted.confidence,
                    snippet=_block_snippet(block),
                )
            )
    rows.sort(key=lambda r: (r.pdf, r.page, r.problem_id))
    return rows


# ---------- list_pii ----------


def list_pii(sidecars: Sequence[Sidecar]) -> list[PiiListing]:
    rows = [
        PiiListing(
            pdf=sc.source.pdf,
            page=sc.source.page,
            names_detected=list(sc.pii.names_detected),
            akwasi_present=sc.pii.akwasi_present,
        )
        for sc in sidecars
        if sc.pii.needs_redaction_review
    ]
    rows.sort(key=lambda r: (r.pdf, r.page))
    return rows


# ---------- rank_candidates ----------


def _work_density(sidecar: Sidecar) -> float:
    total_chars = sum(len(b.prose) + len(b.latex) for b in sidecar.extracted.blocks)
    if total_chars == 0:
        return 0.0
    # Log-normalised so a 1000-char page maps to ~1.0
    return min(1.0, math.log(1.0 + total_chars) / _WORK_DENSITY_NORMALIZER)


def _candidate_score_breakdown(sidecar: Sidecar) -> dict[str, float]:
    return {
        "work_density": _work_density(sidecar),
        "confidence": float(sidecar.extracted.confidence),
        "pii_penalty": _PII_PENALTY if sidecar.pii.needs_redaction_review else 0.0,
    }


def rank_candidates(
    sidecars: Sequence[Sidecar],
    *,
    limit: int = 10,
) -> list[CandidateListing]:
    """Score, filter, and rank pages as 'favorite-page' candidates.

    Pages with zero work density (no prose / latex) are excluded.
    Returns the top ``limit`` results sorted by composite score (high → low),
    breaking ties by ``(pdf, page)`` for determinism.
    """
    scored: list[CandidateListing] = []
    for sc in sidecars:
        breakdown = _candidate_score_breakdown(sc)
        if breakdown["work_density"] == 0.0:
            continue
        score = breakdown["work_density"] + breakdown["confidence"] - breakdown["pii_penalty"]
        scored.append(
            CandidateListing(
                pdf=sc.source.pdf,
                page=sc.source.page,
                page_hash=sc.source.page_hash,
                score=score,
                breakdown=breakdown,
            )
        )
    scored.sort(key=lambda r: (-r.score, r.pdf, r.page))
    return scored[:limit]
