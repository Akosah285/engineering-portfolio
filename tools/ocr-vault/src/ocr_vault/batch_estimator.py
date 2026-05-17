"""Pre-flight cost estimator for ``ocr-vault plan`` — closes #43 prep work.

Pure function: given a per-course manifest of (pdf_count, total_pages) and
expected average tokens per page, project total USD spend across all courses
using the existing ``cost_calculator`` pricing oracle. Flags whether the
projection would trip the same hard cap / soft warn the cost ledger enforces.

No I/O, no provider calls. The CLI layer in ``cli.py`` is the thin glue that
reads the manifest from disk and prints the report.

Mirrors the planner pattern from ``reocr_planner.py``.
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Final

from ocr_vault.cost_calculator import UnknownModelError, cost_for_call

_DEFAULT_AVG_INPUT_TOKENS_PER_PAGE: Final[int] = 900
_DEFAULT_AVG_OUTPUT_TOKENS_PER_PAGE: Final[int] = 400

_SLUG_RE: Final[re.Pattern[str]] = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def default_avg_input_tokens_per_page() -> int:
    """Sensible default for vision-OCR input tokens per page (handwritten coursework)."""
    return _DEFAULT_AVG_INPUT_TOKENS_PER_PAGE


def default_avg_output_tokens_per_page() -> int:
    """Sensible default for vision-OCR output tokens per page (transcribed prose + LaTeX)."""
    return _DEFAULT_AVG_OUTPUT_TOKENS_PER_PAGE


class BatchManifestError(ValueError):
    """Raised when a batch manifest file is missing, malformed, or invalid."""


@dataclass(frozen=True, slots=True)
class CourseEstimate:
    """One row of a batch manifest: a course slug + how much OCR work it represents."""

    slug: str
    pdf_count: int
    total_pages: int

    def __post_init__(self) -> None:
        if not self.slug:
            raise ValueError("CourseEstimate.slug must be non-empty")
        if not _SLUG_RE.fullmatch(self.slug):
            raise ValueError(
                f"CourseEstimate.slug {self.slug!r} must be lowercase kebab-case "
                "(matching /^[a-z0-9]+(-[a-z0-9]+)*$/)"
            )
        if self.pdf_count < 0:
            raise ValueError(
                f"CourseEstimate.pdf_count must be >= 0, got {self.pdf_count}"
            )
        if self.total_pages < 0:
            raise ValueError(
                f"CourseEstimate.total_pages must be >= 0, got {self.total_pages}"
            )


@dataclass(frozen=True, slots=True)
class CourseProjection:
    """Per-course projection — what one row of the report will show."""

    slug: str
    pdf_count: int
    total_pages: int
    projected_usd: Decimal


@dataclass(frozen=True, slots=True)
class BatchEstimate:
    """Full batch projection: per-course rows + totals + cap flags."""

    model: str
    per_course: list[CourseProjection]
    total_pages: int
    total_pdfs: int
    total_usd: Decimal
    exceeds_hard_cap: bool
    triggers_soft_warn: bool
    hard_cap_usd: Decimal
    soft_warn_usd: Decimal


# ─────────────── per-page cost ─────────────────────────────────────────────


def estimate_per_page_cost(
    *,
    model: str,
    avg_input_tokens: int,
    avg_output_tokens: int,
) -> Decimal:
    """USD cost of OCR'ing one page at the given token-count assumptions.

    Args:
        model: Model id (must be in ``cost_calculator.PRICING``).
        avg_input_tokens: Expected average input tokens per page (non-negative).
        avg_output_tokens: Expected average output tokens per page (non-negative).

    Returns:
        Decimal USD cost per page.

    Raises:
        ValueError / UnknownModelError: Propagated from ``cost_for_call``.
    """
    if avg_input_tokens < 0:
        raise ValueError(f"avg_input_tokens must be >= 0, got {avg_input_tokens}")
    if avg_output_tokens < 0:
        raise ValueError(f"avg_output_tokens must be >= 0, got {avg_output_tokens}")
    breakdown = cost_for_call(
        model=model,
        input_tokens=avg_input_tokens,
        output_tokens=avg_output_tokens,
    )
    return breakdown.total_usd


# ─────────────── batch aggregation ─────────────────────────────────────────


def estimate_batch_cost(
    manifest: Sequence[CourseEstimate],
    *,
    model: str,
    avg_input_tokens_per_page: int,
    avg_output_tokens_per_page: int,
    hard_cap_usd: Decimal = Decimal("50.00"),
    soft_warn_usd: Decimal = Decimal("10.00"),
) -> BatchEstimate:
    """Project total OCR spend across every course in the manifest.

    ``hard_cap_usd=Decimal("0")`` means *no cap* — matches ``CostLedger``
    semantics and the ``--max-cost 0`` CLI shortcut.

    Per-course rows are returned sorted by slug for stable report output.

    Raises:
        UnknownModelError / ValueError: From ``estimate_per_page_cost``.
    """
    if hard_cap_usd < 0:
        raise ValueError(f"hard_cap_usd must be >= 0, got {hard_cap_usd}")
    if soft_warn_usd < 0:
        raise ValueError(f"soft_warn_usd must be >= 0, got {soft_warn_usd}")

    per_page = estimate_per_page_cost(
        model=model,
        avg_input_tokens=avg_input_tokens_per_page,
        avg_output_tokens=avg_output_tokens_per_page,
    )

    sorted_manifest = sorted(manifest, key=lambda c: c.slug)
    per_course: list[CourseProjection] = []
    total_pages = 0
    total_pdfs = 0
    total_usd = Decimal("0")
    for course in sorted_manifest:
        projected = per_page * Decimal(course.total_pages)
        per_course.append(
            CourseProjection(
                slug=course.slug,
                pdf_count=course.pdf_count,
                total_pages=course.total_pages,
                projected_usd=projected,
            )
        )
        total_pages += course.total_pages
        total_pdfs += course.pdf_count
        total_usd += projected

    exceeds_hard_cap = hard_cap_usd > Decimal("0") and total_usd > hard_cap_usd
    triggers_soft_warn = total_usd > soft_warn_usd

    return BatchEstimate(
        model=model,
        per_course=per_course,
        total_pages=total_pages,
        total_pdfs=total_pdfs,
        total_usd=total_usd,
        exceeds_hard_cap=exceeds_hard_cap,
        triggers_soft_warn=triggers_soft_warn,
        hard_cap_usd=hard_cap_usd,
        soft_warn_usd=soft_warn_usd,
    )


# ─────────────── manifest loader ───────────────────────────────────────────


def load_batch_manifest(path: Path) -> list[CourseEstimate]:
    """Read and validate a batch manifest JSON file.

    Expected shape::

        {
          "courses": [
            {"slug": "machine-learning", "pdf_count": 2, "total_pages": 30},
            {"slug": "fourier-transforms", "pdf_count": 1, "total_pages": 12}
          ]
        }

    Raises:
        BatchManifestError: On missing file, invalid JSON, missing fields,
            or invalid field values (propagated from ``CourseEstimate``).
    """
    if not path.exists():
        raise BatchManifestError(f"batch manifest not found at {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise BatchManifestError(f"{path}: invalid JSON: {e}") from e

    if not isinstance(raw, dict) or "courses" not in raw:
        raise BatchManifestError(
            f"{path}: expected object with a 'courses' key at the root"
        )
    courses_raw = raw["courses"]
    if not isinstance(courses_raw, list):
        raise BatchManifestError(f"{path}: 'courses' must be a list")

    out: list[CourseEstimate] = []
    for i, entry in enumerate(courses_raw):
        if not isinstance(entry, dict):
            raise BatchManifestError(
                f"{path}: courses[{i}] must be an object, got {type(entry).__name__}"
            )
        for required in ("slug", "pdf_count", "total_pages"):
            if required not in entry:
                raise BatchManifestError(
                    f"{path}: courses[{i}] missing required field {required!r}"
                )
        try:
            out.append(
                CourseEstimate(
                    slug=str(entry["slug"]),
                    pdf_count=int(entry["pdf_count"]),
                    total_pages=int(entry["total_pages"]),
                )
            )
        except (ValueError, TypeError) as e:
            raise BatchManifestError(f"{path}: courses[{i}] invalid: {e}") from e
    return out


# ─────────────── report rendering ──────────────────────────────────────────


def format_estimate_report(estimate: BatchEstimate) -> str:
    """Human-readable report — used by ``ocr-vault plan``.

    Includes per-course rows + totals + an unambiguous cap-status line so the
    operator can decide whether to proceed without scanning numbers.
    """
    lines: list[str] = [
        "ocr-vault plan — pre-flight cost estimate",
        "-----------------------------------------",
        f"model              : {estimate.model}",
        f"total pdfs         : {estimate.total_pdfs}",
        f"total pages        : {estimate.total_pages}",
        f"estimated total    : ${estimate.total_usd}",
        f"soft-warn threshold: ${estimate.soft_warn_usd}",
        f"hard-cap threshold : ${estimate.hard_cap_usd}"
        + (" (disabled)" if estimate.hard_cap_usd == Decimal("0") else ""),
        "",
    ]

    if estimate.per_course:
        lines.append(f"{'course':<24}  {'pdfs':>4}  {'pages':>6}  {'projected':>12}")
        for c in estimate.per_course:
            lines.append(
                f"{c.slug:<24}  {c.pdf_count:>4}  {c.total_pages:>6}  "
                f"${c.projected_usd:>11}"
            )
        lines.append("")

    if estimate.exceeds_hard_cap:
        lines.append(
            f"[STOP] projected ${estimate.total_usd} exceeds hard cap "
            f"${estimate.hard_cap_usd} — reduce scope or raise --max-cost."
        )
    elif estimate.triggers_soft_warn:
        lines.append(
            f"[WARN] projected ${estimate.total_usd} exceeds soft-warn "
            f"${estimate.soft_warn_usd} — proceed with care."
        )
    else:
        lines.append(
            f"[ok] projected ${estimate.total_usd} is under both thresholds."
        )
    return "\n".join(lines) + "\n"


__all__ = [
    "BatchEstimate",
    "BatchManifestError",
    "CourseEstimate",
    "CourseProjection",
    "UnknownModelError",
    "default_avg_input_tokens_per_page",
    "default_avg_output_tokens_per_page",
    "estimate_batch_cost",
    "estimate_per_page_cost",
    "format_estimate_report",
    "load_batch_manifest",
]
