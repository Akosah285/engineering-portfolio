"""Tests for the add_orchestrator — composes the whole OCR add flow.

The orchestrator is the integration piece that ties together pdf_loader,
provider, cost_calculator, cost_ledger, pii_detector, sidecar_schema,
sqlite_index, and the on-disk sidecar/page-image layout.

Tests inject MockPdfLoader + MockProvider so no network or PDF deps are
required.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ocr_vault.add_orchestrator import (
    AddOrchestrator,
    AddResult,
    OrchestratorError,
)
from ocr_vault.cost_ledger import CostLedger
from ocr_vault.pdf_loader import MockPdfLoader, PageImage
from ocr_vault.provider import MockProvider, ProviderResponse
from ocr_vault.sqlite_index import SqliteIndex


from decimal import Decimal


def _ledger() -> CostLedger:
    return CostLedger(
        hard_cap_usd=Decimal("50"),
        soft_warn_usd=Decimal("10"),
    )


def _orchestrator(
    tmp_path: Path,
    *,
    pdf_loader: MockPdfLoader | None = None,
    provider: MockProvider | None = None,
    ledger: CostLedger | None = None,
    index: SqliteIndex | None = None,
) -> AddOrchestrator:
    return AddOrchestrator(
        pdf_loader=pdf_loader or MockPdfLoader(page_count=3),
        provider=provider or MockProvider(),
        ledger=ledger or _ledger(),
        index=index or SqliteIndex.open(":memory:"),
        data_dir=tmp_path / "data",
    )


# ───────────────── happy path ──────────────────────────────────────────────


class TestHappyPath:
    def test_returns_add_result(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path)
        result = orch.run(
            pdf_path=tmp_path / "hw1.pdf", course_slug="machine-learning"
        )
        assert isinstance(result, AddResult)

    def test_writes_one_sidecar_per_page(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=3))
        orch.run(
            pdf_path=tmp_path / "hw1.pdf", course_slug="machine-learning"
        )
        sidecar_dir = tmp_path / "data" / "sidecars" / "machine-learning" / "hw1"
        files = sorted(sidecar_dir.glob("page-*.json"))
        assert [f.name for f in files] == [
            "page-1.json",
            "page-2.json",
            "page-3.json",
        ]

    def test_writes_one_page_image_per_page(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=2))
        orch.run(
            pdf_path=tmp_path / "hw1.pdf", course_slug="machine-learning"
        )
        image_dir = tmp_path / "data" / "page-images" / "machine-learning" / "hw1"
        files = sorted(image_dir.glob("page-*.png"))
        assert [f.name for f in files] == ["page-1.png", "page-2.png"]

    def test_sidecar_validates_against_schema(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=1))
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        sidecar = json.loads(
            (
                tmp_path / "data" / "sidecars" / "ml" / "hw1" / "page-1.json"
            ).read_text()
        )
        # Top-level keys.
        for key in ("source", "extracted", "pii", "model"):
            assert key in sidecar
        assert sidecar["source"]["page"] == 1
        assert sidecar["source"]["pdf"] == "hw1.pdf"
        assert sidecar["source"]["page_hash"].startswith("sha256:")

    def test_result_counts_pages(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=4))
        result = orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert result.pages_processed == 4
        assert result.pages_cached == 0

    def test_logs_one_api_call_per_page_in_index(self, tmp_path: Path) -> None:
        index = SqliteIndex.open(":memory:")
        orch = _orchestrator(
            tmp_path, pdf_loader=MockPdfLoader(page_count=3), index=index
        )
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert index.count_calls() == 3

    def test_index_has_one_row_per_page(self, tmp_path: Path) -> None:
        index = SqliteIndex.open(":memory:")
        orch = _orchestrator(
            tmp_path, pdf_loader=MockPdfLoader(page_count=3), index=index
        )
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert index.count_pages() == 3
        assert len(index.pages_by_course("ml")) == 3


# ───────────────── idempotency (cache hit by page_hash) ────────────────────


class TestIdempotency:
    def test_second_run_uses_cache(self, tmp_path: Path) -> None:
        """Re-running with same PDF -> zero new API calls (acceptance criterion)."""
        index = SqliteIndex.open(":memory:")
        provider = MockProvider()
        orch_kwargs = {
            "pdf_loader": MockPdfLoader(page_count=2),
            "provider": provider,
            "index": index,
        }
        # First run.
        orch1 = _orchestrator(tmp_path, **orch_kwargs)
        result1 = orch1.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert result1.pages_processed == 2
        assert provider.call_count == 2

        # Second run with same inputs.
        orch2 = _orchestrator(tmp_path, **orch_kwargs)
        result2 = orch2.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert result2.pages_cached == 2
        assert result2.pages_processed == 0
        # Provider must NOT be called again.
        assert provider.call_count == 2

    def test_index_unchanged_after_cached_run(self, tmp_path: Path) -> None:
        index = SqliteIndex.open(":memory:")
        provider = MockProvider()
        orch_kwargs = {
            "pdf_loader": MockPdfLoader(page_count=2),
            "provider": provider,
            "index": index,
        }
        orch = _orchestrator(tmp_path, **orch_kwargs)
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        first_calls = index.count_calls()

        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        assert index.count_calls() == first_calls

    def test_changed_pdf_bytes_treated_as_new(self, tmp_path: Path) -> None:
        """Different mock content per page => different page_hash => no cache hit."""
        index = SqliteIndex.open(":memory:")
        provider = MockProvider()
        # First PDF: 2 pages from a.pdf (one page_hash).
        orch_a = _orchestrator(
            tmp_path,
            pdf_loader=MockPdfLoader(page_count=2),
            provider=provider,
            index=index,
        )
        orch_a.run(pdf_path=tmp_path / "a.pdf", course_slug="ml")
        assert provider.call_count == 2

        # Second PDF: same mock loader but DIFFERENT pdf_path -> different bytes
        # -> different page_hashes -> not cached.
        orch_b = _orchestrator(
            tmp_path,
            pdf_loader=MockPdfLoader(page_count=2),
            provider=provider,
            index=index,
        )
        orch_b.run(pdf_path=tmp_path / "b.pdf", course_slug="ml")
        assert provider.call_count == 4


# ───────────────── PII population ──────────────────────────────────────────


class TestPiiPopulation:
    def test_pii_block_present_on_every_sidecar(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=2))
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")

        for page in (1, 2):
            sidecar = json.loads(
                (
                    tmp_path / "data" / "sidecars" / "ml" / "hw1" / f"page-{page}.json"
                ).read_text()
            )
            assert "pii" in sidecar
            assert "names_detected" in sidecar["pii"]
            assert "akwasi_present" in sidecar["pii"]
            assert "needs_redaction_review" in sidecar["pii"]
            assert isinstance(sidecar["pii"]["akwasi_present"], bool)


# ───────────────── cost cap enforcement ────────────────────────────────────


class TestCostCap:
    def test_hard_cap_stops_orchestrator(self, tmp_path: Path) -> None:
        # Tiny hard cap; the second page should trip it.
        tiny_ledger = CostLedger(
            hard_cap_usd=Decimal("0.001"),
            soft_warn_usd=Decimal("0"),
        )
        # Canned response with non-trivial cost.
        canned = ProviderResponse(
            raw_text="hello",
            input_tokens=10000,
            output_tokens=10000,
            cost_usd=Decimal("0.05"),
            model_id="mock-vision-v1",
        )
        provider = MockProvider(canned_response=canned)
        orch = _orchestrator(
            tmp_path,
            pdf_loader=MockPdfLoader(page_count=3),
            provider=provider,
            ledger=tiny_ledger,
        )
        with pytest.raises(OrchestratorError):
            orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")


# ───────────────── provider model identifier ───────────────────────────────


class TestProviderMetadata:
    def test_sidecar_records_provider_and_model(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path, pdf_loader=MockPdfLoader(page_count=1))
        orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="ml")
        sidecar = json.loads(
            (
                tmp_path / "data" / "sidecars" / "ml" / "hw1" / "page-1.json"
            ).read_text()
        )
        assert sidecar["model"]["provider"]  # non-empty
        assert sidecar["model"]["model_id"] == "mock-vision-v1"
        assert sidecar["model"]["ocr_version"]


# ───────────────── inputs validation ───────────────────────────────────────


class TestInputValidation:
    def test_invalid_course_slug_rejected(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path)
        with pytest.raises(OrchestratorError):
            orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="Machine Learning!")

    def test_empty_course_slug_rejected(self, tmp_path: Path) -> None:
        orch = _orchestrator(tmp_path)
        with pytest.raises(OrchestratorError):
            orch.run(pdf_path=tmp_path / "hw1.pdf", course_slug="")
