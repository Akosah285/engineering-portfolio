"""Tests for sidecar listing modules (closes #39).

Three pure listing functions under test:

    list_problems(sidecars)    — every problem_statement block as a row
    list_pii(sidecars)         — every page flagged for PII review
    rank_candidates(sidecars)  — top-N favorite-page candidates by composite score

All three accept a flat ``Sequence[Sidecar]`` and return typed dataclass
records. The CLI layer is responsible for formatting; these modules are
deterministic and side-effect-free.
"""

from __future__ import annotations

from collections.abc import Sequence

import pytest

from ocr_vault.listings import (
    CandidateListing,
    PiiListing,
    ProblemListing,
    list_pii,
    list_problems,
    rank_candidates,
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
    page_hash: str | None = None,
    pdf: str = "hw1.pdf",
    blocks: Sequence[Block] = (),
    topics: Sequence[str] = (),
    confidence: float = 0.9,
    needs_review: bool = False,
    pii_names: Sequence[str] = (),
    akwasi_present: bool = False,
    needs_redaction_review: bool = False,
) -> Sidecar:
    return Sidecar(
        source=Source(
            pdf=pdf,
            page=page,
            page_hash=page_hash or f"sha256:{page:064d}",
        ),
        extracted=Extracted(
            blocks=list(blocks),
            topics=list(topics),
            confidence=confidence,
            needs_review=needs_review,
        ),
        pii=Pii(
            names_detected=list(pii_names),
            akwasi_present=akwasi_present,
            needs_redaction_review=needs_redaction_review,
        ),
        model=Model(provider="mock", model_id="m1", ocr_version="1.0.0"),
    )


# ============== list_problems ==============================================


class TestListProblems:
    def test_returns_one_row_per_problem_statement_block(self) -> None:
        sc = _make_sidecar(
            page=3,
            blocks=[
                Block(
                    type="problem_statement",
                    problem_id="3a",
                    prose="Find the Fourier coefficients of f(x) = x.",
                ),
                Block(type="solution_step", problem_id="3a", prose="..."),
                Block(
                    type="problem_statement",
                    problem_id="3b",
                    prose="Compute the convolution integral.",
                ),
            ],
        )
        rows = list_problems([sc])
        assert len(rows) == 2
        assert all(isinstance(r, ProblemListing) for r in rows)

    def test_records_page_problem_id_confidence_and_snippet(self) -> None:
        long_prose = "x" * 200 + " (tail)"
        sc = _make_sidecar(
            page=5,
            confidence=0.83,
            blocks=[
                Block(
                    type="problem_statement",
                    problem_id="2",
                    prose=long_prose,
                )
            ],
        )
        [row] = list_problems([sc])
        assert row.page == 5
        assert row.problem_id == "2"
        assert row.confidence == pytest.approx(0.83)
        # Snippet is at most 100 chars
        assert len(row.snippet) <= 100
        assert row.snippet.startswith("x")

    def test_uses_latex_when_no_prose(self) -> None:
        sc = _make_sidecar(
            blocks=[
                Block(
                    type="problem_statement",
                    problem_id="1",
                    latex=r"\int_0^1 x^2 \, dx = ?",
                )
            ],
        )
        [row] = list_problems([sc])
        assert "int" in row.snippet

    def test_skips_non_problem_blocks(self) -> None:
        sc = _make_sidecar(
            blocks=[
                Block(type="prose", prose="random prose"),
                Block(type="solution_step", prose="..."),
                Block(type="figure", caption="..."),
            ],
        )
        assert list_problems([sc]) == []

    def test_orders_by_pdf_then_page(self) -> None:
        sidecars = [
            _make_sidecar(
                pdf="b.pdf",
                page=1,
                page_hash="sha256:b1",
                blocks=[Block(type="problem_statement", problem_id="x", prose="b1")],
            ),
            _make_sidecar(
                pdf="a.pdf",
                page=2,
                page_hash="sha256:a2",
                blocks=[Block(type="problem_statement", problem_id="x", prose="a2")],
            ),
            _make_sidecar(
                pdf="a.pdf",
                page=1,
                page_hash="sha256:a1",
                blocks=[Block(type="problem_statement", problem_id="x", prose="a1")],
            ),
        ]
        rows = list_problems(sidecars)
        assert [(r.pdf, r.page) for r in rows] == [("a.pdf", 1), ("a.pdf", 2), ("b.pdf", 1)]

    def test_empty_input_returns_empty(self) -> None:
        assert list_problems([]) == []


# ============== list_pii ===================================================


class TestListPii:
    def test_returns_only_flagged_pages(self) -> None:
        sidecars = [
            _make_sidecar(page=1, needs_redaction_review=True, pii_names=["John"]),
            _make_sidecar(page=2, needs_redaction_review=False, pii_names=["Jane"]),
            _make_sidecar(page=3, needs_redaction_review=True, akwasi_present=True),
        ]
        rows = list_pii(sidecars)
        assert [r.page for r in rows] == [1, 3]

    def test_records_names_and_akwasi_flag(self) -> None:
        sc = _make_sidecar(
            page=7,
            pii_names=["Alice", "Bob"],
            akwasi_present=True,
            needs_redaction_review=True,
        )
        [row] = list_pii([sc])
        assert isinstance(row, PiiListing)
        assert row.page == 7
        assert row.names_detected == ["Alice", "Bob"]
        assert row.akwasi_present is True

    def test_orders_by_pdf_then_page(self) -> None:
        sidecars = [
            _make_sidecar(
                pdf="b.pdf",
                page=1,
                page_hash="sha256:b1",
                needs_redaction_review=True,
                pii_names=["x"],
            ),
            _make_sidecar(
                pdf="a.pdf",
                page=5,
                page_hash="sha256:a5",
                needs_redaction_review=True,
                pii_names=["y"],
            ),
        ]
        rows = list_pii(sidecars)
        assert [r.pdf for r in rows] == ["a.pdf", "b.pdf"]

    def test_empty_input_returns_empty(self) -> None:
        assert list_pii([]) == []


# ============== rank_candidates ============================================


class TestRankCandidates:
    def test_returns_typed_records(self) -> None:
        sc = _make_sidecar(
            blocks=[Block(type="prose", prose="x" * 100)],
            confidence=0.9,
        )
        rows = rank_candidates([sc])
        assert len(rows) == 1
        assert isinstance(rows[0], CandidateListing)
        assert rows[0].page == 1
        assert rows[0].score > 0
        assert isinstance(rows[0].breakdown, dict)
        assert "work_density" in rows[0].breakdown
        assert "confidence" in rows[0].breakdown
        assert "pii_penalty" in rows[0].breakdown

    def test_high_density_outranks_low_density(self) -> None:
        dense = _make_sidecar(
            page=1,
            page_hash="sha256:1",
            blocks=[Block(type="prose", prose="x" * 1000)],
            confidence=0.9,
        )
        sparse = _make_sidecar(
            page=2,
            page_hash="sha256:2",
            blocks=[Block(type="prose", prose="x" * 5)],
            confidence=0.9,
        )
        rows = rank_candidates([sparse, dense])
        assert rows[0].page == 1

    def test_high_confidence_outranks_low_confidence(self) -> None:
        # Same prose density on both pages
        prose = "x" * 200
        high = _make_sidecar(
            page=1,
            page_hash="sha256:1",
            blocks=[Block(type="prose", prose=prose)],
            confidence=0.95,
        )
        low = _make_sidecar(
            page=2,
            page_hash="sha256:2",
            blocks=[Block(type="prose", prose=prose)],
            confidence=0.50,
        )
        rows = rank_candidates([low, high])
        assert rows[0].page == 1

    def test_pii_pages_are_penalized(self) -> None:
        # Otherwise-identical pages — one with PII, one without
        prose = "x" * 200
        clean = _make_sidecar(
            page=1,
            page_hash="sha256:1",
            blocks=[Block(type="prose", prose=prose)],
            confidence=0.9,
        )
        with_pii = _make_sidecar(
            page=2,
            page_hash="sha256:2",
            blocks=[Block(type="prose", prose=prose)],
            confidence=0.9,
            needs_redaction_review=True,
            pii_names=["x"],
        )
        rows = rank_candidates([with_pii, clean])
        assert rows[0].page == 1
        # The PII page still appears in results, just lower-ranked
        assert {r.page for r in rows} == {1, 2}

    def test_respects_limit(self) -> None:
        sidecars = [
            _make_sidecar(
                page=i,
                page_hash=f"sha256:{i:064d}",
                blocks=[Block(type="prose", prose="x" * (10 * (i + 1)))],
                confidence=0.9,
            )
            for i in range(20)
        ]
        rows = rank_candidates(sidecars, limit=5)
        assert len(rows) == 5
        # Top-5 by density should be pages 19, 18, 17, 16, 15
        assert [r.page for r in rows] == [19, 18, 17, 16, 15]

    def test_ignores_empty_pages(self) -> None:
        sc = _make_sidecar(blocks=[])
        rows = rank_candidates([sc])
        # Empty pages aren't candidates — score 0 means excluded
        assert rows == []

    def test_breakdown_components_sum_to_score(self) -> None:
        sc = _make_sidecar(
            blocks=[Block(type="prose", prose="x" * 100)],
            confidence=0.8,
            needs_redaction_review=True,
            pii_names=["x"],
        )
        [row] = rank_candidates([sc])
        b = row.breakdown
        assert row.score == pytest.approx(
            b["work_density"] + b["confidence"] - b["pii_penalty"]
        )
