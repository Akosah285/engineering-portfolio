"""Featured-problem exporter — emits MDX / JSON / raw-text snippets (closes #42).

The ``export`` function takes a Sequence[Sidecar] (typically all sidecars
for a single course), filters down to blocks belonging to a target
``problem_id``, orders them (problem_statement first, solution_steps in
page order), and renders one of three formats:

    MDX        — ready-to-paste <FeaturedProblem> wrapper with paraphrase
                 scaffold + KaTeX block math + attribution stub.
                 Author hand-edits before shipping.
    JSON       — structured dump for downstream tooling.
    RAW_TEXT   — plain prose + LaTeX with separators.

The exporter is deterministic and side-effect-free; the CLI layer
handles I/O and stdout writing.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum

from ocr_vault.sidecar_schema import Block, Sidecar

_PROBLEM_BLOCK_TYPES = ("problem_statement", "solution_step")


class ExportFormat(Enum):
    MDX = "mdx"
    JSON = "json"
    RAW_TEXT = "raw-text"


class ExportNotFoundError(LookupError):
    """Raised when no blocks match the requested problem_id."""


@dataclass(frozen=True, slots=True)
class ProblemBlocks:
    problem_id: str
    pages: list[int]
    blocks: list[Block]


# ─────────────── collection ────────────────────────────────────────────────


def collect_problem_blocks(
    sidecars: Sequence[Sidecar], *, problem_id: str
) -> ProblemBlocks:
    """Gather all problem_statement + solution_step blocks for ``problem_id``.

    Blocks are ordered by:
        1. block type (problem_statement first, then solution_step)
        2. source page (ascending) for tie-breaks within type

    Raises ``ExportNotFoundError`` if no matching blocks are found.
    """
    matches: list[tuple[int, int, Block]] = []
    pages_seen: set[int] = set()
    for sc in sidecars:
        for block in sc.extracted.blocks:
            if (
                block.problem_id == problem_id
                and block.type in _PROBLEM_BLOCK_TYPES
            ):
                # Sort key: problem_statement (0) before solution_step (1),
                # then by source page.
                type_rank = 0 if block.type == "problem_statement" else 1
                matches.append((type_rank, sc.source.page, block))
                pages_seen.add(sc.source.page)

    if not matches:
        raise ExportNotFoundError(
            f"no problem_statement / solution_step blocks found for problem_id={problem_id!r}"
        )

    matches.sort(key=lambda t: (t[0], t[1]))
    return ProblemBlocks(
        problem_id=problem_id,
        pages=sorted(pages_seen),
        blocks=[m[2] for m in matches],
    )


# ─────────────── format renderers ──────────────────────────────────────────


def _render_mdx(course_slug: str, pb: ProblemBlocks) -> str:
    statements = [b for b in pb.blocks if b.type == "problem_statement"]
    steps = [b for b in pb.blocks if b.type == "solution_step"]

    lines: list[str] = []
    lines.append(f'<FeaturedProblem problemId="{pb.problem_id}">')
    lines.append("")
    lines.append("  ### Problem")
    lines.append("")
    lines.append(
        "  <!-- PARAPHRASE: rewrite the problem statement in Akwasi's voice. "
        "Keep mathematical content identical; tighten language. -->"
    )
    for stmt in statements:
        if stmt.prose:
            lines.append(f"  {stmt.prose}")
            lines.append("")
        if stmt.latex:
            lines.append("  $$")
            lines.append(f"  {stmt.latex}")
            lines.append("  $$")
            lines.append("")

    if steps:
        lines.append("  ### Solution")
        lines.append("")
        for i, step in enumerate(steps, start=1):
            lines.append(f"  **Step {i}.** ")
            if step.prose:
                lines.append(f"  {step.prose}")
                lines.append("")
            if step.latex:
                lines.append("  $$")
                lines.append(f"  {step.latex}")
                lines.append("  $$")
                lines.append("")

    pages_str = ", ".join(str(p) for p in pb.pages)
    lines.append(
        f'  <Attribution>Adapted from Dartmouth ENGS — {course_slug} '
        f"(pages {pages_str}). <!-- TODO: add term, e.g. FA20 --></Attribution>"
    )
    lines.append("")
    lines.append("</FeaturedProblem>")
    lines.append("")
    return "\n".join(lines)


def _render_json(course_slug: str, pb: ProblemBlocks) -> str:
    payload = {
        "course": course_slug,
        "problem_id": pb.problem_id,
        "pages": pb.pages,
        "blocks": [
            {
                "type": b.type,
                "problem_id": b.problem_id,
                "prose": b.prose,
                "latex": b.latex,
            }
            for b in pb.blocks
        ],
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def _render_raw_text(course_slug: str, pb: ProblemBlocks) -> str:
    lines: list[str] = [
        f"# {course_slug} — problem {pb.problem_id}",
        f"# pages: {', '.join(str(p) for p in pb.pages)}",
        "",
    ]
    for b in pb.blocks:
        lines.append(f"--- {b.type} ---")
        if b.prose:
            lines.append(b.prose)
        if b.latex:
            lines.append(b.latex)
        lines.append("")
    return "\n".join(lines)


# ─────────────── public entrypoint ─────────────────────────────────────────


def export_problem(
    sidecars: Sequence[Sidecar],
    *,
    course_slug: str,
    problem_id: str,
    fmt: ExportFormat,
) -> str:
    pb = collect_problem_blocks(sidecars, problem_id=problem_id)
    if fmt is ExportFormat.MDX:
        return _render_mdx(course_slug, pb)
    if fmt is ExportFormat.JSON:
        return _render_json(course_slug, pb)
    if fmt is ExportFormat.RAW_TEXT:
        return _render_raw_text(course_slug, pb)
    raise ValueError(f"unknown export format: {fmt!r}")
