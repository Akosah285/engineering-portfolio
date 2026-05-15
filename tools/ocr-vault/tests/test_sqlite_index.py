"""Tests for the SQLite index module.

The SQLite index is the durable read-side view of the OCR data: per-page
records (page_hash, course, pdf, confidence, etc.) and per-call cost
ledger entries. Sidecars on disk remain the canonical source; SQLite is
the queryable cache.

Tests use ``:memory:`` for speed; production opens a file in
``data/index.sqlite``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from ocr_vault.sqlite_index import SqliteIndex, SqliteIndexError


# ───────────────── schema + connection ─────────────────────────────────────


class TestConnectionAndSchema:
    def test_open_in_memory_succeeds(self) -> None:
        idx = SqliteIndex.open(":memory:")
        assert idx is not None
        idx.close()

    def test_open_creates_schema(self) -> None:
        idx = SqliteIndex.open(":memory:")
        tables = idx.list_tables()
        assert "pages" in tables
        assert "api_calls" in tables
        idx.close()

    def test_open_on_real_path_persists(self, tmp_path: Path) -> None:
        db_path = tmp_path / "index.sqlite"
        idx = SqliteIndex.open(db_path)
        idx.upsert_page(
            page_hash="sha256:abc",
            course="ml",
            pdf="hw1.pdf",
            page=1,
            confidence=0.9,
            needs_review=False,
            needs_redaction_review=False,
        )
        idx.close()

        # Reopen and read back.
        idx2 = SqliteIndex.open(db_path)
        page = idx2.get_page("sha256:abc")
        assert page is not None
        assert page["course"] == "ml"
        idx2.close()


# ───────────────── pages table ─────────────────────────────────────────────


class TestPagesTable:
    def test_upsert_then_get(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.upsert_page(
            page_hash="sha256:abc",
            course="ml",
            pdf="hw1.pdf",
            page=1,
            confidence=0.85,
            needs_review=False,
            needs_redaction_review=False,
        )
        got = idx.get_page("sha256:abc")
        assert got is not None
        assert got["page_hash"] == "sha256:abc"
        assert got["course"] == "ml"
        assert got["pdf"] == "hw1.pdf"
        assert got["page"] == 1
        assert got["confidence"] == pytest.approx(0.85)
        assert got["needs_review"] is False
        idx.close()

    def test_get_missing_returns_none(self) -> None:
        idx = SqliteIndex.open(":memory:")
        assert idx.get_page("sha256:nope") is None
        idx.close()

    def test_has_page_hash(self) -> None:
        idx = SqliteIndex.open(":memory:")
        assert idx.has_page("sha256:abc") is False
        idx.upsert_page(
            page_hash="sha256:abc",
            course="ml",
            pdf="hw1.pdf",
            page=1,
            confidence=0.85,
            needs_review=False,
            needs_redaction_review=False,
        )
        assert idx.has_page("sha256:abc") is True
        idx.close()

    def test_upsert_is_idempotent(self) -> None:
        idx = SqliteIndex.open(":memory:")
        for _ in range(3):
            idx.upsert_page(
                page_hash="sha256:abc",
                course="ml",
                pdf="hw1.pdf",
                page=1,
                confidence=0.85,
                needs_review=False,
                needs_redaction_review=False,
            )
        assert idx.count_pages() == 1
        idx.close()

    def test_upsert_updates_existing(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.upsert_page(
            page_hash="sha256:abc",
            course="ml",
            pdf="hw1.pdf",
            page=1,
            confidence=0.5,
            needs_review=False,
            needs_redaction_review=False,
        )
        idx.upsert_page(
            page_hash="sha256:abc",
            course="ml",
            pdf="hw1.pdf",
            page=1,
            confidence=0.95,
            needs_review=False,
            needs_redaction_review=False,
        )
        got = idx.get_page("sha256:abc")
        assert got is not None
        assert got["confidence"] == pytest.approx(0.95)
        idx.close()

    def test_count_pages(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.upsert_page(
            page_hash="sha256:a", course="ml", pdf="hw1.pdf", page=1,
            confidence=0.9, needs_review=False, needs_redaction_review=False,
        )
        idx.upsert_page(
            page_hash="sha256:b", course="ml", pdf="hw1.pdf", page=2,
            confidence=0.7, needs_review=False, needs_redaction_review=False,
        )
        idx.upsert_page(
            page_hash="sha256:c", course="fourier", pdf="hw2.pdf", page=1,
            confidence=0.8, needs_review=True, needs_redaction_review=False,
        )
        assert idx.count_pages() == 3
        idx.close()

    def test_pages_by_course(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.upsert_page(
            page_hash="sha256:a", course="ml", pdf="hw1.pdf", page=1,
            confidence=0.9, needs_review=False, needs_redaction_review=False,
        )
        idx.upsert_page(
            page_hash="sha256:b", course="ml", pdf="hw1.pdf", page=2,
            confidence=0.7, needs_review=False, needs_redaction_review=False,
        )
        idx.upsert_page(
            page_hash="sha256:c", course="fourier", pdf="hw2.pdf", page=1,
            confidence=0.8, needs_review=False, needs_redaction_review=False,
        )
        ml_pages = idx.pages_by_course("ml")
        assert len(ml_pages) == 2
        assert {p["page_hash"] for p in ml_pages} == {"sha256:a", "sha256:b"}
        idx.close()

    def test_low_confidence_pages_strict_threshold(self) -> None:
        idx = SqliteIndex.open(":memory:")
        for ph, conf in [("a", 0.9), ("b", 0.5), ("c", 0.69), ("d", 0.7)]:
            idx.upsert_page(
                page_hash=f"sha256:{ph}", course="ml", pdf="x.pdf", page=1,
                confidence=conf, needs_review=False, needs_redaction_review=False,
            )
        low = idx.low_confidence_pages("ml", threshold=0.7)
        # 0.7 is NOT low (strict <).
        assert {p["page_hash"] for p in low} == {"sha256:b", "sha256:c"}
        idx.close()


# ───────────────── api_calls table ─────────────────────────────────────────


class TestApiCallsTable:
    def test_log_call_records_entry(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.log_call(
            timestamp=datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
            course="ml",
            model="claude-sonnet-4.5",
            input_tokens=100,
            output_tokens=200,
            cost_usd=Decimal("0.05"),
            is_re_ocr=False,
        )
        assert idx.count_calls() == 1
        idx.close()

    def test_total_cost_sums_calls(self) -> None:
        idx = SqliteIndex.open(":memory:")
        for cost in [Decimal("0.05"), Decimal("0.10"), Decimal("0.02")]:
            idx.log_call(
                timestamp=datetime.now(timezone.utc),
                course="ml",
                model="claude-sonnet-4.5",
                input_tokens=100,
                output_tokens=200,
                cost_usd=cost,
                is_re_ocr=False,
            )
        assert idx.total_cost_usd() == Decimal("0.17")
        idx.close()

    def test_cost_by_course(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.log_call(
            timestamp=datetime.now(timezone.utc), course="ml",
            model="claude", input_tokens=10, output_tokens=20,
            cost_usd=Decimal("0.05"), is_re_ocr=False,
        )
        idx.log_call(
            timestamp=datetime.now(timezone.utc), course="ml",
            model="claude", input_tokens=10, output_tokens=20,
            cost_usd=Decimal("0.10"), is_re_ocr=False,
        )
        idx.log_call(
            timestamp=datetime.now(timezone.utc), course="fourier",
            model="claude", input_tokens=10, output_tokens=20,
            cost_usd=Decimal("0.02"), is_re_ocr=False,
        )
        by_course = idx.cost_by_course()
        assert by_course == {"ml": Decimal("0.15"), "fourier": Decimal("0.02")}
        idx.close()

    def test_re_ocr_calls_separable(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.log_call(
            timestamp=datetime.now(timezone.utc), course="ml",
            model="claude", input_tokens=10, output_tokens=20,
            cost_usd=Decimal("0.05"), is_re_ocr=False,
        )
        idx.log_call(
            timestamp=datetime.now(timezone.utc), course="ml",
            model="claude", input_tokens=10, output_tokens=20,
            cost_usd=Decimal("0.03"), is_re_ocr=True,
        )
        assert idx.total_cost_usd() == Decimal("0.08")
        assert idx.total_re_ocr_cost_usd() == Decimal("0.03")
        assert idx.total_initial_cost_usd() == Decimal("0.05")
        idx.close()


# ───────────────── error handling ──────────────────────────────────────────


class TestErrorHandling:
    def test_use_after_close_raises(self) -> None:
        idx = SqliteIndex.open(":memory:")
        idx.close()
        with pytest.raises(SqliteIndexError):
            idx.count_pages()

    def test_negative_confidence_rejected(self) -> None:
        idx = SqliteIndex.open(":memory:")
        with pytest.raises(ValueError):
            idx.upsert_page(
                page_hash="sha256:bad", course="ml", pdf="x.pdf", page=1,
                confidence=-0.1, needs_review=False, needs_redaction_review=False,
            )
        idx.close()

    def test_confidence_above_one_rejected(self) -> None:
        idx = SqliteIndex.open(":memory:")
        with pytest.raises(ValueError):
            idx.upsert_page(
                page_hash="sha256:bad", course="ml", pdf="x.pdf", page=1,
                confidence=1.5, needs_review=False, needs_redaction_review=False,
            )
        idx.close()
