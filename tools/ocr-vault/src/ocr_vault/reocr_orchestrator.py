"""Re-OCR orchestrator (closes #40 — runner side).

Composes ``provider`` + ``CostLedger`` + ``SqliteIndex`` + cached
page-images into the actual re-extraction pipeline. The ``ReocrPlanner``
upstream decides which pages to re-OCR; this module performs the work
and (optionally) versions prior sidecars.

For each ``PlannedPage``:

  1. Read cached PNG from ``data/page-images/<course>/<pdf-stem>/page-N.png``.
     If missing, skip with a warning (the page was never `add`'d, so the
     orchestrator has nothing to feed the provider).
  2. Call the provider once.
  3. If ``keep_history``: rename the live sidecar to
     ``page-N.v<old-version>.json``.
  4. Write the new sidecar (overwriting the live file).
  5. Log the call to the SQLite ledger with ``is_re_ocr=True``.
  6. Upsert the index + FTS5 rows.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Final

from ocr_vault.add_orchestrator import (
    DEFAULT_CONFIDENCE,
    DEFAULT_PROMPT,
    OCR_VERSION,
)
from ocr_vault.cost_calculator import CostBreakdown
from ocr_vault.cost_ledger import BudgetExceededError, CostLedger
from ocr_vault.pii_detector import detect_pii
from ocr_vault.provider import OCRProvider, ProviderResponse
from ocr_vault.reocr_planner import PlannedPage
from ocr_vault.sidecar_schema import validate_sidecar
from ocr_vault.sqlite_index import SqliteIndex

DEFAULT_OWNER_NAME: Final[str] = "Akwasi Akosah"


class ReocrOrchestratorError(RuntimeError):
    """Raised when re-ocr cannot proceed."""


@dataclass(frozen=True, slots=True)
class ReocrResult:
    pages_redone: int
    pages_skipped: int
    cost_total_usd: Decimal


@dataclass(frozen=True, slots=True)
class ReocrOrchestrator:
    provider: OCRProvider
    ledger: CostLedger
    index: SqliteIndex
    data_dir: Path
    ocr_version: str = OCR_VERSION
    provider_family: str = "mock"
    owner_name: str = DEFAULT_OWNER_NAME

    # ─── public entrypoint ─────────────────────────────────────────────

    def run(
        self,
        pages: Sequence[PlannedPage],
        *,
        keep_history: bool,
    ) -> ReocrResult:
        redone = 0
        skipped = 0
        cost_total = Decimal("0")

        for planned in pages:
            image_bytes = self._load_cached_page_image(planned)
            if image_bytes is None:
                skipped += 1
                continue

            response = self.provider.call(image_bytes, DEFAULT_PROMPT)
            sidecar_payload = self._build_sidecar_payload(
                planned=planned, response=response
            )

            self._record_in_ledger(
                response=response, course_slug=planned.course
            )
            cost_total += response.cost_usd

            self._write_sidecar(
                planned=planned,
                sidecar_payload=sidecar_payload,
                keep_history=keep_history,
            )
            self._update_index(
                planned=planned,
                sidecar_payload=sidecar_payload,
                response=response,
            )
            redone += 1

        return ReocrResult(
            pages_redone=redone,
            pages_skipped=skipped,
            cost_total_usd=cost_total,
        )

    # ─── helpers ───────────────────────────────────────────────────────

    def _sidecar_path(self, planned: PlannedPage) -> Path:
        pdf_stem = Path(planned.sidecar.source.pdf).stem
        return (
            self.data_dir
            / "sidecars"
            / planned.course
            / pdf_stem
            / f"page-{planned.sidecar.source.page}.json"
        )

    def _image_path(self, planned: PlannedPage) -> Path:
        pdf_stem = Path(planned.sidecar.source.pdf).stem
        return (
            self.data_dir
            / "page-images"
            / planned.course
            / pdf_stem
            / f"page-{planned.sidecar.source.page}.png"
        )

    def _load_cached_page_image(self, planned: PlannedPage) -> bytes | None:
        path = self._image_path(planned)
        if not path.exists():
            return None
        return path.read_bytes()

    def _build_sidecar_payload(
        self, *, planned: PlannedPage, response: ProviderResponse
    ) -> dict[str, object]:
        pii_report = detect_pii(response.raw_text, owner_name=self.owner_name)
        payload: dict[str, object] = {
            "source": {
                "pdf": planned.sidecar.source.pdf,
                "page": planned.sidecar.source.page,
                "page_hash": planned.sidecar.source.page_hash,
            },
            "extracted": {
                "blocks": [
                    {
                        "type": "prose",
                        "prose": response.raw_text,
                        "latex": "",
                    }
                ],
                "topics": [],
                "confidence": DEFAULT_CONFIDENCE,
                "needs_review": False,
            },
            "pii": {
                "names_detected": pii_report.names_detected,
                "akwasi_present": pii_report.owner_present,
                "needs_redaction_review": pii_report.needs_redaction_review,
            },
            "model": {
                "provider": self.provider_family,
                "model_id": response.model_id,
                "ocr_version": self.ocr_version,
            },
        }
        validate_sidecar(payload)
        return payload

    def _record_in_ledger(
        self, *, response: ProviderResponse, course_slug: str
    ) -> None:
        breakdown = CostBreakdown(
            input_usd=Decimal("0"),
            output_usd=Decimal("0"),
            total_usd=response.cost_usd,
        )
        try:
            self.ledger.record(
                course=course_slug,
                model=response.model_id,
                input_tokens=response.input_tokens,
                output_tokens=response.output_tokens,
                cost=breakdown,
                is_re_ocr=True,
            )
        except BudgetExceededError as e:
            raise ReocrOrchestratorError(str(e)) from e

    def _write_sidecar(
        self,
        *,
        planned: PlannedPage,
        sidecar_payload: dict[str, object],
        keep_history: bool,
    ) -> None:
        sidecar_path = self._sidecar_path(planned)
        sidecar_path.parent.mkdir(parents=True, exist_ok=True)

        if keep_history and sidecar_path.exists():
            old_version = planned.sidecar.model.ocr_version
            archive_path = (
                sidecar_path.with_suffix("")
            ).with_name(f"page-{planned.sidecar.source.page}.v{old_version}.json")
            sidecar_path.rename(archive_path)

        sidecar_path.write_text(
            json.dumps(sidecar_payload, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _update_index(
        self,
        *,
        planned: PlannedPage,
        sidecar_payload: dict[str, object],
        response: ProviderResponse,
    ) -> None:
        page = planned.sidecar.source.page
        self.index.upsert_page(
            page_hash=planned.sidecar.source.page_hash,
            course=planned.course,
            pdf=planned.sidecar.source.pdf,
            page=page,
            confidence=float(sidecar_payload["extracted"]["confidence"]),  # type: ignore[index]
            needs_review=sidecar_payload["extracted"]["needs_review"],  # type: ignore[index]
            needs_redaction_review=sidecar_payload["pii"][  # type: ignore[index]
                "needs_redaction_review"
            ],
        )
        self.index.log_call(
            timestamp=datetime.now(UTC),
            course=planned.course,
            model=response.model_id,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            cost_usd=response.cost_usd,
            is_re_ocr=True,
        )
        self.index.index_sidecar(
            course=planned.course,
            sidecar=validate_sidecar(sidecar_payload),
        )
