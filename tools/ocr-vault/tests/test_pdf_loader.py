"""Tests for the PdfLoader abstraction.

The PdfLoader sits between the orchestrator and the actual PDF rendering
backend. Real rendering uses pypdfium2 or pdf2image (heavyweight binary
deps); tests and dry-runs use MockPdfLoader which yields canned page
images deterministically.

This keeps the orchestrator pure + testable without touching real PDFs.
"""

from __future__ import annotations

import dataclasses
from pathlib import Path

import pytest

from ocr_vault.pdf_loader import (
    MockPdfLoader,
    PageImage,
    PdfLoader,
    PdfLoaderError,
)


class TestPageImage:
    def test_construction_stores_fields(self) -> None:
        p = PageImage(page=1, image_bytes=b"png\x00", content_type="image/png")
        assert p.page == 1
        assert p.image_bytes == b"png\x00"
        assert p.content_type == "image/png"

    def test_frozen(self) -> None:
        p = PageImage(page=1, image_bytes=b"x", content_type="image/png")
        # Frozen dataclasses raise FrozenInstanceError when mutated.
        with pytest.raises(dataclasses.FrozenInstanceError):
            p.page = 99  # type: ignore[misc]

    def test_rejects_non_positive_page(self) -> None:
        with pytest.raises(ValueError):
            PageImage(page=0, image_bytes=b"x", content_type="image/png")
        with pytest.raises(ValueError):
            PageImage(page=-1, image_bytes=b"x", content_type="image/png")

    def test_rejects_empty_image_bytes(self) -> None:
        with pytest.raises(ValueError):
            PageImage(page=1, image_bytes=b"", content_type="image/png")

    def test_rejects_empty_content_type(self) -> None:
        with pytest.raises(ValueError):
            PageImage(page=1, image_bytes=b"x", content_type="")


class TestMockPdfLoader:
    def test_implements_protocol(self) -> None:
        loader = MockPdfLoader(page_count=3)
        assert isinstance(loader, PdfLoader)

    def test_page_count_property(self) -> None:
        loader = MockPdfLoader(page_count=5)
        assert loader.page_count(Path("dummy.pdf")) == 5

    def test_yields_one_page_per_count(self) -> None:
        loader = MockPdfLoader(page_count=3)
        pages = list(loader.iter_pages(Path("dummy.pdf")))
        assert len(pages) == 3

    def test_pages_numbered_starting_at_1(self) -> None:
        loader = MockPdfLoader(page_count=4)
        pages = list(loader.iter_pages(Path("dummy.pdf")))
        assert [p.page for p in pages] == [1, 2, 3, 4]

    def test_deterministic_image_bytes_per_page(self) -> None:
        """Same pdf path + page -> same bytes; different pages -> different bytes."""
        loader = MockPdfLoader(page_count=2)
        pages_run_a = list(loader.iter_pages(Path("foo.pdf")))
        pages_run_b = list(loader.iter_pages(Path("foo.pdf")))
        assert pages_run_a[0].image_bytes == pages_run_b[0].image_bytes
        assert pages_run_a[0].image_bytes != pages_run_a[1].image_bytes

    def test_different_pdfs_yield_different_bytes(self) -> None:
        loader = MockPdfLoader(page_count=1)
        page_a = next(iter(loader.iter_pages(Path("a.pdf"))))
        page_b = next(iter(loader.iter_pages(Path("b.pdf"))))
        assert page_a.image_bytes != page_b.image_bytes

    def test_content_type_default_is_png(self) -> None:
        loader = MockPdfLoader(page_count=1)
        page = next(iter(loader.iter_pages(Path("dummy.pdf"))))
        assert page.content_type == "image/png"

    def test_canned_pages_override_default(self) -> None:
        canned = [
            PageImage(page=1, image_bytes=b"canned-1", content_type="image/png"),
            PageImage(page=2, image_bytes=b"canned-2", content_type="image/png"),
        ]
        loader = MockPdfLoader(canned_pages=canned)
        pages = list(loader.iter_pages(Path("any.pdf")))
        assert [p.image_bytes for p in pages] == [b"canned-1", b"canned-2"]
        assert loader.page_count(Path("any.pdf")) == 2

    def test_requires_either_page_count_or_canned(self) -> None:
        with pytest.raises(ValueError):
            MockPdfLoader()

    def test_rejects_zero_page_count(self) -> None:
        with pytest.raises(ValueError):
            MockPdfLoader(page_count=0)

    def test_call_count_tracked(self) -> None:
        loader = MockPdfLoader(page_count=2)
        list(loader.iter_pages(Path("a.pdf")))
        list(loader.iter_pages(Path("a.pdf")))
        assert loader.call_count == 2


class TestPdfLoaderError:
    def test_is_exception_subclass(self) -> None:
        e = PdfLoaderError("boom")
        assert isinstance(e, Exception)
        assert str(e) == "boom"
