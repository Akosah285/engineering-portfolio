"""Tests for the export module (closes #42).

Pure module tests over a synthetic Sidecar list. The ``mdx_exporter``
takes the blocks belonging to a single ``problem_id`` and produces a
ready-to-paste ``<FeaturedProblem>`` MDX snippet plus alternate JSON /
raw-text representations for downstream tooling.
"""

from __future__ import annotations

from collections.abc import Sequence

import pytest

from ocr_vault.exporter import (
    ExportFormat,
    ExportNotFoundError,
    collect_problem_blocks,
    export_problem,
)
from ocr_vault.sidecar_schema import (
    Block,
    Extracted,
    Model,
    Pii,
    Sidecar,
    Source,
)


def _make_sidecar(
    *,
    page: int = 1,
    pdf: str = "hw1.pdf",
    blocks: Sequence[Block] = (),
) -> Sidecar:
    return Sidecar(
        source=Source(
            pdf=pdf,
            page=page,
            page_hash=f"sha256:{page:064d}",
        ),
        extracted=Extracted(
            blocks=list(blocks),
            topics=[],
            confidence=0.9,
            needs_review=False,
        ),
        pii=Pii(names_detected=[], akwasi_present=False, needs_redaction_review=False),
        model=Model(provider="mock", model_id="m1", ocr_version="1.0.0"),
    )


# ─────────────── collect_problem_blocks ───────────────────────────────────


class TestCollectProblemBlocks:
    def test_finds_blocks_across_pages_and_orders_by_page(self) -> None:
        sc1 = _make_sidecar(
            pdf="hw1.pdf",
            page=1,
            blocks=[
                Block(type="problem_statement", problem_id="3a", prose="Statement"),
                Block(type="solution_step", problem_id="3a", prose="Step 1"),
                Block(type="problem_statement", problem_id="3b", prose="Other problem"),
            ],
        )
        sc2 = _make_sidecar(
            pdf="hw1.pdf",
            page=2,
            blocks=[
                Block(type="solution_step", problem_id="3a", prose="Step 2"),
            ],
        )
        result = collect_problem_blocks([sc2, sc1], problem_id="3a")
        assert result.problem_id == "3a"
        # Source page metadata.
        assert result.pages == [1, 2]
        # Block order: problem_statement first, then solution_steps in page order.
        assert [b.prose for b in result.blocks] == ["Statement", "Step 1", "Step 2"]

    def test_raises_when_problem_id_missing(self) -> None:
        sc = _make_sidecar(blocks=[Block(type="prose", prose="random")])
        with pytest.raises(ExportNotFoundError) as exc:
            collect_problem_blocks([sc], problem_id="99")
        assert "99" in str(exc.value)

    def test_includes_only_problem_and_solution_block_types(self) -> None:
        # Figures with the same problem_id should NOT be included
        # (figures don't render to MDX text content).
        sc = _make_sidecar(
            blocks=[
                Block(type="problem_statement", problem_id="1", prose="Stmt"),
                Block(type="figure", problem_id="1", caption="A figure"),
                Block(type="solution_step", problem_id="1", prose="Step"),
            ],
        )
        result = collect_problem_blocks([sc], problem_id="1")
        assert [b.type for b in result.blocks] == ["problem_statement", "solution_step"]


# ─────────────── export_problem (mdx) ──────────────────────────────────────


class TestExportMdx:
    def _fixture(self) -> list[Sidecar]:
        return [
            _make_sidecar(
                pdf="hw3.pdf",
                page=4,
                blocks=[
                    Block(
                        type="problem_statement",
                        problem_id="3a",
                        prose="Find the Fourier coefficients of f(x) = x.",
                        latex=r"a_n = \frac{1}{\pi}\int_{-\pi}^{\pi} f(x)\cos(nx)\,dx",
                    ),
                    Block(
                        type="solution_step",
                        problem_id="3a",
                        prose="Apply orthogonality.",
                        latex=r"a_n = 0,\ b_n = \frac{2(-1)^{n+1}}{n}",
                    ),
                ],
            )
        ]

    def test_renders_featured_problem_wrapper(self) -> None:
        out = export_problem(
            self._fixture(),
            course_slug="fourier-transforms",
            problem_id="3a",
            fmt=ExportFormat.MDX,
        )
        assert "<FeaturedProblem" in out
        assert "</FeaturedProblem>" in out

    def test_renders_paraphrase_scaffold_comment(self) -> None:
        out = export_problem(
            self._fixture(),
            course_slug="fourier-transforms",
            problem_id="3a",
            fmt=ExportFormat.MDX,
        )
        assert "PARAPHRASE" in out

    def test_renders_attribution_stub(self) -> None:
        out = export_problem(
            self._fixture(),
            course_slug="fourier-transforms",
            problem_id="3a",
            fmt=ExportFormat.MDX,
        )
        # Attribution should reference the course slug + a hint to fill term.
        assert "fourier-transforms" in out.lower() or "fourier" in out.lower()
        assert "Adapted from" in out

    def test_renders_block_math(self) -> None:
        out = export_problem(
            self._fixture(),
            course_slug="fourier-transforms",
            problem_id="3a",
            fmt=ExportFormat.MDX,
        )
        assert r"\frac{1}{\pi}" in out
        # Block math fenced by `$$ ... $$` for KaTeX SSR.
        assert "$$" in out

    def test_renders_solution_step_section(self) -> None:
        out = export_problem(
            self._fixture(),
            course_slug="fourier-transforms",
            problem_id="3a",
            fmt=ExportFormat.MDX,
        )
        # Solution step prose appears.
        assert "Apply orthogonality" in out

    def test_raises_when_no_blocks_for_problem_id(self) -> None:
        with pytest.raises(ExportNotFoundError):
            export_problem(
                self._fixture(),
                course_slug="fourier-transforms",
                problem_id="missing",
                fmt=ExportFormat.MDX,
            )


# ─────────────── export_problem (json) ─────────────────────────────────────


class TestExportJson:
    def test_emits_valid_json_with_blocks(self) -> None:
        import json

        sc = _make_sidecar(
            blocks=[
                Block(
                    type="problem_statement",
                    problem_id="1",
                    prose="A statement.",
                    latex=r"x^2",
                )
            ]
        )
        out = export_problem(
            [sc], course_slug="ml", problem_id="1", fmt=ExportFormat.JSON
        )
        parsed = json.loads(out)
        assert parsed["problem_id"] == "1"
        assert parsed["course"] == "ml"
        assert len(parsed["blocks"]) == 1
        assert parsed["blocks"][0]["latex"] == "x^2"


# ─────────────── export_problem (raw-text) ─────────────────────────────────


class TestExportRawText:
    def test_emits_plain_text_with_separators(self) -> None:
        sc = _make_sidecar(
            blocks=[
                Block(
                    type="problem_statement",
                    problem_id="1",
                    prose="The statement.",
                ),
                Block(type="solution_step", problem_id="1", prose="The step."),
            ]
        )
        out = export_problem(
            [sc], course_slug="ml", problem_id="1", fmt=ExportFormat.RAW_TEXT
        )
        assert "The statement." in out
        assert "The step." in out
        # No MDX/JSON markers in raw-text mode.
        assert "<FeaturedProblem" not in out
        assert "{" not in out  # no JSON
