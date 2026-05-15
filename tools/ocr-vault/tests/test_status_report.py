"""Tests for status_report — pure function that summarizes OCR state.

The status_report module takes an OcrConfig and a per-course set of
sidecar dicts and produces a human-readable multi-section report:

  - per-course summary table (total pages / low-confidence / needs-review / needs-redaction)
  - per-course confidence sparkline histogram (8 bins, [0..1])
  - per-course effective threshold
  - flagged-pages list (low_confidence OR needs_review OR needs_redaction_review)

The CLI wraps this; the work itself is pure so it's fully testable.
"""

from __future__ import annotations

import dataclasses
from dataclasses import replace

import pytest

from ocr_vault.ocr_config import OcrConfig
from ocr_vault.sidecar_schema import (
    Extracted,
    Model,
    Pii,
    Sidecar,
    Source,
)
from ocr_vault.status_report import (
    CourseStats,
    StatusReport,
    build_status_report,
    confidence_sparkline,
)

# ───────────────── fixtures ────────────────────────────────────────────────


def _sidecar(
    *,
    course_pdf: str = "hw1.pdf",
    page: int = 1,
    confidence: float = 0.9,
    needs_review: bool = False,
    needs_redaction: bool = False,
    names: tuple[str, ...] = (),
) -> Sidecar:
    """Build a valid Sidecar for tests."""
    return Sidecar(
        source=Source(
            pdf=course_pdf,
            page=page,
            page_hash=f"sha256:{'a' * 64}",
        ),
        extracted=Extracted(
            blocks=[],
            topics=[],
            confidence=confidence,
            needs_review=needs_review,
        ),
        pii=Pii(
            names_detected=list(names),
            akwasi_present=False,
            needs_redaction_review=needs_redaction,
        ),
        model=Model(
            provider="anthropic",
            model_id="claude-sonnet-4.5",
            ocr_version="1.0.0",
        ),
    )


# ───────────────── CourseStats ─────────────────────────────────────────────


class TestCourseStats:
    def test_empty_course_has_zero_counts(self) -> None:
        stats = CourseStats.from_sidecars(
            course="machine-learning",
            sidecars=[],
            threshold=0.7,
        )
        assert stats.course == "machine-learning"
        assert stats.total_pages == 0
        assert stats.low_confidence_pages == 0
        assert stats.needs_review_pages == 0
        assert stats.needs_redaction_pages == 0
        assert stats.threshold == 0.7

    def test_counts_total_pages(self) -> None:
        sidecars = [
            _sidecar(page=1),
            _sidecar(page=2),
            _sidecar(page=3),
        ]
        stats = CourseStats.from_sidecars(
            course="ml", sidecars=sidecars, threshold=0.7
        )
        assert stats.total_pages == 3

    def test_low_confidence_pages_strictly_below_threshold(self) -> None:
        sidecars = [
            _sidecar(page=1, confidence=0.9),
            _sidecar(page=2, confidence=0.5),
            _sidecar(page=3, confidence=0.69),
            _sidecar(page=4, confidence=0.7),  # exactly at threshold = not low
        ]
        stats = CourseStats.from_sidecars(
            course="ml", sidecars=sidecars, threshold=0.7
        )
        assert stats.low_confidence_pages == 2

    def test_needs_review_pages(self) -> None:
        sidecars = [
            _sidecar(page=1, needs_review=False),
            _sidecar(page=2, needs_review=True),
            _sidecar(page=3, needs_review=True),
        ]
        stats = CourseStats.from_sidecars(
            course="ml", sidecars=sidecars, threshold=0.7
        )
        assert stats.needs_review_pages == 2

    def test_needs_redaction_pages(self) -> None:
        sidecars = [
            _sidecar(page=1, needs_redaction=True),
            _sidecar(page=2, needs_redaction=False),
        ]
        stats = CourseStats.from_sidecars(
            course="ml", sidecars=sidecars, threshold=0.7
        )
        assert stats.needs_redaction_pages == 1

    def test_records_threshold(self) -> None:
        stats = CourseStats.from_sidecars(course="ml", sidecars=[], threshold=0.62)
        assert stats.threshold == 0.62


# ───────────────── confidence_sparkline ─────────────────────────────────────


class TestConfidenceSparkline:
    def test_empty_list_returns_empty_string(self) -> None:
        assert confidence_sparkline([]) == ""

    def test_single_value_renders_eight_bins(self) -> None:
        # Single confidence at 0.5 — should produce a string of length 8.
        out = confidence_sparkline([0.5])
        assert len(out) == 8
        # Exactly one bin is hot (the middle one).
        non_blank = [ch for ch in out if ch != " "]
        assert len(non_blank) == 1

    def test_uniform_distribution_fills_every_bin(self) -> None:
        # One value in each of the 8 bins.
        values = [0.05, 0.18, 0.31, 0.44, 0.57, 0.70, 0.83, 0.96]
        out = confidence_sparkline(values)
        assert len(out) == 8
        # All 8 bins should be non-blank.
        assert all(ch != " " for ch in out)

    def test_block_chars_scale_with_density(self) -> None:
        # Heavily weighted bottom bin should produce tallest block at left.
        values = [0.05] * 10 + [0.95]
        out = confidence_sparkline(values)
        assert len(out) == 8
        # Block characters increase in height: ▁▂▃▄▅▆▇█
        # The leftmost bin (10 values) should have a taller char than the
        # rightmost (1 value).
        block_heights = " ▁▂▃▄▅▆▇█"
        assert block_heights.index(out[0]) > block_heights.index(out[7])

    def test_values_out_of_range_are_clamped(self) -> None:
        # Defensive: confidence values outside [0,1] shouldn't crash; clamp.
        out = confidence_sparkline([-0.1, 1.5, 0.5])
        assert len(out) == 8


# ───────────────── build_status_report ─────────────────────────────────────


class TestBuildStatusReport:
    def test_empty_input_returns_empty_report(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={},
        )
        assert isinstance(report, StatusReport)
        assert report.courses == []

    def test_single_course_resolves_threshold_from_config(self) -> None:
        config = OcrConfig(
            global_threshold=0.7,
            per_course={"machine-learning": 0.6},
        )
        report = build_status_report(
            config=config,
            sidecars_by_course={"machine-learning": [_sidecar(confidence=0.65)]},
        )
        assert len(report.courses) == 1
        assert report.courses[0].course == "machine-learning"
        assert report.courses[0].threshold == 0.6
        # 0.65 >= 0.6 so it is NOT low confidence.
        assert report.courses[0].low_confidence_pages == 0

    def test_falls_back_to_global_threshold(self) -> None:
        config = OcrConfig(global_threshold=0.8, per_course={})
        report = build_status_report(
            config=config,
            sidecars_by_course={"foo": [_sidecar(confidence=0.75)]},
        )
        assert report.courses[0].threshold == 0.8
        assert report.courses[0].low_confidence_pages == 1

    def test_courses_sorted_alphabetically(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "zeta": [_sidecar()],
                "alpha": [_sidecar()],
                "mu": [_sidecar()],
            },
        )
        assert [c.course for c in report.courses] == ["alpha", "mu", "zeta"]

    def test_report_str_contains_each_course(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "machine-learning": [_sidecar()],
                "fourier-transforms": [_sidecar()],
            },
        )
        text = str(report)
        assert "machine-learning" in text
        assert "fourier-transforms" in text

    def test_report_str_empty_has_helpful_message(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={},
        )
        text = str(report)
        # The "no data" report should still tell the user what to do.
        assert text.strip() != ""
        assert "ocr-vault add" in text or "no" in text.lower()

    def test_report_str_includes_threshold_per_course(self) -> None:
        config = OcrConfig(
            global_threshold=0.7, per_course={"ml": 0.6}
        )
        report = build_status_report(
            config=config,
            sidecars_by_course={"ml": [_sidecar(confidence=0.8)]},
        )
        text = str(report)
        assert "0.6" in text

    def test_report_str_includes_page_counts(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "ml": [_sidecar(), _sidecar(page=2), _sidecar(page=3)],
            },
        )
        text = str(report)
        # 3 total pages should be visible somewhere.
        assert "3" in text

    def test_report_str_flags_needs_review_count(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "ml": [
                    _sidecar(needs_review=True),
                    _sidecar(needs_review=True, page=2),
                ],
            },
        )
        text = str(report)
        assert "2" in text  # the count must appear

    def test_report_str_flags_redaction_count(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "ml": [_sidecar(needs_redaction=True)],
            },
        )
        text = str(report).lower()
        assert "redact" in text or "pii" in text

    def test_report_str_includes_sparkline_when_there_are_pages(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={
                "ml": [_sidecar(confidence=c) for c in (0.1, 0.3, 0.5, 0.7, 0.9)],
            },
        )
        text = str(report)
        # Sparkline uses block chars from " ▁▂▃▄▅▆▇█".
        block_chars = set("▁▂▃▄▅▆▇█")
        assert any(ch in block_chars for ch in text)


# ───────────────── data shape ──────────────────────────────────────────────


class TestStatusReportShape:
    def test_status_report_is_frozen(self) -> None:
        report = build_status_report(
            config=OcrConfig.empty(),
            sidecars_by_course={},
        )
        with pytest.raises((AttributeError, dataclasses.FrozenInstanceError)):
            report.courses = []  # type: ignore[misc]

    def test_course_stats_is_frozen(self) -> None:
        stats = CourseStats.from_sidecars(course="ml", sidecars=[], threshold=0.7)
        with pytest.raises((AttributeError, dataclasses.FrozenInstanceError)):
            stats.total_pages = 99  # type: ignore[misc]

    def test_course_stats_can_be_replaced_for_overrides(self) -> None:
        # dataclasses.replace works on frozen instances; cheap sanity check.
        stats = CourseStats.from_sidecars(course="ml", sidecars=[], threshold=0.7)
        new = replace(stats, threshold=0.6)
        assert new.threshold == 0.6
        assert stats.threshold == 0.7
