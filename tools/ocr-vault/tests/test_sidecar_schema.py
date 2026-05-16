"""TDD: sidecar schema validator.

The sidecar JSON file is the durable record of every page's OCR. Every
downstream consumer (search indexer, MDX exporter, status reports, PII
review, cost audit) reads the sidecar — so its shape MUST be stable and
validated at write time.

Because the project deliberately depends on *zero* third-party libraries
at v0 of the OCR tool (per plan §3 OCR fine-print), we hand-roll the
validator. The shape exactly mirrors plan §2.3.

Public surface:
- validate_sidecar(data) -> Sidecar
- SidecarValidationError
- Sidecar (frozen dataclass)
"""

from typing import Any

import pytest

from ocr_vault.sidecar_schema import (
    Sidecar,
    SidecarValidationError,
    validate_sidecar,
)


def _good_sidecar() -> dict[str, Any]:
    return {
        "source": {
            "pdf": "archive/originals/lab1.pdf",
            "page": 3,
            "page_hash": "sha256:" + "a" * 64,
        },
        "extracted": {
            "blocks": [
                {
                    "type": "problem_statement",
                    "problem_id": "3a",
                    "prose": "Find the convergence radius of the series.",
                    "latex": "\\sum_{n=0}^\\infty z^n",
                },
                {
                    "type": "solution_step",
                    "problem_id": "3a",
                    "prose": "Apply ratio test.",
                    "latex": "\\lim_{n\\to\\infty} |z|",
                },
            ],
            "topics": ["complex-analysis", "series-convergence"],
            "confidence": 0.86,
            "needs_review": False,
        },
        "pii": {
            "names_detected": [],
            "akwasi_present": True,
            "needs_redaction_review": False,
        },
        "model": {
            "provider": "anthropic",
            "model_id": "claude-sonnet-4.5",
            "ocr_version": "1.0.0",
        },
    }


# ----- happy path -----


def test_validates_good_sidecar() -> None:
    s = validate_sidecar(_good_sidecar())
    assert isinstance(s, Sidecar)
    assert s.source.page == 3
    assert s.source.page_hash.startswith("sha256:")
    assert s.extracted.confidence == 0.86
    assert s.pii.akwasi_present is True


def test_returns_typed_object_with_blocks_accessible() -> None:
    s = validate_sidecar(_good_sidecar())
    assert len(s.extracted.blocks) == 2
    assert s.extracted.blocks[0].type == "problem_statement"
    assert s.extracted.blocks[0].problem_id == "3a"


def test_figure_block_has_optional_caption_and_bbox() -> None:
    data = _good_sidecar()
    data["extracted"]["blocks"].append(
        {
            "type": "figure",
            "caption": "Phasor diagram",
            "bbox": [0.1, 0.2, 0.5, 0.6],
        }
    )
    s = validate_sidecar(data)
    fig = s.extracted.blocks[2]
    assert fig.type == "figure"
    assert fig.caption == "Phasor diagram"
    assert fig.bbox == (0.1, 0.2, 0.5, 0.6)


# ----- top-level shape -----


@pytest.mark.parametrize(
    "key", ["source", "extracted", "pii", "model"]
)
def test_missing_top_level_key_raises(key: str) -> None:
    data = _good_sidecar()
    del data[key]
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert key in str(exc.value)


def test_non_dict_input_raises() -> None:
    with pytest.raises(SidecarValidationError):
        validate_sidecar("not a dict")
    with pytest.raises(SidecarValidationError):
        validate_sidecar([1, 2, 3])
    with pytest.raises(SidecarValidationError):
        validate_sidecar(None)


# ----- source -----


def test_source_requires_page_hash_with_sha256_prefix() -> None:
    data = _good_sidecar()
    data["source"]["page_hash"] = "no-prefix-12345"
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert "page_hash" in str(exc.value)


def test_source_page_must_be_positive_int() -> None:
    data = _good_sidecar()
    data["source"]["page"] = 0
    with pytest.raises(SidecarValidationError):
        validate_sidecar(data)
    data["source"]["page"] = -3
    with pytest.raises(SidecarValidationError):
        validate_sidecar(data)
    data["source"]["page"] = "3"
    with pytest.raises(SidecarValidationError):
        validate_sidecar(data)


# ----- extracted.confidence -----


def test_confidence_must_be_in_zero_one_range() -> None:
    data = _good_sidecar()
    data["extracted"]["confidence"] = 1.5
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert "confidence" in str(exc.value)
    data["extracted"]["confidence"] = -0.1
    with pytest.raises(SidecarValidationError):
        validate_sidecar(data)


def test_confidence_zero_and_one_are_valid_boundaries() -> None:
    data = _good_sidecar()
    data["extracted"]["confidence"] = 0.0
    validate_sidecar(data)
    data["extracted"]["confidence"] = 1.0
    validate_sidecar(data)


# ----- block types -----


def test_unknown_block_type_raises() -> None:
    data = _good_sidecar()
    data["extracted"]["blocks"].append(
        {"type": "fragmented_doodle", "prose": "?"}
    )
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert "fragmented_doodle" in str(exc.value)


def test_problem_block_must_have_problem_id() -> None:
    data = _good_sidecar()
    data["extracted"]["blocks"][0].pop("problem_id")
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert "problem_id" in str(exc.value)


def test_blocks_can_be_empty_for_blank_pages() -> None:
    """A blank or skipped page might have zero extracted blocks."""
    data = _good_sidecar()
    data["extracted"]["blocks"] = []
    s = validate_sidecar(data)
    assert s.extracted.blocks == []


# ----- pii -----


def test_pii_block_required_fields() -> None:
    data = _good_sidecar()
    del data["pii"]["needs_redaction_review"]
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    assert "needs_redaction_review" in str(exc.value)


def test_pii_names_must_be_list_of_strings() -> None:
    data = _good_sidecar()
    data["pii"]["names_detected"] = [1, 2, 3]
    with pytest.raises(SidecarValidationError):
        validate_sidecar(data)


# ----- model -----


def test_model_requires_provider_and_id_and_version() -> None:
    for missing in ("provider", "model_id", "ocr_version"):
        data = _good_sidecar()
        del data["model"][missing]
        with pytest.raises(SidecarValidationError) as exc:
            validate_sidecar(data)
        assert missing in str(exc.value)


# ----- immutability (downstream safety) -----


def test_sidecar_is_immutable() -> None:
    s = validate_sidecar(_good_sidecar())
    with pytest.raises((AttributeError, Exception)):
        s.source.page = 99  # type: ignore[misc]


# ----- error message quality -----


def test_error_messages_include_path_for_nested_failures() -> None:
    data = _good_sidecar()
    data["extracted"]["confidence"] = 5.0
    with pytest.raises(SidecarValidationError) as exc:
        validate_sidecar(data)
    msg = str(exc.value)
    assert "extracted" in msg
    assert "confidence" in msg
