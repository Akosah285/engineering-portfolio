"""TDD: batch_estimator deep module — pre-flight cost projection for `ocr-vault plan`.

Pure functions only: given a manifest of per-course (pdf_count, total_pages) and
expected average tokens-per-page, project total USD spend across all courses
using the existing cost_calculator pricing oracle. No I/O, no provider calls.

Backs the `ocr-vault plan` subcommand the v2 OCR batch run (#43) needs before
spending money. Mirrors the planner pattern from reocr_planner.py.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from ocr_vault.batch_estimator import (
    BatchEstimate,
    BatchManifestError,
    CourseEstimate,
    CourseProjection,
    default_avg_input_tokens_per_page,
    default_avg_output_tokens_per_page,
    estimate_batch_cost,
    estimate_per_page_cost,
    format_estimate_report,
    load_batch_manifest,
)

# ─────────────── estimate_per_page_cost ────────────────────────────────────


class TestPerPageCost:
    def test_uses_cost_calculator_pricing_for_known_model(self) -> None:
        # claude-sonnet-4.5: $3/M input, $15/M output
        # 900 in + 400 out = 900*3 + 400*15 = 2700 + 6000 = 8700 micro-USD
        # = 0.0087 USD per page
        cost = estimate_per_page_cost(
            model="claude-sonnet-4.5",
            avg_input_tokens=900,
            avg_output_tokens=400,
        )
        assert cost == Decimal("0.0087")

    def test_scales_linearly_with_input_tokens(self) -> None:
        a = estimate_per_page_cost(
            model="claude-sonnet-4.5", avg_input_tokens=100, avg_output_tokens=0
        )
        b = estimate_per_page_cost(
            model="claude-sonnet-4.5", avg_input_tokens=200, avg_output_tokens=0
        )
        assert b == a * 2

    def test_rejects_negative_tokens(self) -> None:
        with pytest.raises(ValueError):
            estimate_per_page_cost(
                model="claude-sonnet-4.5", avg_input_tokens=-1, avg_output_tokens=0
            )
        with pytest.raises(ValueError):
            estimate_per_page_cost(
                model="claude-sonnet-4.5", avg_input_tokens=0, avg_output_tokens=-1
            )

    def test_unknown_model_fails_loud(self) -> None:
        with pytest.raises(ValueError):
            estimate_per_page_cost(
                model="not-a-real-model",
                avg_input_tokens=100,
                avg_output_tokens=100,
            )


# ─────────────── estimate_batch_cost ───────────────────────────────────────


class TestBatchAggregation:
    def test_returns_batchestimate_with_per_course_breakdown(self) -> None:
        manifest = [
            CourseEstimate(slug="ml", pdf_count=1, total_pages=10),
            CourseEstimate(slug="fft", pdf_count=2, total_pages=20),
        ]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
        )
        assert isinstance(result, BatchEstimate)
        assert len(result.per_course) == 2
        assert all(isinstance(c, CourseProjection) for c in result.per_course)

    def test_total_equals_sum_of_per_course(self) -> None:
        manifest = [
            CourseEstimate(slug="ml", pdf_count=1, total_pages=10),
            CourseEstimate(slug="fft", pdf_count=2, total_pages=20),
            CourseEstimate(slug="dp", pdf_count=1, total_pages=5),
        ]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
        )
        assert result.total_usd == sum(
            (c.projected_usd for c in result.per_course), Decimal("0")
        )

    def test_per_course_cost_equals_pages_times_per_page(self) -> None:
        per_page = estimate_per_page_cost(
            model="claude-sonnet-4.5",
            avg_input_tokens=900,
            avg_output_tokens=400,
        )
        manifest = [CourseEstimate(slug="ml", pdf_count=1, total_pages=10)]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
        )
        assert result.per_course[0].projected_usd == per_page * 10

    def test_total_pages_aggregated(self) -> None:
        manifest = [
            CourseEstimate(slug="ml", pdf_count=1, total_pages=10),
            CourseEstimate(slug="fft", pdf_count=2, total_pages=20),
        ]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
        )
        assert result.total_pages == 30
        assert result.total_pdfs == 3

    def test_empty_manifest_yields_zero_cost(self) -> None:
        result = estimate_batch_cost(
            [],
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
        )
        assert result.total_usd == Decimal("0")
        assert result.total_pages == 0
        assert result.per_course == []

    def test_per_course_sorted_by_slug(self) -> None:
        manifest = [
            CourseEstimate(slug="zzz", pdf_count=1, total_pages=1),
            CourseEstimate(slug="aaa", pdf_count=1, total_pages=1),
            CourseEstimate(slug="mmm", pdf_count=1, total_pages=1),
        ]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=100,
            avg_output_tokens_per_page=100,
        )
        slugs = [c.slug for c in result.per_course]
        assert slugs == ["aaa", "mmm", "zzz"]


# ─────────────── cap projection ────────────────────────────────────────────


class TestCapProjection:
    def test_exceeds_hard_cap_when_total_above_cap(self) -> None:
        # 10000 pages * Sonnet $0.0087 = $87 > $50 hard cap
        manifest = [CourseEstimate(slug="big", pdf_count=1, total_pages=10000)]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("50.00"),
            soft_warn_usd=Decimal("10.00"),
        )
        assert result.exceeds_hard_cap is True
        assert result.triggers_soft_warn is True

    def test_under_soft_warn_when_total_small(self) -> None:
        manifest = [CourseEstimate(slug="tiny", pdf_count=1, total_pages=10)]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("50.00"),
            soft_warn_usd=Decimal("10.00"),
        )
        assert result.exceeds_hard_cap is False
        assert result.triggers_soft_warn is False

    def test_triggers_soft_warn_when_above_warn_below_cap(self) -> None:
        # 2000 pages * $0.0087 = $17.40 -- above $10 soft warn, below $50 cap
        manifest = [CourseEstimate(slug="mid", pdf_count=1, total_pages=2000)]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("50.00"),
            soft_warn_usd=Decimal("10.00"),
        )
        assert result.exceeds_hard_cap is False
        assert result.triggers_soft_warn is True

    def test_zero_hard_cap_means_no_cap(self) -> None:
        # Mirrors CostLedger semantics: hard_cap_usd=0 → unlimited.
        manifest = [CourseEstimate(slug="huge", pdf_count=1, total_pages=1_000_000)]
        result = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("0"),
            soft_warn_usd=Decimal("10.00"),
        )
        assert result.exceeds_hard_cap is False


# ─────────────── input validation ──────────────────────────────────────────


class TestInputValidation:
    def test_course_estimate_rejects_empty_slug(self) -> None:
        with pytest.raises(ValueError):
            CourseEstimate(slug="", pdf_count=1, total_pages=1)

    def test_course_estimate_rejects_negative_counts(self) -> None:
        with pytest.raises(ValueError):
            CourseEstimate(slug="ml", pdf_count=-1, total_pages=1)
        with pytest.raises(ValueError):
            CourseEstimate(slug="ml", pdf_count=1, total_pages=-1)

    def test_course_estimate_rejects_non_kebab_slug(self) -> None:
        with pytest.raises(ValueError):
            CourseEstimate(slug="Machine Learning", pdf_count=1, total_pages=1)
        with pytest.raises(ValueError):
            CourseEstimate(slug="ml_course", pdf_count=1, total_pages=1)


# ─────────────── defaults ──────────────────────────────────────────────────


class TestDefaults:
    def test_default_token_estimates_are_positive_ints(self) -> None:
        assert default_avg_input_tokens_per_page() > 0
        assert default_avg_output_tokens_per_page() > 0
        assert isinstance(default_avg_input_tokens_per_page(), int)
        assert isinstance(default_avg_output_tokens_per_page(), int)


# ─────────────── load_batch_manifest ──────────────────────────────────────


class TestManifestLoader:
    def test_loads_valid_manifest_from_disk(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "courses": [
                        {"slug": "ml", "pdf_count": 2, "total_pages": 30},
                        {"slug": "fft", "pdf_count": 1, "total_pages": 12},
                    ]
                }
            )
        )
        loaded = load_batch_manifest(manifest_path)
        assert len(loaded) == 2
        assert loaded[0].slug == "ml"
        assert loaded[0].total_pages == 30
        assert loaded[1].slug == "fft"

    def test_missing_file_raises(self, tmp_path: Path) -> None:
        with pytest.raises(BatchManifestError):
            load_batch_manifest(tmp_path / "missing.json")

    def test_invalid_json_raises(self, tmp_path: Path) -> None:
        p = tmp_path / "bad.json"
        p.write_text("{not json")
        with pytest.raises(BatchManifestError):
            load_batch_manifest(p)

    def test_missing_courses_key_raises(self, tmp_path: Path) -> None:
        p = tmp_path / "noroot.json"
        p.write_text(json.dumps({"not_courses": []}))
        with pytest.raises(BatchManifestError):
            load_batch_manifest(p)

    def test_missing_field_in_entry_raises(self, tmp_path: Path) -> None:
        p = tmp_path / "incomplete.json"
        p.write_text(
            json.dumps({"courses": [{"slug": "ml", "pdf_count": 1}]})  # no total_pages
        )
        with pytest.raises(BatchManifestError):
            load_batch_manifest(p)

    def test_invalid_field_value_propagates(self, tmp_path: Path) -> None:
        p = tmp_path / "bad-slug.json"
        p.write_text(
            json.dumps(
                {"courses": [{"slug": "", "pdf_count": 1, "total_pages": 1}]}
            )
        )
        with pytest.raises(BatchManifestError):
            load_batch_manifest(p)


# ─────────────── format_estimate_report ────────────────────────────────────


class TestReportFormatting:
    def _sample_estimate(self) -> BatchEstimate:
        manifest = [
            CourseEstimate(slug="ml", pdf_count=2, total_pages=30),
            CourseEstimate(slug="fft", pdf_count=1, total_pages=12),
        ]
        return estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("50.00"),
            soft_warn_usd=Decimal("10.00"),
        )

    def test_report_mentions_model_and_total(self) -> None:
        report = format_estimate_report(self._sample_estimate())
        assert "claude-sonnet-4.5" in report
        assert "total" in report.lower()

    def test_report_lists_every_course(self) -> None:
        report = format_estimate_report(self._sample_estimate())
        assert "ml" in report
        assert "fft" in report

    def test_report_flags_cap_status(self) -> None:
        manifest = [CourseEstimate(slug="big", pdf_count=1, total_pages=10000)]
        estimate = estimate_batch_cost(
            manifest,
            model="claude-sonnet-4.5",
            avg_input_tokens_per_page=900,
            avg_output_tokens_per_page=400,
            hard_cap_usd=Decimal("50.00"),
            soft_warn_usd=Decimal("10.00"),
        )
        report = format_estimate_report(estimate)
        # Operator needs an unambiguous abort signal when over the hard cap.
        assert "hard cap" in report.lower() or "exceeds" in report.lower()
