"""``ocr-vault`` CLI entry point.

Thin glue: subcommand dispatch + disk I/O. Real work happens in pure
modules (``status_report``, ``ocr_config``, ``sidecar_schema``,
``add_orchestrator``).

Currently implemented subcommands:
    status     Print a per-course summary of OCR state.
    add        OCR a PDF: sidecars + page images + index updates.

Future subcommands (placeholders): search, list-problems,
list-pii, list-candidates, retry, crop, re-ocr, export.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Iterable
from decimal import Decimal
from pathlib import Path

from ocr_vault.add_orchestrator import AddOrchestrator, OrchestratorError
from ocr_vault.cost_ledger import CostLedger
from ocr_vault.listings import (
    list_pii,
    list_problems,
    rank_candidates,
)
from ocr_vault.ocr_config import OcrConfig, OcrConfigError, load_ocr_config
from ocr_vault.pdf_loader import MockPdfLoader, PdfLoader
from ocr_vault.provider import ProviderError, get_provider
from ocr_vault.search_index import SearchError
from ocr_vault.sidecar_schema import (
    Sidecar,
    SidecarValidationError,
    validate_sidecar,
)
from ocr_vault.sqlite_index import SqliteIndex
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


# ────────────────── command: add ───────────────────────────────────────────


def _build_pdf_loader(mock_pages: int | None) -> PdfLoader:
    """Construct a PDF loader. Today only MockPdfLoader exists.

    Real pypdfium2 wiring is deferred to a follow-up (see #36 / plan §2.3).
    For now, ``--mock-pages N`` lets the user exercise the full pipeline end
    to end without binary PDF dependencies.
    """
    if mock_pages is None:
        raise OrchestratorError(
            "Real PDF rendering is not yet implemented. "
            "Pass --mock-pages N for a deterministic synthetic loader."
        )
    return MockPdfLoader(page_count=mock_pages)


def _cmd_add(args: argparse.Namespace) -> int:
    pdf_path = Path(args.pdf)
    data_dir = Path(args.data_dir)
    course_slug: str = args.course

    try:
        pdf_loader = _build_pdf_loader(args.mock_pages)
    except OrchestratorError as e:
        sys.stderr.write(f"[error] {e}\n")
        return 1

    try:
        provider = get_provider(args.provider)
    except ProviderError as e:
        sys.stderr.write(f"[error] {e}\n")
        return 1

    ledger = CostLedger(
        hard_cap_usd=Decimal(str(args.max_cost)),
        soft_warn_usd=Decimal(str(args.warn_cost)),
    )
    index_path = data_dir / "index.sqlite"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index = SqliteIndex.open(index_path)

    orch = AddOrchestrator(
        pdf_loader=pdf_loader,
        provider=provider,
        ledger=ledger,
        index=index,
        data_dir=data_dir,
        provider_family=args.provider,
    )

    try:
        result = orch.run(pdf_path=pdf_path, course_slug=course_slug)
    except OrchestratorError as e:
        sys.stderr.write(f"[error] {e}\n")
        index.close()
        return 1

    sys.stdout.write(
        f"ocr-vault add — {pdf_path.name} → {course_slug}\n"
        f"  pages processed : {result.pages_processed}\n"
        f"  pages cached    : {result.pages_cached}\n"
        f"  total cost      : ${result.cost_total_usd}\n"
        f"  needs review    : {result.pages_needs_review}\n"
        f"  needs redaction : {result.pages_needs_redaction}\n"
    )
    index.close()
    return 0


# ────────────────── command: search ────────────────────────────────────────


def _cmd_search(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    index_path = data_dir / "index.sqlite"

    if not index_path.exists():
        sys.stderr.write(
            f"[error] no index at {index_path} — run `ocr-vault add` first.\n"
        )
        return 1

    index = SqliteIndex.open(index_path)
    course = args.course if args.course else None
    try:
        hits = index.search(args.query, course=course, limit=args.limit)
    except SearchError as e:
        sys.stderr.write(f"[error] {e}\n")
        index.close()
        return 1

    if not hits:
        sys.stdout.write(f"no matches for {args.query!r}\n")
        index.close()
        return 0

    for h in hits:
        sys.stdout.write(
            f"{h.course}  {h.pdf}  page {h.page}  (score {h.score:.2f})\n"
            f"    {h.snippet}\n"
        )
    index.close()
    return 0


# ────────────────── command: list-* (problems / pii / candidates) ─────────


def _course_sidecars(
    data_dir: Path, course_slug: str, *, warn: Callable[[str], None]
) -> list[Sidecar]:
    """Load all valid sidecars for a single course."""
    by_course = _scan_sidecars(data_dir, warn=warn)
    return by_course.get(course_slug, [])


def _print_table(
    headers: list[str],
    rows: list[list[str]],
) -> None:
    """Print a Rich table to stdout."""
    from rich.console import Console
    from rich.table import Table

    console = Console(file=sys.stdout)
    table = Table(show_header=True, header_style="bold")
    for h in headers:
        table.add_column(h)
    for row in rows:
        table.add_row(*row)
    console.print(table)


def _cmd_list_problems(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    course_slug: str = args.course
    warnings: list[str] = []
    sidecars = _course_sidecars(
        data_dir, course_slug, warn=lambda m: warnings.append(m)
    )

    rows = list_problems(sidecars)
    if not rows:
        sys.stdout.write(f"no problem statements detected for course {course_slug!r}\n")
    else:
        _print_table(
            ["pdf", "page", "problem_id", "confidence", "snippet"],
            [
                [r.pdf, str(r.page), r.problem_id, f"{r.confidence:.2f}", r.snippet]
                for r in rows
            ],
        )
    for w in warnings:
        sys.stderr.write(f"[warn] {w}\n")
    return 0


def _cmd_list_pii(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    course_slug: str = args.course
    warnings: list[str] = []
    sidecars = _course_sidecars(
        data_dir, course_slug, warn=lambda m: warnings.append(m)
    )

    rows = list_pii(sidecars)
    if not rows:
        sys.stdout.write(f"no pages flagged for PII review in course {course_slug!r}\n")
    else:
        _print_table(
            ["pdf", "page", "names_detected", "akwasi_present"],
            [
                [
                    r.pdf,
                    str(r.page),
                    ", ".join(r.names_detected) or "—",
                    "yes" if r.akwasi_present else "no",
                ]
                for r in rows
            ],
        )
    for w in warnings:
        sys.stderr.write(f"[warn] {w}\n")
    return 0


def _cmd_list_candidates(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    course_slug: str = args.course
    limit: int = args.limit
    warnings: list[str] = []
    sidecars = _course_sidecars(
        data_dir, course_slug, warn=lambda m: warnings.append(m)
    )

    rows = rank_candidates(sidecars, limit=limit)
    if not rows:
        sys.stdout.write(
            f"no favorite-page candidates for course {course_slug!r}\n"
        )
    else:
        _print_table(
            ["rank", "pdf", "page", "score", "density", "conf", "pii_penalty"],
            [
                [
                    str(i + 1),
                    r.pdf,
                    str(r.page),
                    f"{r.score:.3f}",
                    f"{r.breakdown['work_density']:.3f}",
                    f"{r.breakdown['confidence']:.2f}",
                    f"{r.breakdown['pii_penalty']:.2f}",
                ]
                for i, r in enumerate(rows)
            ],
        )
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

    p_add = sub.add_parser(
        "add",
        help="OCR a PDF and write sidecars + page images + index entries.",
    )
    p_add.add_argument("pdf", help="Path to the PDF file.")
    p_add.add_argument(
        "--course",
        required=True,
        help="Course slug (e.g., machine-learning).",
    )
    p_add.add_argument(
        "--provider",
        default="mock",
        help="Provider name (mock|anthropic|openai|gemini|claude|gpt-4o|...).",
    )
    p_add.add_argument(
        "--max-cost",
        type=float,
        default=50.0,
        help="Hard cap on USD spend for this run (default: 50).",
    )
    p_add.add_argument(
        "--warn-cost",
        type=float,
        default=10.0,
        help="Soft warning threshold in USD (default: 10).",
    )
    p_add.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_add.add_argument(
        "--mock-pages",
        type=int,
        default=None,
        help=(
            "When set, use a deterministic MockPdfLoader with N pages. "
            "Required until real PDF rendering lands."
        ),
    )
    p_add.set_defaults(func=_cmd_add)

    p_search = sub.add_parser(
        "search",
        help=(
            "Full-text search across OCR'd prose, LaTeX, and topics. "
            "Supports phrase queries, OR / NOT, and column filters."
        ),
    )
    p_search.add_argument(
        "query",
        help='FTS5 query string (e.g., "fourier OR convolution", "\\"gradient descent\\"").',
    )
    p_search.add_argument(
        "--course",
        default="",
        help="Restrict matches to a single course slug (default: all).",
    )
    p_search.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum hits to print (default: 10).",
    )
    p_search.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_search.set_defaults(func=_cmd_search)

    # ─── list-problems / list-pii / list-candidates (#39) ─────────────
    for cmd_name, cmd_help, cmd_fn in (
        (
            "list-problems",
            "Print every detected problem_statement block for a course.",
            _cmd_list_problems,
        ),
        (
            "list-pii",
            "Print every page flagged for PII review for a course.",
            _cmd_list_pii,
        ),
        (
            "list-candidates",
            "Rank and print top-N favorite-page candidates for a course.",
            _cmd_list_candidates,
        ),
    ):
        p_list = sub.add_parser(cmd_name, help=cmd_help)
        p_list.add_argument(
            "--course",
            required=True,
            help="Course slug (e.g., machine-learning).",
        )
        p_list.add_argument(
            "--data-dir",
            default="data",
            help="Path to the data/ root (default: ./data).",
        )
        if cmd_name == "list-candidates":
            p_list.add_argument(
                "--limit",
                type=int,
                default=10,
                help="Number of candidates to print (default: 10).",
            )
        p_list.set_defaults(func=cmd_fn)

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
