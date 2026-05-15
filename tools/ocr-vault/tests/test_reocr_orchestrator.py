"""Tests for the re-ocr orchestrator (closes #40 — runner only).

Behavior tests over a synthetic provider + in-memory index. The
orchestrator takes a list of ``PlannedPage`` and a function that returns
the image bytes for each page, then re-OCRs each, writing the new
sidecar (overwrite or versioned) and tagging the call as is_re_ocr=True.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from decimal import Decimal
from pathlib import Path

import pytest

from ocr_vault.cost_ledger import CostLedger
from ocr_vault.provider import ProviderResponse
from ocr_vault.reocr_orchestrator import (
    ReocrOrchestrator,
    ReocrResult,
)
from ocr_vault.reocr_planner import PlannedPage
from ocr_vault.sidecar_schema import (
    Block,
    Extracted,
    Model,
    Pii,
    Sidecar,
    Source,
)
from ocr_vault.sqlite_index import SqliteIndex


class _FakeProvider:
    """OCR provider that returns deterministic mock responses."""

    model_id = "mock-reocr-1"

    def __init__(self, *, raw_text: str = "re-OCR'd content") -> None:
        self.calls = 0
        self.raw_text = raw_text

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse:
        self.calls += 1
        return ProviderResponse(
            raw_text=self.raw_text,
            model_id=self.model_id,
            input_tokens=100,
            output_tokens=50,
            cost_usd=Decimal("0.01"),
        )


def _make_sidecar(
    *, page: int = 1, page_hash: str = "sha256:1", ocr_version: str = "0.9.0"
) -> Sidecar:
    return Sidecar(
        source=Source(pdf="hw1.pdf", page=page, page_hash=page_hash),
        extracted=Extracted(
            blocks=[Block(type="prose", prose="OLD content")],
            topics=[],
            confidence=0.5,
            needs_review=True,
        ),
        pii=Pii(names_detected=[], akwasi_present=False, needs_redaction_review=False),
        model=Model(provider="mock", model_id="mock-old", ocr_version=ocr_version),
    )


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """A data/ root with one stale sidecar + cached page image."""
    sidecar_dir = tmp_path / "sidecars" / "ml" / "hw1"
    image_dir = tmp_path / "page-images" / "ml" / "hw1"
    sidecar_dir.mkdir(parents=True)
    image_dir.mkdir(parents=True)
    (sidecar_dir / "page-1.json").write_text(
        json.dumps(
            {
                "source": {
                    "pdf": "hw1.pdf",
                    "page": 1,
                    "page_hash": "sha256:p1",
                },
                "extracted": {
                    "blocks": [{"type": "prose", "prose": "OLD", "latex": ""}],
                    "topics": [],
                    "confidence": 0.5,
                    "needs_review": True,
                },
                "pii": {
                    "names_detected": [],
                    "akwasi_present": False,
                    "needs_redaction_review": False,
                },
                "model": {
                    "provider": "mock",
                    "model_id": "mock-old",
                    "ocr_version": "0.9.0",
                },
            },
            indent=2,
        )
    )
    (image_dir / "page-1.png").write_bytes(b"fake_image_bytes_for_page_1")
    return tmp_path


@pytest.fixture
def index(data_dir: Path) -> SqliteIndex:
    idx = SqliteIndex.open(data_dir / "index.sqlite")
    yield idx
    idx.close()


def _planned_pages(course: str, sidecars: Sequence[Sidecar]) -> list[PlannedPage]:
    return [PlannedPage(course=course, sidecar=sc, reason="test") for sc in sidecars]


# ─────────────── core run ──────────────────────────────────────────────────


class TestReocrRun:
    def test_overwrites_sidecar_by_default(
        self, data_dir: Path, index: SqliteIndex
    ) -> None:
        provider = _FakeProvider(raw_text="NEW content")
        orch = ReocrOrchestrator(
            provider=provider,
            ledger=CostLedger(
                hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10")
            ),
            index=index,
            data_dir=data_dir,
            ocr_version="1.1.0",
            provider_family="mock",
        )

        pages = _planned_pages("ml", [_make_sidecar(page=1, page_hash="sha256:p1")])
        result = orch.run(pages, keep_history=False)

        assert isinstance(result, ReocrResult)
        assert result.pages_redone == 1
        assert provider.calls == 1
        # Sidecar overwritten in place — no .vN.json file.
        sidecar_dir = data_dir / "sidecars" / "ml" / "hw1"
        assert (sidecar_dir / "page-1.json").exists()
        assert not list(sidecar_dir.glob("page-1.v*.json"))
        # Content updated to the provider's new prose.
        new_payload = json.loads((sidecar_dir / "page-1.json").read_text())
        assert "NEW" in new_payload["extracted"]["blocks"][0]["prose"]
        # ocr_version bumped.
        assert new_payload["model"]["ocr_version"] == "1.1.0"

    def test_keep_history_writes_versioned_archive(
        self, data_dir: Path, index: SqliteIndex
    ) -> None:
        provider = _FakeProvider(raw_text="NEW content")
        orch = ReocrOrchestrator(
            provider=provider,
            ledger=CostLedger(
                hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10")
            ),
            index=index,
            data_dir=data_dir,
            ocr_version="1.1.0",
            provider_family="mock",
        )

        pages = _planned_pages("ml", [_make_sidecar(page=1, page_hash="sha256:p1")])
        result = orch.run(pages, keep_history=True)

        assert result.pages_redone == 1
        sidecar_dir = data_dir / "sidecars" / "ml" / "hw1"
        # Versioned snapshot of the OLD sidecar, by old ocr_version.
        archive = sidecar_dir / "page-1.v0.9.0.json"
        assert archive.exists()
        old_payload = json.loads(archive.read_text())
        assert old_payload["extracted"]["blocks"][0]["prose"] == "OLD"
        # Live sidecar is the new one.
        live = json.loads((sidecar_dir / "page-1.json").read_text())
        assert "NEW" in live["extracted"]["blocks"][0]["prose"]

    def test_logs_call_as_is_re_ocr_true(
        self, data_dir: Path, index: SqliteIndex
    ) -> None:
        provider = _FakeProvider()
        orch = ReocrOrchestrator(
            provider=provider,
            ledger=CostLedger(
                hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10")
            ),
            index=index,
            data_dir=data_dir,
            ocr_version="1.1.0",
            provider_family="mock",
        )
        pages = _planned_pages("ml", [_make_sidecar(page=1, page_hash="sha256:p1")])
        orch.run(pages, keep_history=False)

        # Cost ledger: re-ocr total picks up the call.
        assert index.total_re_ocr_cost_usd() > Decimal("0")
        # Initial pass total stays at zero (we only ran a re-ocr).
        assert index.total_initial_cost_usd() == Decimal("0")

    def test_returns_zero_pages_when_plan_is_empty(
        self, data_dir: Path, index: SqliteIndex
    ) -> None:
        provider = _FakeProvider()
        orch = ReocrOrchestrator(
            provider=provider,
            ledger=CostLedger(
                hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10")
            ),
            index=index,
            data_dir=data_dir,
            ocr_version="1.1.0",
            provider_family="mock",
        )
        result = orch.run([], keep_history=False)
        assert result.pages_redone == 0
        assert provider.calls == 0

    def test_missing_image_skips_page_with_warning(
        self, data_dir: Path, index: SqliteIndex
    ) -> None:
        provider = _FakeProvider()
        orch = ReocrOrchestrator(
            provider=provider,
            ledger=CostLedger(
                hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10")
            ),
            index=index,
            data_dir=data_dir,
            ocr_version="1.1.0",
            provider_family="mock",
        )
        # Planned page references a sidecar whose page-image does NOT exist.
        sc = _make_sidecar(page=99, page_hash="sha256:missing")
        result = orch.run(_planned_pages("ml", [sc]), keep_history=False)
        assert result.pages_redone == 0
        assert result.pages_skipped == 1
        assert provider.calls == 0
