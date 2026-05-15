"""Re-OCR planner — pure filtering + cost estimation for ``ocr-vault re-ocr``.

Given a map of ``{course_slug: [Sidecar, ...]}`` and a ``ReocrFilter``,
``build_reocr_plan`` returns a ``ReocrPlan`` describing exactly which
pages would be re-OCR'd, the estimated cost, and a representative
sample for diff display.

The planner is side-effect-free and never calls a provider or touches
disk. The CLI layer composes this with the orchestrator that actually
re-runs OCR.
"""

from __future__ import annotations

import difflib
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal

from ocr_vault.sidecar_schema import Block, Sidecar


class ReocrPlannerError(ValueError):
    """Raised when planner inputs are invalid (e.g. no filter selected)."""


@dataclass(frozen=True, slots=True)
class ReocrFilter:
    course: str | None = None
    low_confidence: bool = False
    needs_review: bool = False
    from_version: str | None = None
    page_hash: str | None = None
    featured_only: bool = False
    all: bool = False

    def has_any_selector(self) -> bool:
        """At least one selector flag must be set."""
        return any(
            (
                self.low_confidence,
                self.needs_review,
                self.from_version is not None,
                self.page_hash is not None,
                self.featured_only,
                self.all,
            )
        )


@dataclass(frozen=True, slots=True)
class PlannedPage:
    course: str
    sidecar: Sidecar
    reason: str


@dataclass(frozen=True, slots=True)
class ReocrPlan:
    pages: list[PlannedPage]
    estimated_cost_usd: Decimal
    sample_page: PlannedPage | None


# ─────────────── planning ──────────────────────────────────────────────────


def _has_problem_statement(sidecar: Sidecar) -> bool:
    return any(b.type == "problem_statement" for b in sidecar.extracted.blocks)


def _matches(
    sidecar: Sidecar,
    *,
    filter_: ReocrFilter,
    low_confidence_threshold: float,
) -> tuple[bool, str]:
    """Return (matches, reason). ``--all`` matches everything; other
    selectors are OR'd together (any match wins).
    """
    if filter_.all:
        return True, "all"
    if filter_.page_hash is not None and sidecar.source.page_hash == filter_.page_hash:
        return True, f"page_hash={filter_.page_hash[:16]}…"
    if filter_.low_confidence and sidecar.extracted.confidence < low_confidence_threshold:
        return True, f"low_confidence({sidecar.extracted.confidence:.2f})"
    if filter_.needs_review and sidecar.extracted.needs_review:
        return True, "needs_review"
    if (
        filter_.from_version is not None
        and sidecar.model.ocr_version == filter_.from_version
    ):
        return True, f"version={filter_.from_version}"
    if filter_.featured_only and _has_problem_statement(sidecar):
        return True, "featured"
    return False, ""


def build_reocr_plan(
    sidecars_by_course: Mapping[str, list[Sidecar]],
    *,
    filter_: ReocrFilter,
    low_confidence_threshold: float,
    estimated_cost_per_page_usd: Decimal,
) -> ReocrPlan:
    if not filter_.has_any_selector():
        raise ReocrPlannerError(
            "no re-ocr selector specified — pass at least one of "
            "--all / --course (with another flag) / --low-confidence / "
            "--needs-review / --from-version / --page-hash / --featured-only"
        )

    pages: list[PlannedPage] = []
    for course_slug, sidecars in sidecars_by_course.items():
        if filter_.course is not None and course_slug != filter_.course:
            continue
        for sc in sidecars:
            matched, reason = _matches(
                sc,
                filter_=filter_,
                low_confidence_threshold=low_confidence_threshold,
            )
            if matched:
                pages.append(
                    PlannedPage(course=course_slug, sidecar=sc, reason=reason)
                )

    pages.sort(key=lambda p: (p.course, p.sidecar.source.pdf, p.sidecar.source.page))
    estimated_cost = estimated_cost_per_page_usd * len(pages)
    sample = pages[0] if pages else None
    return ReocrPlan(
        pages=pages,
        estimated_cost_usd=estimated_cost,
        sample_page=sample,
    )


# ─────────────── diff rendering ────────────────────────────────────────────


def _block_lines(blocks: list[Block]) -> list[str]:
    out: list[str] = []
    for i, b in enumerate(blocks):
        out.append(f"# block {i} ({b.type}, problem_id={b.problem_id!r})")
        if b.prose:
            out.extend(b.prose.splitlines() or [""])
        if b.latex:
            out.append(f"$ {b.latex}")
        if b.caption:
            out.append(f"caption: {b.caption}")
        out.append("")
    return out


def render_sidecar_diff(old: Sidecar, new: Sidecar) -> str:
    old_lines = _block_lines(old.extracted.blocks)
    new_lines = _block_lines(new.extracted.blocks)
    diff_lines = list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"old@{old.model.ocr_version}",
            tofile=f"new@{new.model.ocr_version}",
            lineterm="",
        )
    )
    if not diff_lines:
        return "(no changes)"
    return "\n".join(diff_lines)
