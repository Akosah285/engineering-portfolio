"""Sidecar JSON schema validator (hand-rolled — zero deps).

The sidecar JSON file is the durable record of every page's OCR. Every
downstream consumer reads this shape, so it is validated at write time.

Schema mirrors plan.md §2.3:
{
  "source":    {pdf, page (>=1), page_hash (sha256:...)},
  "extracted": {blocks[], topics[], confidence (0..1), needs_review (bool)},
  "pii":       {names_detected[], akwasi_present, needs_redaction_review},
  "model":     {provider, model_id, ocr_version}
}
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Final

# Block types that the OCR can emit. Unknown types are rejected so a buggy
# extractor can't silently corrupt downstream consumers.
_VALID_BLOCK_TYPES: Final[frozenset[str]] = frozenset(
    {"problem_statement", "solution_step", "figure", "prose", "code"}
)
_PROBLEM_BLOCK_TYPES: Final[frozenset[str]] = frozenset(
    {"problem_statement", "solution_step"}
)


class SidecarValidationError(ValueError):
    """Raised when a sidecar dict fails schema validation. Message includes path."""


# ---------- typed result objects ----------


@dataclass(frozen=True, slots=True)
class Source:
    pdf: str
    page: int
    page_hash: str


@dataclass(frozen=True, slots=True)
class Block:
    type: str
    prose: str = ""
    latex: str = ""
    problem_id: str | None = None
    caption: str | None = None
    bbox: tuple[float, float, float, float] | None = None


@dataclass(frozen=True, slots=True)
class Extracted:
    blocks: list[Block] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    confidence: float = 0.0
    needs_review: bool = False


@dataclass(frozen=True, slots=True)
class Pii:
    names_detected: list[str] = field(default_factory=list)
    akwasi_present: bool = False
    needs_redaction_review: bool = False


@dataclass(frozen=True, slots=True)
class Model:
    provider: str
    model_id: str
    ocr_version: str


@dataclass(frozen=True, slots=True)
class Sidecar:
    source: Source
    extracted: Extracted
    pii: Pii
    model: Model


# ---------- validation helpers ----------


def _require_dict(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SidecarValidationError(
            f"{path}: expected object, got {type(value).__name__}"
        )
    return value


def _require_keys(d: dict[str, Any], required: tuple[str, ...], path: str) -> None:
    missing = [k for k in required if k not in d]
    if missing:
        raise SidecarValidationError(
            f"{path}: missing required key(s) {missing}"
        )


def _require_str(value: Any, path: str) -> str:
    if not isinstance(value, str):
        raise SidecarValidationError(
            f"{path}: expected string, got {type(value).__name__}"
        )
    return value


def _require_bool(value: Any, path: str) -> bool:
    if not isinstance(value, bool):
        raise SidecarValidationError(
            f"{path}: expected bool, got {type(value).__name__}"
        )
    return value


def _require_list_of_str(value: Any, path: str) -> list[str]:
    if not isinstance(value, list):
        raise SidecarValidationError(
            f"{path}: expected list of strings, got {type(value).__name__}"
        )
    for i, item in enumerate(value):
        if not isinstance(item, str):
            raise SidecarValidationError(
                f"{path}[{i}]: expected string, got {type(item).__name__}"
            )
    return value


# ---------- per-section validators ----------


def _validate_source(d: Any) -> Source:
    src = _require_dict(d, "source")
    _require_keys(src, ("pdf", "page", "page_hash"), "source")
    pdf = _require_str(src["pdf"], "source.pdf")
    page = src["page"]
    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        raise SidecarValidationError(
            f"source.page: expected positive int, got {page!r}"
        )
    page_hash = _require_str(src["page_hash"], "source.page_hash")
    if not page_hash.startswith("sha256:"):
        raise SidecarValidationError(
            f"source.page_hash: must start with 'sha256:', got {page_hash!r}"
        )
    return Source(pdf=pdf, page=page, page_hash=page_hash)


def _validate_block(d: Any, path: str) -> Block:
    blk = _require_dict(d, path)
    _require_keys(blk, ("type",), path)
    t = _require_str(blk["type"], f"{path}.type")
    if t not in _VALID_BLOCK_TYPES:
        raise SidecarValidationError(
            f"{path}.type: unknown block type {t!r}, expected one of "
            f"{sorted(_VALID_BLOCK_TYPES)}"
        )
    if t in _PROBLEM_BLOCK_TYPES and "problem_id" not in blk:
        raise SidecarValidationError(
            f"{path}: blocks of type {t!r} must include problem_id"
        )

    bbox: tuple[float, float, float, float] | None = None
    if "bbox" in blk:
        raw = blk["bbox"]
        if (
            not isinstance(raw, list)
            or len(raw) != 4
            or not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in raw)
        ):
            raise SidecarValidationError(
                f"{path}.bbox: expected list of 4 numbers, got {raw!r}"
            )
        bbox = (float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))

    return Block(
        type=t,
        prose=str(blk.get("prose", "")),
        latex=str(blk.get("latex", "")),
        problem_id=blk.get("problem_id"),
        caption=blk.get("caption"),
        bbox=bbox,
    )


def _validate_extracted(d: Any) -> Extracted:
    ext = _require_dict(d, "extracted")
    _require_keys(
        ext,
        ("blocks", "topics", "confidence", "needs_review"),
        "extracted",
    )
    raw_blocks = ext["blocks"]
    if not isinstance(raw_blocks, list):
        raise SidecarValidationError(
            f"extracted.blocks: expected list, got {type(raw_blocks).__name__}"
        )
    blocks = [
        _validate_block(b, f"extracted.blocks[{i}]") for i, b in enumerate(raw_blocks)
    ]

    topics = _require_list_of_str(ext["topics"], "extracted.topics")

    conf = ext["confidence"]
    if isinstance(conf, bool) or not isinstance(conf, (int, float)):
        raise SidecarValidationError(
            f"extracted.confidence: expected number, got {type(conf).__name__}"
        )
    if not (0.0 <= float(conf) <= 1.0):
        raise SidecarValidationError(
            f"extracted.confidence: must be in [0, 1], got {conf}"
        )

    needs_review = _require_bool(ext["needs_review"], "extracted.needs_review")
    return Extracted(
        blocks=blocks,
        topics=topics,
        confidence=float(conf),
        needs_review=needs_review,
    )


def _validate_pii(d: Any) -> Pii:
    pii = _require_dict(d, "pii")
    _require_keys(
        pii,
        ("names_detected", "akwasi_present", "needs_redaction_review"),
        "pii",
    )
    return Pii(
        names_detected=_require_list_of_str(
            pii["names_detected"], "pii.names_detected"
        ),
        akwasi_present=_require_bool(pii["akwasi_present"], "pii.akwasi_present"),
        needs_redaction_review=_require_bool(
            pii["needs_redaction_review"], "pii.needs_redaction_review"
        ),
    )


def _validate_model(d: Any) -> Model:
    m = _require_dict(d, "model")
    _require_keys(m, ("provider", "model_id", "ocr_version"), "model")
    return Model(
        provider=_require_str(m["provider"], "model.provider"),
        model_id=_require_str(m["model_id"], "model.model_id"),
        ocr_version=_require_str(m["ocr_version"], "model.ocr_version"),
    )


# ---------- public entry point ----------


def validate_sidecar(data: Any) -> Sidecar:
    """Validate a sidecar dict and return a typed Sidecar.

    Args:
        data: The parsed JSON dict from a sidecar file.

    Returns:
        A frozen Sidecar with typed sub-objects.

    Raises:
        SidecarValidationError: On any shape violation. Message includes the
            path (e.g., "extracted.confidence: must be in [0, 1], got 5.0").
    """
    root = _require_dict(data, "<root>")
    _require_keys(root, ("source", "extracted", "pii", "model"), "<root>")
    return Sidecar(
        source=_validate_source(root["source"]),
        extracted=_validate_extracted(root["extracted"]),
        pii=_validate_pii(root["pii"]),
        model=_validate_model(root["model"]),
    )
