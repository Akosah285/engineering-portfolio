"""Tests for the re-ocr planner module (closes #40 — pure planner only).

Pure-function tests over a synthetic ``sidecars_by_course`` map. The CLI
layer is responsible for actually invoking the provider and writing
sidecars — this module only computes which pages would be re-OCR'd, the
estimated cost, and a representative sample for diff display.
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

import pytest

from ocr_vault.reocr_planner import (
    ReocrFilter,
    ReocrPlan,
    ReocrPlannerError,
    build_reocr_plan,
    render_sidecar_diff,
)
from ocr_vault.sidecar_schema import (
    Block,
    Extracted,
    Model,
    Pii,
    Sidecar,
    Source,
)


def _make_sidecar(
    *,
    page: int = 1,
    pdf: str = "hw1.pdf",
    page_hash: str | None = None,
    confidence: float = 0.9,
    needs_review: bool = False,
    blocks: Sequence[Block] = (),
    ocr_version: str = "1.0.0",
) -> Sidecar:
    return Sidecar(
        source=Source(
            pdf=pdf,
            page=page,
            page_hash=page_hash or f"sha256:{page:064d}",
        ),
        extracted=Extracted(
            blocks=list(blocks),
            topics=[],
            confidence=confidence,
            needs_review=needs_review,
        ),
        pii=Pii(names_detected=[], akwasi_present=False, needs_redaction_review=False),
        model=Model(provider="mock", model_id="m1", ocr_version=ocr_version),
    )


def _scs_by_course(*entries: tuple[str, list[Sidecar]]) -> dict[str, list[Sidecar]]:
    return dict(entries)


# ─────────────── core API shape ────────────────────────────────────────────


class TestPlanShape:
    def test_returns_plan_with_pages_cost_sample(self) -> None:
        scs = _scs_by_course(
            ("ml", [_make_sidecar(page=1, confidence=0.5)]),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(low_confidence=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert isinstance(plan, ReocrPlan)
        assert len(plan.pages) == 1
        assert plan.estimated_cost_usd == Decimal("0.03")
        assert plan.sample_page is plan.pages[0]

    def test_no_filter_selected_raises(self) -> None:
        with pytest.raises(ReocrPlannerError):
            build_reocr_plan(
                _scs_by_course(("ml", [])),
                filter_=ReocrFilter(),
                low_confidence_threshold=0.7,
                estimated_cost_per_page_usd=Decimal("0.03"),
            )

    def test_empty_match_returns_zero_cost_no_sample(self) -> None:
        scs = _scs_by_course(("ml", [_make_sidecar(page=1, confidence=0.95)]))
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(low_confidence=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert plan.pages == []
        assert plan.estimated_cost_usd == Decimal("0")
        assert plan.sample_page is None


# ─────────────── filter: --course ──────────────────────────────────────────


class TestCourseFilter:
    def test_course_alone_selects_all_pages_in_course(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:ml1"),
                    _make_sidecar(page=2, page_hash="sha256:ml2"),
                ],
            ),
            (
                "fou",
                [_make_sidecar(page=1, page_hash="sha256:fou1")],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(course="ml", all=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert {p.sidecar.source.page_hash for p in plan.pages} == {
            "sha256:ml1",
            "sha256:ml2",
        }

    def test_course_combined_with_low_confidence(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:ml1", confidence=0.5),
                    _make_sidecar(page=2, page_hash="sha256:ml2", confidence=0.95),
                ],
            ),
            (
                "fou",
                [_make_sidecar(page=1, page_hash="sha256:fou1", confidence=0.4)],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(course="ml", low_confidence=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        # Only ml/page-1 (low confidence + in ml). ml/page-2 has high confidence.
        # fou/page-1 has low confidence but wrong course.
        hashes = {p.sidecar.source.page_hash for p in plan.pages}
        assert hashes == {"sha256:ml1"}


# ─────────────── filter: --low-confidence ──────────────────────────────────


class TestLowConfidenceFilter:
    def test_default_threshold_picks_below_0_7(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:1", confidence=0.69),
                    _make_sidecar(page=2, page_hash="sha256:2", confidence=0.71),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(low_confidence=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert {p.sidecar.source.page_hash for p in plan.pages} == {"sha256:1"}

    def test_custom_threshold_overrides(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:1", confidence=0.69),
                    _make_sidecar(page=2, page_hash="sha256:2", confidence=0.71),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(low_confidence=True),
            low_confidence_threshold=0.5,  # tighter threshold
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert plan.pages == []


# ─────────────── filter: --needs-review ────────────────────────────────────


class TestNeedsReviewFilter:
    def test_picks_only_needs_review_pages(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:1", needs_review=True),
                    _make_sidecar(page=2, page_hash="sha256:2", needs_review=False),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(needs_review=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert {p.sidecar.source.page_hash for p in plan.pages} == {"sha256:1"}


# ─────────────── filter: --from-version ────────────────────────────────────


class TestFromVersionFilter:
    def test_picks_only_matching_version(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:1", ocr_version="0.9.0"),
                    _make_sidecar(page=2, page_hash="sha256:2", ocr_version="1.0.0"),
                    _make_sidecar(page=3, page_hash="sha256:3", ocr_version="0.9.0"),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(from_version="0.9.0"),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert {p.sidecar.source.page_hash for p in plan.pages} == {
            "sha256:1",
            "sha256:3",
        }


# ─────────────── filter: --page-hash ───────────────────────────────────────


class TestPageHashFilter:
    def test_picks_one_specific_page(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:specific"),
                    _make_sidecar(page=2, page_hash="sha256:other"),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(page_hash="sha256:specific"),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert len(plan.pages) == 1
        assert plan.pages[0].sidecar.source.page_hash == "sha256:specific"

    def test_no_match_returns_empty(self) -> None:
        scs = _scs_by_course(
            ("ml", [_make_sidecar(page=1, page_hash="sha256:other")])
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(page_hash="sha256:nonexistent"),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert plan.pages == []


# ─────────────── filter: --featured-only ───────────────────────────────────


class TestFeaturedOnlyFilter:
    def test_picks_pages_with_problem_statement_blocks(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(
                        page=1,
                        page_hash="sha256:featured",
                        blocks=[
                            Block(
                                type="problem_statement",
                                problem_id="1a",
                                prose="A problem.",
                            )
                        ],
                    ),
                    _make_sidecar(
                        page=2,
                        page_hash="sha256:plain",
                        blocks=[Block(type="prose", prose="lecture notes")],
                    ),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(featured_only=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert {p.sidecar.source.page_hash for p in plan.pages} == {
            "sha256:featured",
        }


# ─────────────── filter: --all ─────────────────────────────────────────────


class TestAllFilter:
    def test_picks_every_sidecar_in_every_course(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:ml1"),
                    _make_sidecar(page=2, page_hash="sha256:ml2"),
                ],
            ),
            (
                "fou",
                [_make_sidecar(page=1, page_hash="sha256:fou1")],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(all=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.03"),
        )
        assert len(plan.pages) == 3


# ─────────────── cost estimation ───────────────────────────────────────────


class TestCostEstimation:
    def test_cost_scales_linearly(self) -> None:
        scs = _scs_by_course(
            (
                "ml",
                [
                    _make_sidecar(page=1, page_hash="sha256:1"),
                    _make_sidecar(page=2, page_hash="sha256:2"),
                    _make_sidecar(page=3, page_hash="sha256:3"),
                ],
            ),
        )
        plan = build_reocr_plan(
            scs,
            filter_=ReocrFilter(all=True),
            low_confidence_threshold=0.7,
            estimated_cost_per_page_usd=Decimal("0.05"),
        )
        assert plan.estimated_cost_usd == Decimal("0.15")


# ─────────────── render_sidecar_diff ───────────────────────────────────────


class TestRenderSidecarDiff:
    def test_shows_prose_changes_in_unified_diff(self) -> None:
        old = _make_sidecar(
            blocks=[Block(type="prose", prose="first try at the prose.")]
        )
        new = _make_sidecar(
            blocks=[Block(type="prose", prose="second take, much better.")]
        )
        diff = render_sidecar_diff(old, new)
        assert "first try" in diff
        assert "second take" in diff
        # Diff markers from difflib unified_diff.
        assert "-" in diff
        assert "+" in diff

    def test_identical_sidecars_emit_empty_diff(self) -> None:
        sc = _make_sidecar(blocks=[Block(type="prose", prose="same.")])
        diff = render_sidecar_diff(sc, sc)
        assert diff.strip() == "" or "no changes" in diff.lower()
