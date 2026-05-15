"""Per-course OCR config loader.

Reads `data/ocr-config.json` and resolves the effective confidence threshold
for any (course, cli-override) pair.

JSON shape mirrors plan section 7.19:
{
    "global": {"low_confidence_threshold": 0.7},
    "per_course": {
        "discrete-probability": {"low_confidence_threshold": 0.6}
    }
}
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_CONFIDENCE_THRESHOLD = 0.7


class OcrConfigError(ValueError):
    """Raised on invalid ocr-config.json contents or out-of-range values."""


def _validate_threshold(t: float, *, where: str) -> None:
    if not (0.0 <= t <= 1.0):
        raise OcrConfigError(
            f"{where}: low_confidence_threshold must be in [0, 1], got {t}"
        )


@dataclass(frozen=True, slots=True)
class OcrConfig:
    """Resolved OCR config — global default + optional per-course overrides."""

    global_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
    per_course: dict[str, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _validate_threshold(self.global_threshold, where="global")
        for course, t in self.per_course.items():
            _validate_threshold(t, where=f"per_course.{course}")

    @classmethod
    def empty(cls) -> OcrConfig:
        """Config with global default and no per-course overrides."""
        return cls()

    def threshold_for(
        self, course: str, *, cli_override: float | None = None
    ) -> float:
        """Effective threshold for `course`. CLI override > per-course > global."""
        if cli_override is not None:
            _validate_threshold(cli_override, where="cli_override")
            return cli_override
        if course in self.per_course:
            return self.per_course[course]
        return self.global_threshold

    def courses_with_overrides(self) -> list[str]:
        return list(self.per_course.keys())

    def summary(self) -> str:
        """Human-readable summary for `ocr-vault status`."""
        lines = [f"global: {self.global_threshold}"]
        for course, t in sorted(self.per_course.items()):
            lines.append(f"  {course}: {t}")
        return "\n".join(lines)


def load_ocr_config(path: Path) -> OcrConfig:
    """Load OCR config from JSON file. Missing file -> empty (defaults).

    Args:
        path: Path to ocr-config.json.

    Returns:
        Validated OcrConfig.

    Raises:
        OcrConfigError: On invalid JSON or out-of-range thresholds.
    """
    if not path.exists():
        return OcrConfig.empty()
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise OcrConfigError(f"{path}: invalid JSON: {e}") from e

    if not isinstance(raw, dict):
        raise OcrConfigError(f"{path}: expected object at root")

    global_section = raw.get("global", {})
    global_threshold = global_section.get(
        "low_confidence_threshold", DEFAULT_CONFIDENCE_THRESHOLD
    )

    per_course_raw: dict[str, Any] = raw.get("per_course", {})
    per_course: dict[str, float] = {}
    for course, entry in per_course_raw.items():
        if not isinstance(entry, dict):
            raise OcrConfigError(
                f"{path}: per_course.{course}: expected object"
            )
        if "low_confidence_threshold" in entry:
            per_course[course] = float(entry["low_confidence_threshold"])

    return OcrConfig(
        global_threshold=float(global_threshold),
        per_course=per_course,
    )
