"""PDF page-loader abstraction.

The orchestrator calls ``PdfLoader`` to walk a PDF's pages and obtain raw
image bytes for each. Production wiring uses pypdfium2 (``Pypdfium2PdfLoader``);
tests + dry-runs use ``MockPdfLoader`` for deterministic, dep-free output.

``Pypdfium2PdfLoader`` mirrors the same library-call idiom as
``cropper.PypdfiumPageRenderer`` so both consumers of pypdfium2 stay in sync
when the upstream API evolves.
"""

from __future__ import annotations

import hashlib
import io
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable


class PdfLoaderError(Exception):
    """Raised when a PDF cannot be opened or pages cannot be rendered."""


@dataclass(frozen=True, slots=True)
class PageImage:
    """A single page's rendered image + metadata."""

    page: int
    image_bytes: bytes
    content_type: str

    def __post_init__(self) -> None:
        if self.page < 1:
            raise ValueError(f"page must be >= 1, got {self.page}")
        if not self.image_bytes:
            raise ValueError("image_bytes must be non-empty")
        if not self.content_type:
            raise ValueError("content_type must be non-empty")


@runtime_checkable
class PdfLoader(Protocol):
    """Yields rendered page images for a PDF."""

    def page_count(self, pdf_path: Path) -> int: ...
    def iter_pages(self, pdf_path: Path) -> Iterator[PageImage]: ...


class MockPdfLoader:
    """Deterministic mock used in tests + dry-runs.

    Yields synthetic per-page image bytes hashed from ``(pdf_path, page)`` so
    the same input always produces the same output (essential for cache-hit
    tests on top of ``page_hash``).
    """

    def __init__(
        self,
        page_count: int | None = None,
        canned_pages: list[PageImage] | None = None,
    ) -> None:
        if canned_pages is None and page_count is None:
            raise ValueError("MockPdfLoader requires page_count or canned_pages")
        if page_count is not None and page_count < 1:
            raise ValueError(f"page_count must be >= 1, got {page_count}")
        self._page_count = (
            page_count if canned_pages is None else len(canned_pages)
        )
        self._canned = canned_pages
        self.call_count = 0

    def page_count(self, pdf_path: Path) -> int:
        assert self._page_count is not None
        return self._page_count

    def iter_pages(self, pdf_path: Path) -> Iterator[PageImage]:
        self.call_count += 1
        if self._canned is not None:
            yield from self._canned
            return
        assert self._page_count is not None
        for page in range(1, self._page_count + 1):
            digest = hashlib.sha256(
                f"{pdf_path.as_posix()}|{page}".encode()
            ).digest()
            # Prepend a PNG-like signature so the bytes are non-empty + recognizable.
            image_bytes = b"\x89PNG\r\n\x1a\n" + digest
            yield PageImage(
                page=page,
                image_bytes=image_bytes,
                content_type="image/png",
            )


# ─────────────── real pypdfium2 loader (#36) ──────────────────────────────


_DEFAULT_DPI = 200
_PDFIUM_NATIVE_DPI = 72  # pdfium uses 72 DPI as its native unit


class Pypdfium2PdfLoader:
    """Concrete ``PdfLoader`` backed by pypdfium2.

    Walks each page of a PDF, renders to PNG bytes at the configured DPI,
    and yields ``PageImage`` records. Default DPI of 200 is a balance: high
    enough that handwritten math + fine notation stays legible to the vision
    LLM, low enough that page PNGs are <1 MB for typical letter-size pages.

    On any pypdfium2 failure (missing file, corrupt PDF, unrenderable page),
    raises :class:`PdfLoaderError` so callers don't need to depend on the
    pypdfium2 exception hierarchy.
    """

    def __init__(self, *, dpi: int = _DEFAULT_DPI) -> None:
        if dpi <= 0:
            raise ValueError(f"dpi must be > 0, got {dpi}")
        self.dpi = dpi

    def page_count(self, pdf_path: Path) -> int:
        import pypdfium2 as pdfium  # type: ignore[import-untyped]

        try:
            pdf = pdfium.PdfDocument(str(pdf_path))
        except Exception as e:
            raise PdfLoaderError(f"could not open {pdf_path}: {e}") from e
        try:
            return len(pdf)
        finally:
            pdf.close()

    def iter_pages(self, pdf_path: Path) -> Iterator[PageImage]:
        import pypdfium2 as pdfium

        try:
            pdf = pdfium.PdfDocument(str(pdf_path))
        except Exception as e:
            raise PdfLoaderError(f"could not open {pdf_path}: {e}") from e

        try:
            scale = self.dpi / _PDFIUM_NATIVE_DPI
            n = len(pdf)
            for i in range(n):
                page = pdf[i]
                try:
                    try:
                        pil_image = page.render(scale=scale).to_pil()
                    except Exception as e:
                        raise PdfLoaderError(
                            f"could not render page {i + 1} of {pdf_path}: {e}"
                        ) from e
                    buf = io.BytesIO()
                    pil_image.save(buf, format="PNG")
                    yield PageImage(
                        page=i + 1,
                        image_bytes=buf.getvalue(),
                        content_type="image/png",
                    )
                finally:
                    page.close()
        finally:
            pdf.close()
