"""Tests for the cropper module (closes #41).

Pure image-manipulation tests using Pillow + in-memory PNG buffers.
The cropper composes:

    crop_image(png_bytes, bbox)              — Pillow crop
    rotate_image(png_bytes, degrees)         — multiple of 90°
    apply_redaction_overlays(png_bytes, ...) — black-bar boxes

Plus a top-level orchestrator ``crop_favorite_page`` that takes a renderer
(Protocol), the source PDF + page index + bbox + sidecar, and returns the
final PNG bytes ready to write to disk.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import pytest
from PIL import Image, ImageChops

from ocr_vault.cropper import (
    BBox,
    CropError,
    apply_redaction_overlays,
    crop_favorite_page,
    crop_image,
    rotate_image,
)
from ocr_vault.sidecar_schema import (
    Extracted,
    Model,
    Pii,
    Sidecar,
    Source,
)


def _make_png(width: int = 100, height: int = 100, color: str = "white") -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_sidecar(
    *,
    page: int = 1,
    pdf: str = "hw1.pdf",
    page_hash: str = "sha256:abc",
    pii_names: list[str] | None = None,
    needs_redaction: bool = False,
) -> Sidecar:
    return Sidecar(
        source=Source(pdf=pdf, page=page, page_hash=page_hash),
        extracted=Extracted(blocks=[], topics=[], confidence=0.9, needs_review=False),
        pii=Pii(
            names_detected=pii_names or [],
            akwasi_present=False,
            needs_redaction_review=needs_redaction,
        ),
        model=Model(provider="mock", model_id="m1", ocr_version="1.0.0"),
    )


# ────────────── crop_image ─────────────────────────────────────────────────


class TestCropImage:
    def test_crops_to_bbox_dimensions(self) -> None:
        png = _make_png(200, 200)
        cropped = crop_image(png, BBox(x=10, y=20, width=50, height=80))
        img = Image.open(io.BytesIO(cropped))
        assert img.size == (50, 80)

    def test_crop_with_zero_origin(self) -> None:
        png = _make_png(100, 100)
        cropped = crop_image(png, BBox(x=0, y=0, width=10, height=10))
        img = Image.open(io.BytesIO(cropped))
        assert img.size == (10, 10)

    def test_raises_when_bbox_exceeds_image(self) -> None:
        png = _make_png(50, 50)
        with pytest.raises(CropError):
            crop_image(png, BBox(x=0, y=0, width=100, height=100))

    def test_raises_on_zero_dimension(self) -> None:
        png = _make_png(50, 50)
        with pytest.raises(CropError):
            crop_image(png, BBox(x=0, y=0, width=0, height=10))

    def test_raises_on_negative_origin(self) -> None:
        png = _make_png(50, 50)
        with pytest.raises(CropError):
            crop_image(png, BBox(x=-5, y=0, width=10, height=10))


# ────────────── rotate_image ───────────────────────────────────────────────


class TestRotateImage:
    @pytest.mark.parametrize("degrees", [0, 90, 180, 270])
    def test_supports_quadrant_rotations(self, degrees: int) -> None:
        png = _make_png(100, 60)
        rotated = rotate_image(png, degrees)
        img = Image.open(io.BytesIO(rotated))
        if degrees in (90, 270):
            assert img.size == (60, 100)
        else:
            assert img.size == (100, 60)

    def test_zero_rotation_is_identity(self) -> None:
        png = _make_png(50, 50, color="red")
        rotated = rotate_image(png, 0)
        a = Image.open(io.BytesIO(png)).convert("RGB")
        b = Image.open(io.BytesIO(rotated)).convert("RGB")
        diff = ImageChops.difference(a, b)
        assert diff.getbbox() is None

    def test_rejects_non_quadrant_rotation(self) -> None:
        png = _make_png(50, 50)
        with pytest.raises(CropError):
            rotate_image(png, 45)

    def test_normalises_negative_angle(self) -> None:
        # -90° == 270°; same output dimensions.
        png = _make_png(100, 60)
        a = rotate_image(png, -90)
        b = rotate_image(png, 270)
        ia = Image.open(io.BytesIO(a)).convert("RGB")
        ib = Image.open(io.BytesIO(b)).convert("RGB")
        assert ia.size == ib.size
        assert ImageChops.difference(ia, ib).getbbox() is None


# ────────────── apply_redaction_overlays ──────────────────────────────────


class TestApplyRedactionOverlays:
    def test_overlays_paint_black(self) -> None:
        png = _make_png(100, 100, color="white")
        out = apply_redaction_overlays(
            png, regions=[BBox(x=10, y=10, width=20, height=20)]
        )
        img = Image.open(io.BytesIO(out)).convert("RGB")
        # Center of the region is black.
        assert img.getpixel((20, 20)) == (0, 0, 0)
        # Outside the region is still white.
        assert img.getpixel((50, 50)) == (255, 255, 255)

    def test_no_regions_is_passthrough(self) -> None:
        png = _make_png(40, 40, color="white")
        out = apply_redaction_overlays(png, regions=[])
        a = Image.open(io.BytesIO(png)).convert("RGB")
        b = Image.open(io.BytesIO(out)).convert("RGB")
        assert ImageChops.difference(a, b).getbbox() is None

    def test_clips_overlay_to_image_bounds(self) -> None:
        # Region extending beyond image must not raise.
        png = _make_png(20, 20)
        out = apply_redaction_overlays(
            png, regions=[BBox(x=10, y=10, width=100, height=100)]
        )
        img = Image.open(io.BytesIO(out)).convert("RGB")
        # Bottom-right pixel inside clipped region is black.
        assert img.getpixel((19, 19)) == (0, 0, 0)


# ────────────── crop_favorite_page ─────────────────────────────────────────


@dataclass
class FakeRenderer:
    """In-memory PageRenderer for testing — returns a fixed-size white PNG."""

    width: int
    height: int

    def render_page(self, *, pdf_path, page_index, dpi):  # type: ignore[no-untyped-def]
        # Validate that DPI is what crop_favorite_page passes.
        assert dpi == 400, f"expected 400 DPI, got {dpi}"
        self.last_pdf_path = pdf_path
        self.last_page_index = page_index
        return _make_png(self.width, self.height)


class TestCropFavoritePage:
    def test_uses_400_dpi_and_returns_cropped_png(self, tmp_path) -> None:  # type: ignore[no-untyped-def]
        renderer = FakeRenderer(width=2000, height=2000)
        sc = _make_sidecar()
        png = crop_favorite_page(
            renderer=renderer,
            pdf_path=tmp_path / "src.pdf",
            page_index=0,
            bbox=BBox(x=100, y=200, width=800, height=1066),
            sidecar=sc,
            rotation_degrees=0,
            redaction_regions=[],
        )
        img = Image.open(io.BytesIO(png))
        assert img.size == (800, 1066)
        assert renderer.last_page_index == 0

    def test_applies_rotation_after_render(self, tmp_path) -> None:  # type: ignore[no-untyped-def]
        renderer = FakeRenderer(width=2000, height=1000)
        sc = _make_sidecar()
        png = crop_favorite_page(
            renderer=renderer,
            pdf_path=tmp_path / "src.pdf",
            page_index=0,
            bbox=BBox(x=0, y=0, width=500, height=600),
            sidecar=sc,
            rotation_degrees=90,
            redaction_regions=[],
        )
        # After 90° rotation the rendered image is 1000x2000;
        # crop 500x600 from that.
        img = Image.open(io.BytesIO(png))
        assert img.size == (500, 600)

    def test_applies_redaction_within_crop(self, tmp_path) -> None:  # type: ignore[no-untyped-def]
        renderer = FakeRenderer(width=1000, height=1000)
        sc = _make_sidecar()
        # Redact a region inside the area that will be cropped.
        png = crop_favorite_page(
            renderer=renderer,
            pdf_path=tmp_path / "src.pdf",
            page_index=0,
            bbox=BBox(x=0, y=0, width=200, height=200),
            sidecar=sc,
            rotation_degrees=0,
            redaction_regions=[BBox(x=10, y=10, width=50, height=50)],
        )
        img = Image.open(io.BytesIO(png)).convert("RGB")
        assert img.getpixel((30, 30)) == (0, 0, 0)
        assert img.getpixel((150, 150)) == (255, 255, 255)
