"""Orchestrator for ``ocr-vault add``.

Composes pdf_loader + provider + cost_ledger + page_hash + sidecar_schema
+ pii_detector + sqlite_index into a single ``run`` call:

1. For each page yielded by ``pdf_loader.iter_pages``:
   a. Compute ``page_hash`` from image_bytes.
   b. Cache check: if ``sqlite_index.has_page(page_hash)``, skip the call.
   c. Otherwise call ``provider.call`` → build sidecar dict → validate via
      sidecar_schema → write JSON + PNG to disk → upsert the SQLite index
      and log the API call.
2. Return ``AddResult`` summarising the run.

The orchestrator is the v0 integration piece. Real PDF rendering, ``--parallel``
fan-out, exponential backoff on 429s, Rich progress bars, and DOCX /
pdfplumber auto-routing all land in follow-ups — see plan §2.3 and #36.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Final

from ocr_vault.cost_calculator import CostBreakdown
from ocr_vault.cost_ledger import BudgetExceededError, CostLedger
from ocr_vault.page_hash import page_hash as compute_page_hash
from ocr_vault.pdf_loader import PageImage, PdfLoader
from ocr_vault.pii_detector import detect_pii
from ocr_vault.provider import OCRProvider, ProviderResponse
from ocr_vault.sidecar_schema import validate_sidecar
from ocr_vault.sqlite_index import SqliteIndex

OCR_VERSION: Final[str] = "1.0.0"
DEFAULT_OWNER_NAME: Final[str] = "Akwasi Akosah"
DEFAULT_CONFIDENCE: Final[float] = 0.9
DEFAULT_PROMPT: Final[str] = (
    "Transcribe this page of handwritten engineering coursework. "
    "Output prose, LaTeX for math, and identify problem statements vs solution steps."
)

_SLUG_RE: Final[re.Pattern[str]] = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class OrchestratorError(RuntimeError):
    """Raised when the orchestrator cannot complete the add run."""


@dataclass(frozen=True, slots=True)
class AddResult:
    """Summary of a single ``ocr-vault add`` invocation."""

    pages_processed: int
    pages_cached: int
    cost_total_usd: Decimal
    pages_needs_review: int
    pages_needs_redaction: int


@dataclass(frozen=True, slots=True)
class AddOrchestrator:
    """Stateless composer (collaborators are injected and re-usable)."""

    pdf_loader: PdfLoader
    provider: OCRProvider
    ledger: CostLedger
    index: SqliteIndex
    data_dir: Path
    owner_name: str = DEFAULT_OWNER_NAME
    ocr_version: str = OCR_VERSION
    provider_family: str = "mock"

    # ─── public entry point ────────────────────────────────────────────

    def run(self, *, pdf_path: Path, course_slug: str) -> AddResult:
        """Run the add pipeline for one PDF.

        Raises:
            OrchestratorError: On invalid inputs or when the cost cap fires.
        """
        self._validate_inputs(pdf_path=pdf_path, course_slug=course_slug)

        pdf_stem = pdf_path.stem
        sidecar_dir = self.data_dir / "sidecars" / course_slug / pdf_stem
        image_dir = self.data_dir / "page-images" / course_slug / pdf_stem
        sidecar_dir.mkdir(parents=True, exist_ok=True)
        image_dir.mkdir(parents=True, exist_ok=True)

        pages_processed = 0
        pages_cached = 0
        pages_needs_review = 0
        pages_needs_redaction = 0
        cost_total = Decimal("0")

        for page_image in self.pdf_loader.iter_pages(pdf_path):
            ph = compute_page_hash(page_image.image_bytes)
            if self.index.has_page(ph):
                pages_cached += 1
                continue

            response, sidecar_payload = self._ocr_one_page(
                page_image=page_image,
                page_hash_str=ph,
                pdf_name=pdf_path.name,
                course_slug=course_slug,
            )

            self._record_in_ledger(
                response=response, course_slug=course_slug
            )
            cost_total += response.cost_usd

            self._write_outputs(
                sidecar_dir=sidecar_dir,
                image_dir=image_dir,
                page=page_image.page,
                image_bytes=page_image.image_bytes,
                sidecar_payload=sidecar_payload,
            )
            self._update_index(
                page_hash_str=ph,
                course_slug=course_slug,
                pdf_name=pdf_path.name,
                page=page_image.page,
                sidecar_payload=sidecar_payload,
                response=response,
            )

            pages_processed += 1
            extracted = sidecar_payload["extracted"]
            pii = sidecar_payload["pii"]
            assert isinstance(extracted, dict)
            assert isinstance(pii, dict)
            if extracted["needs_review"]:
                pages_needs_review += 1
            if pii["needs_redaction_review"]:
                pages_needs_redaction += 1

        return AddResult(
            pages_processed=pages_processed,
            pages_cached=pages_cached,
            cost_total_usd=cost_total,
            pages_needs_review=pages_needs_review,
            pages_needs_redaction=pages_needs_redaction,
        )

    # ─── helpers ───────────────────────────────────────────────────────

    def _validate_inputs(self, *, pdf_path: Path, course_slug: str) -> None:
        if not course_slug:
            raise OrchestratorError("course_slug must be non-empty")
        if not _SLUG_RE.fullmatch(course_slug):
            raise OrchestratorError(
                f"course_slug {course_slug!r} must be lowercase kebab-case "
                "(matching /^[a-z0-9]+(-[a-z0-9]+)*$/)"
            )

    def _ocr_one_page(
        self,
        *,
        page_image: PageImage,
        page_hash_str: str,
        pdf_name: str,
        course_slug: str,
    ) -> tuple[ProviderResponse, dict[str, object]]:
        """Call the provider once and build a validated sidecar payload."""
        response = self.provider.call(page_image.image_bytes, DEFAULT_PROMPT)
        pii_report = detect_pii(response.raw_text, owner_name=self.owner_name)

        sidecar_payload = {
            "source": {
                "pdf": pdf_name,
                "page": page_image.page,
                "page_hash": page_hash_str,
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
        # Validate at the boundary so a buggy extractor can never write garbage.
        validate_sidecar(sidecar_payload)
        return response, sidecar_payload

    def _record_in_ledger(
        self, *, response: ProviderResponse, course_slug: str
    ) -> None:
        """Record the call in the cost ledger, translating BudgetExceededError."""
        # We use the provider's reported cost as the authoritative spend so
        # the ledger reflects exactly what we'll be billed. The cost_calculator
        # remains the pricing oracle for estimates / status reports.
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
                is_re_ocr=False,
            )
        except BudgetExceededError as e:
            raise OrchestratorError(str(e)) from e

    def _write_outputs(
        self,
        *,
        sidecar_dir: Path,
        image_dir: Path,
        page: int,
        image_bytes: bytes,
        sidecar_payload: dict[str, object],
    ) -> None:
        (sidecar_dir / f"page-{page}.json").write_text(
            json.dumps(sidecar_payload, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        (image_dir / f"page-{page}.png").write_bytes(image_bytes)

    def _update_index(
        self,
        *,
        page_hash_str: str,
        course_slug: str,
        pdf_name: str,
        page: int,
        sidecar_payload: dict[str, object],
        response: ProviderResponse,
    ) -> None:
        self.index.upsert_page(
            page_hash=page_hash_str,
            course=course_slug,
            pdf=pdf_name,
            page=page,
            confidence=float(sidecar_payload["extracted"]["confidence"]),  # type: ignore[index]
            needs_review=sidecar_payload["extracted"]["needs_review"],  # type: ignore[index]
            needs_redaction_review=sidecar_payload["pii"][  # type: ignore[index]
                "needs_redaction_review"
            ],
        )
        self.index.log_call(
            timestamp=datetime.now(UTC),
            course=course_slug,
            model=response.model_id,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            cost_usd=response.cost_usd,
            is_re_ocr=False,
        )
