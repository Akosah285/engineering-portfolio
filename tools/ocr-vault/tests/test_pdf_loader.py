"""Tests for the PdfLoader abstraction.

The PdfLoader sits between the orchestrator and the actual PDF rendering
backend. Real rendering uses pypdfium2 or pdf2image (heavyweight binary
deps); tests and dry-runs use MockPdfLoader which yields canned page
images deterministically.

This keeps the orchestrator pure + testable without touching real PDFs.
"""

from __future__ import annotations

import dataclasses
import io
from pathlib import Path

import pytest

from ocr_vault.pdf_loader import (
    MockPdfLoader,
    PageImage,
    PdfLoader,
    PdfLoaderError,
    Pypdfium2PdfLoader,
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


# ─────────────── real pypdfium2 loader (#36) ──────────────────────────────


def _make_synthetic_pdf(path: Path, *, page_count: int) -> Path:
    """Write a multi-page blank PDF at ``path``. Uses pypdfium2 itself, so the
    test exercises the same library it asserts about — same install path, no
    third-party tooling, deterministic output.
    """
    import pypdfium2 as pdfium  # type: ignore[import-untyped]

    pdf = pdfium.PdfDocument.new()
    try:
        for _ in range(page_count):
            pdf.new_page(612, 792)  # US Letter at 72 DPI
        pdf.save(str(path))
    finally:
        pdf.close()
    return path


class TestPypdfium2PdfLoader:
    def test_implements_protocol(self) -> None:
        loader = Pypdfium2PdfLoader()
        assert isinstance(loader, PdfLoader)

    def test_page_count_matches_synthetic_pdf(self, tmp_path: Path) -> None:
        pdf = _make_synthetic_pdf(tmp_path / "3pg.pdf", page_count=3)
        loader = Pypdfium2PdfLoader()
        assert loader.page_count(pdf) == 3

    def test_iter_pages_yields_one_per_page(self, tmp_path: Path) -> None:
        pdf = _make_synthetic_pdf(tmp_path / "4pg.pdf", page_count=4)
        loader = Pypdfium2PdfLoader()
        pages = list(loader.iter_pages(pdf))
        assert len(pages) == 4

    def test_pages_numbered_starting_at_1(self, tmp_path: Path) -> None:
        pdf = _make_synthetic_pdf(tmp_path / "5pg.pdf", page_count=5)
        loader = Pypdfium2PdfLoader()
        pages = list(loader.iter_pages(pdf))
        assert [p.page for p in pages] == [1, 2, 3, 4, 5]

    def test_image_bytes_are_png_signature(self, tmp_path: Path) -> None:
        pdf = _make_synthetic_pdf(tmp_path / "p.pdf", page_count=1)
        loader = Pypdfium2PdfLoader()
        page = next(iter(loader.iter_pages(pdf)))
        # PNG magic number: 89 50 4e 47 0d 0a 1a 0a
        assert page.image_bytes.startswith(b"\x89PNG\r\n\x1a\n")

    def test_content_type_is_image_png(self, tmp_path: Path) -> None:
        pdf = _make_synthetic_pdf(tmp_path / "p.pdf", page_count=1)
        loader = Pypdfium2PdfLoader()
        page = next(iter(loader.iter_pages(pdf)))
        assert page.content_type == "image/png"

    def test_missing_pdf_raises_pdfloadererror(self, tmp_path: Path) -> None:
        loader = Pypdfium2PdfLoader()
        with pytest.raises(PdfLoaderError):
            list(loader.iter_pages(tmp_path / "does-not-exist.pdf"))

    def test_missing_pdf_page_count_also_raises(self, tmp_path: Path) -> None:
        loader = Pypdfium2PdfLoader()
        with pytest.raises(PdfLoaderError):
            loader.page_count(tmp_path / "does-not-exist.pdf")

    def test_dpi_affects_output_image_size(self, tmp_path: Path) -> None:
        """Higher DPI => larger PNG dimensions (proportional to DPI ratio)."""
        from PIL import Image as _PilImage

        pdf = _make_synthetic_pdf(tmp_path / "p.pdf", page_count=1)

        loader_lo = Pypdfium2PdfLoader(dpi=100)
        loader_hi = Pypdfium2PdfLoader(dpi=200)
        lo_bytes = next(iter(loader_lo.iter_pages(pdf))).image_bytes
        hi_bytes = next(iter(loader_hi.iter_pages(pdf))).image_bytes

        lo_w, lo_h = _PilImage.open(io.BytesIO(lo_bytes)).size
        hi_w, hi_h = _PilImage.open(io.BytesIO(hi_bytes)).size

        # 200 DPI doubles 100 DPI on each axis (±1 px rounding tolerance).
        assert abs(hi_w - lo_w * 2) <= 1
        assert abs(hi_h - lo_h * 2) <= 1

    def test_default_dpi_is_reasonable_for_vision_llm(self) -> None:
        """Default DPI should be high enough for handwritten math (>=150) but
        not so high that page PNGs balloon (<=400)."""
        loader = Pypdfium2PdfLoader()
        assert 150 <= loader.dpi <= 400

    def test_rejects_non_positive_dpi(self) -> None:
        with pytest.raises(ValueError):
            Pypdfium2PdfLoader(dpi=0)
        with pytest.raises(ValueError):
            Pypdfium2PdfLoader(dpi=-50)

    def test_iter_pages_is_idempotent(self, tmp_path: Path) -> None:
        """Re-iterating yields the same bytes — important for cache-hit tests
        on top of page_hash."""
        pdf = _make_synthetic_pdf(tmp_path / "p.pdf", page_count=2)
        loader = Pypdfium2PdfLoader()
        run_a = [p.image_bytes for p in loader.iter_pages(pdf)]
        run_b = [p.image_bytes for p in loader.iter_pages(pdf)]
        assert run_a == run_b

    def test_releases_file_handle_after_iteration(self, tmp_path: Path) -> None:
        """On Windows, a leaked file handle blocks tmp_path cleanup. Force the
        issue by trying to delete the file immediately after iteration ends.
        """
        pdf = _make_synthetic_pdf(tmp_path / "p.pdf", page_count=1)
        loader = Pypdfium2PdfLoader()
        list(loader.iter_pages(pdf))
        # If the loader leaks the FD, this will raise PermissionError on Windows.
        pdf.unlink()
        assert not pdf.exists()
