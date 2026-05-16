"""TDD: per-course OCR config loader.

Plan section 7.19: confidence threshold default 0.7, tunable per-command,
persisted per-course in `data/ocr-config.json`. This module loads, validates,
and resolves the effective threshold for a given course.

Resolution order (highest precedence first):
1. CLI override (--low-confidence-threshold X) — passed as `cli_override`
2. Per-course value in config
3. Global default in config
4. Hard-coded fallback (0.7)
"""

import json
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

from ocr_vault.ocr_config import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    OcrConfig,
    OcrConfigError,
    load_ocr_config,
)


@pytest.fixture
def workdir() -> Iterator[Path]:
    """Per-test working directory using tempfile (avoids pytest workdir lock)."""
    p = Path(tempfile.mkdtemp(prefix="ocr-vault-test-"))
    try:
        yield p
    finally:
        shutil.rmtree(p, ignore_errors=True)


# ----- shape -----


def test_default_config_yields_default_threshold() -> None:
    cfg = OcrConfig.empty()
    assert cfg.threshold_for("any-course") == DEFAULT_CONFIDENCE_THRESHOLD
    assert DEFAULT_CONFIDENCE_THRESHOLD == 0.7


def test_global_threshold_applies_to_all_courses() -> None:
    cfg = OcrConfig(global_threshold=0.65, per_course={})
    assert cfg.threshold_for("ml") == 0.65
    assert cfg.threshold_for("fourier") == 0.65


def test_per_course_overrides_global() -> None:
    cfg = OcrConfig(
        global_threshold=0.7,
        per_course={"discrete-probability": 0.6, "fourier": 0.65},
    )
    assert cfg.threshold_for("discrete-probability") == 0.6
    assert cfg.threshold_for("fourier") == 0.65
    assert cfg.threshold_for("ml") == 0.7


def test_cli_override_wins_over_config() -> None:
    cfg = OcrConfig(global_threshold=0.7, per_course={"ml": 0.6})
    assert cfg.threshold_for("ml", cli_override=0.5) == 0.5
    assert cfg.threshold_for("anything", cli_override=0.5) == 0.5


# ----- file loading -----


def test_loads_from_valid_json_file(workdir: Path) -> None:
    config_data = {
        "global": {"low_confidence_threshold": 0.7},
        "per_course": {
            "discrete-probability": {"low_confidence_threshold": 0.6},
            "fourier-transforms": {"low_confidence_threshold": 0.65},
        },
    }
    path = workdir / "ocr-config.json"
    path.write_text(json.dumps(config_data))

    cfg = load_ocr_config(path)
    assert cfg.threshold_for("discrete-probability") == 0.6
    assert cfg.threshold_for("fourier-transforms") == 0.65
    assert cfg.threshold_for("ml") == 0.7


def test_missing_file_yields_empty_config(workdir: Path) -> None:
    """A missing config file is a soft failure — fall back to defaults."""
    cfg = load_ocr_config(workdir / "does-not-exist.json")
    assert cfg.threshold_for("any-course") == DEFAULT_CONFIDENCE_THRESHOLD


def test_invalid_json_raises_with_path(workdir: Path) -> None:
    path = workdir / "bad.json"
    path.write_text("{not valid json")
    with pytest.raises(OcrConfigError) as exc:
        load_ocr_config(path)
    assert str(path) in str(exc.value)


def test_missing_global_section_uses_default(workdir: Path) -> None:
    config_data = {"per_course": {"ml": {"low_confidence_threshold": 0.6}}}
    path = workdir / "ocr-config.json"
    path.write_text(json.dumps(config_data))
    cfg = load_ocr_config(path)
    assert cfg.threshold_for("anything") == DEFAULT_CONFIDENCE_THRESHOLD
    assert cfg.threshold_for("ml") == 0.6


# ----- validation -----


def test_threshold_must_be_in_zero_one(workdir: Path) -> None:
    config_data = {"global": {"low_confidence_threshold": 1.5}}
    path = workdir / "ocr-config.json"
    path.write_text(json.dumps(config_data))
    with pytest.raises(OcrConfigError) as exc:
        load_ocr_config(path)
    assert "0" in str(exc.value) and "1" in str(exc.value)


def test_per_course_threshold_must_be_in_zero_one(workdir: Path) -> None:
    config_data = {
        "per_course": {"ml": {"low_confidence_threshold": -0.1}}
    }
    path = workdir / "ocr-config.json"
    path.write_text(json.dumps(config_data))
    with pytest.raises(OcrConfigError):
        load_ocr_config(path)


def test_constructor_validates_thresholds() -> None:
    with pytest.raises(OcrConfigError):
        OcrConfig(global_threshold=1.5, per_course={})
    with pytest.raises(OcrConfigError):
        OcrConfig(global_threshold=0.7, per_course={"ml": -0.1})


def test_cli_override_must_be_in_zero_one() -> None:
    cfg = OcrConfig.empty()
    with pytest.raises(OcrConfigError):
        cfg.threshold_for("ml", cli_override=1.5)


# ----- introspection -----


def test_courses_with_overrides_listed() -> None:
    cfg = OcrConfig(
        global_threshold=0.7,
        per_course={"ml": 0.6, "fourier": 0.65},
    )
    assert sorted(cfg.courses_with_overrides()) == ["fourier", "ml"]


def test_summary_string_for_status_command() -> None:
    """Used by `ocr-vault status` to print effective config."""
    cfg = OcrConfig(global_threshold=0.7, per_course={"ml": 0.6})
    summary = cfg.summary()
    assert "0.7" in summary
    assert "0.6" in summary
    assert "ml" in summary
