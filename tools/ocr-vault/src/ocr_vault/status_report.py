"""Pure function that builds a human-readable status report.

Composes the existing OcrConfig + sidecar shape into a structured report
that the ``ocr-vault status`` CLI prints.

Deep module: zero I/O, takes inputs as objects, returns a structured
``StatusReport``. The CLI is the thin glue that reads sidecars from disk.

Sparkline uses Unicode block-element characters (▁▂▃▄▅▆▇█); GitHub Pages
& most modern terminals render these.
"""

from __future__ import annotations

from dataclasses import dataclass

from ocr_vault.ocr_config import OcrConfig
from ocr_vault.sidecar_schema import Sidecar

# Eight bins covering [0, 1]; bin i covers [i/8, (i+1)/8).
_NUM_BINS = 8
_BLOCK_CHARS = " ▁▂▃▄▅▆▇█"


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def confidence_sparkline(confidences: list[float]) -> str:
    """Render a fixed-width 8-character sparkline of confidence values.

    Returns ``""`` for an empty list. Values outside [0, 1] are clamped.
    Empty bins render as a single space, populated bins as one of
    ``▁▂▃▄▅▆▇█`` depending on their density relative to the busiest bin.
    """
    if not confidences:
        return ""

    bins = [0] * _NUM_BINS
    for raw in confidences:
        v = _clamp(raw, 0.0, 1.0)
        # Confidences exactly 1.0 must still land in the last bin, not overflow.
        idx = min(int(v * _NUM_BINS), _NUM_BINS - 1)
        bins[idx] += 1

    peak = max(bins)
    if peak == 0:  # pragma: no cover (impossible: confidences non-empty)
        return " " * _NUM_BINS

    # Map each bin count to one of 9 block chars (0 = space, 1..8 = block heights).
    out_chars: list[str] = []
    last_block_index = len(_BLOCK_CHARS) - 1
    for count in bins:
        # Bin count of 0 -> space; otherwise scale (1..peak) -> (1..8).
        if count == 0:
            out_chars.append(_BLOCK_CHARS[0])
            continue
        # Use rounding to keep small differences visible.
        scaled = 1 + round((count - 1) / max(peak - 1, 1) * (last_block_index - 1))
        scaled = min(last_block_index, max(1, scaled))
        out_chars.append(_BLOCK_CHARS[scaled])
    return "".join(out_chars)


@dataclass(frozen=True, slots=True)
class CourseStats:
    """Per-course summary derived from a list of sidecars."""

    course: str
    total_pages: int
    low_confidence_pages: int
    needs_review_pages: int
    needs_redaction_pages: int
    threshold: float
    sparkline: str

    @classmethod
    def from_sidecars(
        cls,
        *,
        course: str,
        sidecars: list[Sidecar],
        threshold: float,
    ) -> CourseStats:
        low = sum(
            1 for s in sidecars if s.extracted.confidence < threshold
        )
        rev = sum(1 for s in sidecars if s.extracted.needs_review)
        red = sum(1 for s in sidecars if s.pii.needs_redaction_review)
        sparkline = confidence_sparkline(
            [s.extracted.confidence for s in sidecars]
        )
        return cls(
            course=course,
            total_pages=len(sidecars),
            low_confidence_pages=low,
            needs_review_pages=rev,
            needs_redaction_pages=red,
            threshold=threshold,
            sparkline=sparkline,
        )


@dataclass(frozen=True, slots=True)
class StatusReport:
    """Full status: list of per-course rows + a stringified rendering."""

    courses: list[CourseStats]

    def __str__(self) -> str:
        if not self.courses:
            return (
                "ocr-vault status\n"
                "----------------\n"
                "No OCR data yet. Run `ocr-vault add <pdf-path> "
                "--course <slug>` to start.\n"
            )

        header = (
            "ocr-vault status\n"
            "----------------\n"
            f"{'course':<24}  {'pages':>6}  "
            f"{'low-conf':>9}  {'review':>7}  "
            f"{'redact':>7}  {'thr':>4}  histogram\n"
        )
        rows = [
            f"{c.course:<24}  {c.total_pages:>6}  "
            f"{c.low_confidence_pages:>9}  {c.needs_review_pages:>7}  "
            f"{c.needs_redaction_pages:>7}  {c.threshold:>4.2f}  {c.sparkline}"
            for c in self.courses
        ]
        return header + "\n".join(rows) + "\n"


def build_status_report(
    *,
    config: OcrConfig,
    sidecars_by_course: dict[str, list[Sidecar]],
) -> StatusReport:
    """Build a StatusReport from an OcrConfig and a per-course sidecar map.

    Courses are sorted alphabetically for stable output. Empty courses
    (no sidecars yet) are omitted; if every course is empty an
    informative "no data" report is returned.
    """
    courses = [
        CourseStats.from_sidecars(
            course=course,
            sidecars=sidecars,
            threshold=config.threshold_for(course),
        )
        for course, sidecars in sorted(sidecars_by_course.items())
    ]
    return StatusReport(courses=courses)
