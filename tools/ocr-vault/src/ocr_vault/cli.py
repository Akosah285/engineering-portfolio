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
from typing import Final

from ocr_vault.add_orchestrator import AddOrchestrator, OrchestratorError
from ocr_vault.batch_estimator import (
    BatchManifestError,
    default_avg_input_tokens_per_page,
    default_avg_output_tokens_per_page,
    estimate_batch_cost,
    format_estimate_report,
    load_batch_manifest,
)
from ocr_vault.cost_ledger import CostLedger
from ocr_vault.cropper import (
    BBox,
    CropError,
    PypdfiumPageRenderer,
    crop_favorite_page,
)
from ocr_vault.exporter import (
    ExportFormat,
    ExportNotFoundError,
    export_problem,
)
from ocr_vault.listings import (
    list_pii,
    list_problems,
    rank_candidates,
)
from ocr_vault.ocr_config import OcrConfig, OcrConfigError, load_ocr_config
from ocr_vault.pdf_loader import MockPdfLoader, PdfLoader
from ocr_vault.provider import ProviderError, get_provider
from ocr_vault.reocr_orchestrator import (
    ReocrOrchestrator,
    ReocrOrchestratorError,
)
from ocr_vault.reocr_planner import (
    ReocrFilter,
    ReocrPlannerError,
    build_reocr_plan,
)
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


# ────────────────── command: cost (#34) ───────────────────────────────────


def _cmd_cost(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    index_path = data_dir / "index.sqlite"
    if not index_path.exists():
        sys.stderr.write(
            f"[error] no index at {index_path} — run `ocr-vault add` first.\n"
        )
        return 1

    index = SqliteIndex.open(index_path)
    try:
        total = index.total_cost_usd()
        initial = index.total_initial_cost_usd()
        re_ocr = index.total_re_ocr_cost_usd()
        by_course = index.cost_by_course()
        n_calls = index.count_calls()

        sys.stdout.write(
            "ocr-vault cost report\n"
            f"  total spend     : ${total}\n"
            f"  initial pass    : ${initial}\n"
            f"  re-ocr passes   : ${re_ocr}\n"
            f"  api calls       : {n_calls}\n"
        )

        if args.by_course and by_course:
            sys.stdout.write("\nby course:\n")
            _print_table(
                ["course", "total_usd"],
                [
                    [course, f"${cost}"]
                    for course, cost in sorted(
                        by_course.items(), key=lambda kv: -kv[1]
                    )
                ],
            )
        elif args.by_course:
            sys.stdout.write("\nno per-course costs recorded yet.\n")
    finally:
        index.close()
    return 0


# ────────────────── command: export (#42) ─────────────────────────────────


def _cmd_export(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    course_slug: str = args.course
    problem_id: str = args.problem_id
    fmt = ExportFormat(args.format)

    warnings: list[str] = []
    sidecars = _course_sidecars(
        data_dir, course_slug, warn=lambda m: warnings.append(m)
    )
    if not sidecars:
        sys.stderr.write(
            f"[error] no sidecars found for course {course_slug!r} in {data_dir}\n"
        )
        for w in warnings:
            sys.stderr.write(f"[warn] {w}\n")
        return 1

    try:
        snippet = export_problem(
            sidecars,
            course_slug=course_slug,
            problem_id=problem_id,
            fmt=fmt,
        )
    except ExportNotFoundError as e:
        sys.stderr.write(f"[error] {e}\n")
        for w in warnings:
            sys.stderr.write(f"[warn] {w}\n")
        return 1

    sys.stdout.write(snippet)
    if not snippet.endswith("\n"):
        sys.stdout.write("\n")
    for w in warnings:
        sys.stderr.write(f"[warn] {w}\n")
    return 0


# ────────────────── command: crop (#41) ───────────────────────────────────


def _parse_bbox(spec: str) -> BBox:
    parts = spec.split(",")
    if len(parts) != 4:
        raise ValueError(
            f"--bbox must be x,y,w,h (4 comma-separated ints), got {spec!r}"
        )
    try:
        x, y, w, h = (int(p.strip()) for p in parts)
    except ValueError as e:
        raise ValueError(f"--bbox values must be integers: {spec!r}") from e
    return BBox(x=x, y=y, width=w, height=h)


def _find_sidecar_by_page_hash(
    data_dir: Path, page_hash: str
) -> tuple[str, Sidecar] | None:
    """Walk all course sidecars; return (course_slug, Sidecar) on match."""
    by_course = _scan_sidecars(data_dir, warn=lambda _m: None)
    for course_slug, sidecars in by_course.items():
        for sc in sidecars:
            if sc.source.page_hash == page_hash:
                return course_slug, sc
    return None


def _cmd_crop(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    archive_dir = Path(args.archive_dir)

    try:
        bbox = _parse_bbox(args.bbox)
    except ValueError as e:
        sys.stderr.write(f"[error] {e}\n")
        return 1

    found = _find_sidecar_by_page_hash(data_dir, args.page_hash)
    if found is None:
        sys.stderr.write(
            f"[error] no sidecar found for page_hash={args.page_hash!r}\n"
        )
        return 1

    course_slug, sidecar = found
    pdf_stem = Path(sidecar.source.pdf).stem
    pdf_path = archive_dir / course_slug / sidecar.source.pdf
    if not pdf_path.exists():
        # Fall back to a flat archive layout.
        flat_pdf = archive_dir / sidecar.source.pdf
        if flat_pdf.exists():
            pdf_path = flat_pdf
        else:
            sys.stderr.write(
                f"[error] source PDF not found at {pdf_path} or {flat_pdf}\n"
            )
            return 1

    out_dir = data_dir / "page-images" / course_slug / pdf_stem
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"page-{sidecar.source.page}-favorite.png"

    renderer = PypdfiumPageRenderer()
    try:
        png = crop_favorite_page(
            renderer=renderer,
            pdf_path=pdf_path,
            page_index=sidecar.source.page - 1,  # 1-indexed → 0-indexed
            bbox=bbox,
            sidecar=sidecar,
            rotation_degrees=args.rotation,
            redaction_regions=[],
        )
    except CropError as e:
        sys.stderr.write(f"[error] crop failed: {e}\n")
        return 1
    except Exception as e:
        sys.stderr.write(f"[error] PDF render failed: {e}\n")
        return 1

    out_path.write_bytes(png)
    sys.stdout.write(
        f"ocr-vault crop — wrote {out_path} ({len(png)} bytes)\n"
    )
    return 0


# ────────────────── command: plan (#43 prep) ──────────────────────────────


_DEFAULT_BATCH_MANIFEST_NAME: Final[str] = "batch-manifest.json"


def _cmd_plan(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    manifest_path = (
        Path(args.manifest)
        if args.manifest
        else data_dir / _DEFAULT_BATCH_MANIFEST_NAME
    )

    try:
        manifest = load_batch_manifest(manifest_path)
    except BatchManifestError as e:
        sys.stderr.write(f"[error] manifest: {e}\n")
        return 1

    try:
        estimate = estimate_batch_cost(
            manifest,
            model=args.model,
            avg_input_tokens_per_page=args.avg_input_tokens,
            avg_output_tokens_per_page=args.avg_output_tokens,
            hard_cap_usd=Decimal(str(args.max_cost)),
            soft_warn_usd=Decimal(str(args.warn_cost)),
        )
    except ValueError as e:
        sys.stderr.write(f"[error] {e}\n")
        return 1

    sys.stdout.write(format_estimate_report(estimate))
    return 0


# ────────────────── command: re-ocr (#40) ─────────────────────────────────


_REOCR_CONFIRM_THRESHOLD_USD = Decimal("5.00")
_REOCR_ESTIMATED_COST_PER_PAGE_USD = Decimal("0.03")


def _cmd_reocr(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)

    def _warn(m: str) -> None:
        sys.stderr.write(f"[warn] {m}\n")

    sidecars_by_course = _scan_sidecars(data_dir, warn=_warn)
    config = _load_config(data_dir, warn=_warn)

    threshold = config.threshold_for(args.course or "")

    filter_ = ReocrFilter(
        course=args.course,
        low_confidence=args.low_confidence,
        needs_review=args.needs_review,
        from_version=args.from_version,
        page_hash=args.page_hash,
        featured_only=args.featured_only,
        all=args.all,
    )

    try:
        plan = build_reocr_plan(
            sidecars_by_course,
            filter_=filter_,
            low_confidence_threshold=threshold,
            estimated_cost_per_page_usd=_REOCR_ESTIMATED_COST_PER_PAGE_USD,
        )
    except ReocrPlannerError as e:
        sys.stderr.write(f"[error] {e}\n")
        return 1

    sys.stdout.write(
        "ocr-vault re-ocr — plan\n"
        f"  pages selected     : {len(plan.pages)}\n"
        f"  estimated cost     : ${plan.estimated_cost_usd}\n"
        f"  est. per page      : ${_REOCR_ESTIMATED_COST_PER_PAGE_USD}\n"
        f"  low-conf threshold : {threshold:.2f}\n"
    )
    if plan.sample_page is not None:
        sys.stdout.write(
            f"\nsample page (for diff preview): "
            f"{plan.sample_page.course}/{plan.sample_page.sidecar.source.pdf} "
            f"page {plan.sample_page.sidecar.source.page} "
            f"({plan.sample_page.reason})\n"
        )

    if not args.apply:
        sys.stdout.write(
            "\n[dry-run] no API calls made. Re-run with --apply to execute.\n"
        )
        return 0

    if (
        plan.estimated_cost_usd > _REOCR_CONFIRM_THRESHOLD_USD
        and not args.confirm
    ):
        sys.stderr.write(
            f"[error] estimated cost ${plan.estimated_cost_usd} exceeds "
            f"${_REOCR_CONFIRM_THRESHOLD_USD} — re-run with --confirm to proceed.\n"
        )
        return 1

    if not plan.pages:
        sys.stdout.write("\nno pages selected — nothing to do.\n")
        return 0

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

    orch = ReocrOrchestrator(
        provider=provider,
        ledger=ledger,
        index=index,
        data_dir=data_dir,
        provider_family=args.provider,
    )

    try:
        result = orch.run(plan.pages, keep_history=args.keep_history)
    except ReocrOrchestratorError as e:
        sys.stderr.write(f"[error] {e}\n")
        index.close()
        return 1

    sys.stdout.write(
        "\nocr-vault re-ocr — complete\n"
        f"  pages re-ocr'd : {result.pages_redone}\n"
        f"  pages skipped  : {result.pages_skipped}\n"
        f"  total cost     : ${result.cost_total_usd}\n"
    )
    index.close()
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

    # ─── cost (#34) ────────────────────────────────────────────────────
    p_cost = sub.add_parser(
        "cost",
        help="Print total OCR spend, with optional per-course breakdown.",
    )
    p_cost.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_cost.add_argument(
        "--by-course",
        action="store_true",
        help="Also print a per-course cost table.",
    )
    p_cost.set_defaults(func=_cmd_cost)

    # ─── export (#42) ──────────────────────────────────────────────────
    p_export = sub.add_parser(
        "export",
        help="Export a featured problem as MDX / JSON / raw-text.",
    )
    p_export.add_argument("--course", required=True, help="Course slug.")
    p_export.add_argument(
        "--problem-id", required=True, help='Problem id (e.g. "3a").'
    )
    p_export.add_argument(
        "--format",
        choices=[f.value for f in ExportFormat],
        default=ExportFormat.MDX.value,
        help="Output format (default: mdx).",
    )
    p_export.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_export.set_defaults(func=_cmd_export)

    # ─── crop (#41) ────────────────────────────────────────────────────
    p_crop = sub.add_parser(
        "crop",
        help="Re-render a PDF page at 400 DPI, crop to bbox, write favorite PNG.",
    )
    p_crop.add_argument("--page-hash", required=True, help="sha256:... page hash.")
    p_crop.add_argument(
        "--bbox",
        required=True,
        help="Crop bbox in 400-DPI pixels: x,y,w,h (e.g. 100,200,800,1066).",
    )
    p_crop.add_argument(
        "--rotation",
        type=int,
        default=0,
        help="Rotate the page CCW by this many degrees (0/90/180/270).",
    )
    p_crop.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_crop.add_argument(
        "--archive-dir",
        default="archive/originals",
        help="Path to PDF originals (default: ./archive/originals).",
    )
    p_crop.set_defaults(func=_cmd_crop)

    # ─── re-ocr (#40) ──────────────────────────────────────────────────
    p_reocr = sub.add_parser(
        "re-ocr",
        help="Re-run OCR on filtered pages. Dry-run by default; --apply to execute.",
    )
    p_reocr.add_argument(
        "--course",
        default=None,
        help="Limit to a single course slug (combine with another selector).",
    )
    p_reocr.add_argument(
        "--low-confidence",
        action="store_true",
        help="Pick pages with confidence below the configured threshold.",
    )
    p_reocr.add_argument(
        "--needs-review",
        action="store_true",
        help="Pick pages flagged needs_review.",
    )
    p_reocr.add_argument(
        "--from-version",
        default=None,
        help="Pick pages whose sidecar.model.ocr_version matches exactly.",
    )
    p_reocr.add_argument(
        "--page-hash",
        default=None,
        help="Pick a single specific page by sha256 page_hash.",
    )
    p_reocr.add_argument(
        "--featured-only",
        action="store_true",
        help="Pick only pages whose blocks contain a problem_statement.",
    )
    p_reocr.add_argument(
        "--all",
        action="store_true",
        help="Pick every sidecar (requires --confirm above the cost threshold).",
    )
    p_reocr.add_argument(
        "--keep-history",
        action="store_true",
        help="Archive the prior sidecar to page-N.v<old-version>.json before overwriting.",
    )
    p_reocr.add_argument(
        "--apply",
        action="store_true",
        help="Actually run the re-ocr (default is dry-run).",
    )
    p_reocr.add_argument(
        "--confirm",
        action="store_true",
        help=f"Required when estimated cost > ${_REOCR_CONFIRM_THRESHOLD_USD}.",
    )
    p_reocr.add_argument(
        "--provider",
        default="mock",
        help="OCR provider for re-extraction (default: mock).",
    )
    p_reocr.add_argument(
        "--max-cost",
        type=float,
        default=50.0,
        help="Hard cost cap in USD (default: 50).",
    )
    p_reocr.add_argument(
        "--warn-cost",
        type=float,
        default=10.0,
        help="Soft warning cost in USD (default: 10).",
    )
    p_reocr.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_reocr.set_defaults(func=_cmd_reocr)

    # ─── plan (#43 prep — cost projection, no API calls) ──────────────
    p_plan = sub.add_parser(
        "plan",
        help=(
            "Project total OCR spend across the courses in a batch manifest. "
            "Pre-flight estimator — no provider calls."
        ),
    )
    p_plan.add_argument(
        "--manifest",
        default=None,
        help=(
            "Path to a batch manifest JSON file "
            "(default: <data-dir>/batch-manifest.json)."
        ),
    )
    p_plan.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ root (default: ./data).",
    )
    p_plan.add_argument(
        "--model",
        default="claude-sonnet-4.5",
        help="Model id to price against (default: claude-sonnet-4.5).",
    )
    p_plan.add_argument(
        "--avg-input-tokens",
        type=int,
        default=default_avg_input_tokens_per_page(),
        help=(
            "Expected average input tokens per page "
            f"(default: {default_avg_input_tokens_per_page()})."
        ),
    )
    p_plan.add_argument(
        "--avg-output-tokens",
        type=int,
        default=default_avg_output_tokens_per_page(),
        help=(
            "Expected average output tokens per page "
            f"(default: {default_avg_output_tokens_per_page()})."
        ),
    )
    p_plan.add_argument(
        "--max-cost",
        type=float,
        default=50.0,
        help="Hard cost cap in USD for cap-status flag (default: 50).",
    )
    p_plan.add_argument(
        "--warn-cost",
        type=float,
        default=10.0,
        help="Soft warning threshold in USD (default: 10).",
    )
    p_plan.set_defaults(func=_cmd_plan)

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
