"""``ocr-vault`` CLI entry point.

Thin glue: subcommand dispatch + disk I/O. Real work happens in pure
modules (``status_report``, ``ocr_config``, ``sidecar_schema``).

Currently implemented subcommands:
    status     Print a per-course summary of OCR state.

Future subcommands (placeholders): add, search, list-problems,
list-pii, list-candidates, retry, crop, re-ocr, export.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

from ocr_vault.ocr_config import OcrConfig, OcrConfigError, load_ocr_config
from ocr_vault.sidecar_schema import (
    Sidecar,
    SidecarValidationError,
    validate_sidecar,
)
from ocr_vault.status_report import build_status_report

# ────────────────── helpers ────────────────────────────────────────────────


def _scan_sidecars(
    data_dir: Path,
    *,
    warn: Callable[[str], None],
) -> dict[str, list[Sidecar]]:
    """Scan ``data_dir/sidecars/{course}/...`` for ``page-*.json`` files.

    Schema: ``data_dir/sidecars/{course-slug}/{pdf-stem}/page-N.json``
    Invalid files emit a warning via ``warn`` and are skipped.
    """
    sidecars_root = data_dir / "sidecars"
    out: dict[str, list[Sidecar]] = {}
    if not sidecars_root.exists():
        return out
    for course_dir in sorted(sidecars_root.iterdir()):
        if not course_dir.is_dir():
            continue
        course_sidecars: list[Sidecar] = []
        for path in sorted(course_dir.rglob("*.json")):
            try:
                data = json.loads(path.read_text())
                course_sidecars.append(validate_sidecar(data))
            except (json.JSONDecodeError, SidecarValidationError, OSError) as e:
                warn(f"skipped {path}: {e}")
        out[course_dir.name] = course_sidecars
    return out


def _load_config(data_dir: Path, *, warn: Callable[[str], None]) -> OcrConfig:
    config_path = data_dir / "ocr-config.json"
    try:
        return load_ocr_config(config_path)
    except OcrConfigError as e:
        warn(f"ocr-config.json invalid, using defaults: {e}")
        return OcrConfig.empty()


# ────────────────── command: status ────────────────────────────────────────


def _cmd_status(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    warnings: list[str] = []

    def warn(msg: str) -> None:
        warnings.append(msg)

    config = _load_config(data_dir, warn=warn)
    sidecars = _scan_sidecars(data_dir, warn=warn)

    report = build_status_report(config=config, sidecars_by_course=sidecars)
    sys.stdout.write(str(report))

    for w in warnings:
        sys.stderr.write(f"[warn] {w}\n")

    return 0


# ────────────────── parser + main ──────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ocr-vault",
        description=(
            "OCR pipeline for engineering coursework — PDF → JSON sidecars "
            "+ SQLite index."
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_status = sub.add_parser(
        "status",
        help="Print per-course OCR state summary.",
    )
    p_status.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_status.set_defaults(func=_cmd_status)

    return parser


def main(argv: Iterable[str] | None = None) -> int:
    """CLI entry point. Returns an integer exit code."""
    parser = _build_parser()
    args_list = list(argv) if argv is not None else sys.argv[1:]
    if not args_list:
        parser.print_help(sys.stderr)
        return 2
    try:
        ns = parser.parse_args(args_list)
    except SystemExit as e:
        # argparse calls sys.exit(2) on parse error; convert to return.
        return int(e.code) if e.code is not None else 2
    rc: int = ns.func(ns)
    return rc


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
