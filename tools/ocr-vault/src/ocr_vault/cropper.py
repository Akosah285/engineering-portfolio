"""Page cropping for favorite-page thumbnails (closes #41).

Composes Pillow primitives + a ``PageRenderer`` Protocol (PDF → PNG bytes
at a target DPI) into a deterministic pipeline:

    render at 400 DPI → rotate → crop → apply PII redaction overlays → PNG

All public functions are pure (no I/O). The CLI layer reads + writes
files; this module operates on bytes.
"""

from __future__ import annotations

import io
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable

from PIL import Image, ImageDraw

from ocr_vault.sidecar_schema import Sidecar

FAVORITE_DPI = 400


class CropError(ValueError):
    """Raised when a crop is impossible or out of bounds."""


@dataclass(frozen=True, slots=True)
class BBox:
    """Bounding box in pixel units (origin top-left, x→right, y→down)."""

    x: int
    y: int
    width: int
    height: int


@runtime_checkable
class PageRenderer(Protocol):
    """Protocol for PDF → PNG-bytes rasterizers."""

    def render_page(
        self, *, pdf_path: Path, page_index: int, dpi: int
    ) -> bytes: ...


class PypdfiumPageRenderer:
    """Concrete ``PageRenderer`` backed by pypdfium2."""

    def render_page(
        self, *, pdf_path: Path, page_index: int, dpi: int
    ) -> bytes:
        import pypdfium2 as pdfium  # type: ignore[import-untyped]

        pdf = pdfium.PdfDocument(str(pdf_path))
        try:
            page = pdf[page_index]
            scale = dpi / 72.0  # pdfium native is 72 DPI
            try:
                pil_image = page.render(scale=scale).to_pil()
                buf = io.BytesIO()
                pil_image.save(buf, format="PNG")
                return buf.getvalue()
            finally:
                page.close()
        finally:
            pdf.close()


# ─────────────── primitives ────────────────────────────────────────────────


def crop_image(png_bytes: bytes, bbox: BBox) -> bytes:
    """Crop a PNG to ``bbox``. Origin is top-left.

    Raises ``CropError`` if the bbox has zero/negative dimensions or
    extends beyond the source image.
    """
    if bbox.width <= 0 or bbox.height <= 0:
        raise CropError(f"bbox dimensions must be positive: {bbox!r}")
    if bbox.x < 0 or bbox.y < 0:
        raise CropError(f"bbox origin must be non-negative: {bbox!r}")

    img = Image.open(io.BytesIO(png_bytes))
    src_w, src_h = img.size
    if bbox.x + bbox.width > src_w or bbox.y + bbox.height > src_h:
        raise CropError(
            f"bbox {bbox!r} exceeds source image bounds {(src_w, src_h)}"
        )

    out = img.crop(
        (bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height)
    )
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def rotate_image(png_bytes: bytes, degrees: int) -> bytes:
    """Rotate a PNG by a multiple of 90 degrees, counter-clockwise.

    Negative angles are normalised. Non-quadrant angles raise ``CropError``.
    """
    normalised = degrees % 360
    if normalised not in (0, 90, 180, 270):
        raise CropError(
            f"rotation must be a multiple of 90°, got {degrees}"
        )

    img = Image.open(io.BytesIO(png_bytes))
    if normalised == 0:
        # Re-encode to keep return type consistent.
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    out = img.rotate(normalised, expand=True)
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def apply_redaction_overlays(
    png_bytes: bytes, *, regions: Sequence[BBox]
) -> bytes:
    """Paint solid black rectangles over each region. Out-of-bounds regions
    are clipped (not rejected).
    """
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if not regions:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    draw = ImageDraw.Draw(img)
    src_w, src_h = img.size
    for r in regions:
        x0 = max(0, r.x)
        y0 = max(0, r.y)
        x1 = min(src_w, r.x + r.width)
        y1 = min(src_h, r.y + r.height)
        if x0 < x1 and y0 < y1:
            draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ─────────────── orchestrator ─────────────────────────────────────────────


def crop_favorite_page(
    *,
    renderer: PageRenderer,
    pdf_path: Path,
    page_index: int,
    bbox: BBox,
    sidecar: Sidecar,
    rotation_degrees: int = 0,
    redaction_regions: Sequence[BBox] = (),
) -> bytes:
    """Render → rotate → crop → redact, returning final PNG bytes.

    ``sidecar`` is accepted to anchor the API on the page being processed
    and to leave room for future automatic PII overlay derivation.
    """
    rendered = renderer.render_page(
        pdf_path=pdf_path, page_index=page_index, dpi=FAVORITE_DPI
    )
    rotated = rotate_image(rendered, rotation_degrees)
    cropped = crop_image(rotated, bbox)
    return apply_redaction_overlays(cropped, regions=list(redaction_regions))
