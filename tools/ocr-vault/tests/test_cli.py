"""Tests for the ``ocr-vault`` CLI.

Subprocess-free tests — invoke ``cli.main()`` directly with explicit argv
and capture stdout. This keeps tests fast and lets us assert on the
output of the pure status_report module composed with disk I/O.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ocr_vault.cli import main

# ───────────────── fixtures ────────────────────────────────────────────────


def _write_sidecar(
    dir_: Path,
    *,
    page: int = 1,
    confidence: float = 0.9,
    needs_review: bool = False,
    needs_redaction: bool = False,
) -> Path:
    """Write a valid sidecar JSON file in dir_."""
    dir_.mkdir(parents=True, exist_ok=True)
    data = {
        "source": {
            "pdf": "hw1.pdf",
            "page": page,
            "page_hash": "sha256:" + ("a" * 64),
        },
        "extracted": {
            "blocks": [],
            "topics": [],
            "confidence": confidence,
            "needs_review": needs_review,
        },
        "pii": {
            "names_detected": [],
            "akwasi_present": False,
            "needs_redaction_review": needs_redaction,
        },
        "model": {
            "provider": "anthropic",
            "model_id": "claude-sonnet-4.5",
            "ocr_version": "1.0.0",
        },
    }
    path = dir_ / f"page-{page}.json"
    path.write_text(json.dumps(data))
    return path


# ───────────────── no-args / help ──────────────────────────────────────────


class TestHelpAndUsage:
    def test_no_args_prints_usage_and_returns_nonzero(
        self,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        rc = main([])
        captured = capsys.readouterr()
        out = captured.out + captured.err
        assert rc != 0
        assert "usage" in out.lower() or "ocr-vault" in out.lower()

    def test_unknown_command_returns_nonzero(
        self,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        rc = main(["bogus-subcommand"])
        assert rc != 0


# ───────────────── status command ──────────────────────────────────────────


class TestStatusCommand:
    def test_status_on_empty_dir_prints_no_data_message(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        rc = main(["status", "--data-dir", str(tmp_path)])
        out = capsys.readouterr().out
        assert rc == 0
        assert "ocr-vault status" in out
        assert "No OCR data yet" in out

    def test_status_reads_sidecars_from_data_dir(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        sidecars_root = tmp_path / "sidecars"
        ml_dir = sidecars_root / "machine-learning" / "hw1"
        fou_dir = sidecars_root / "fourier-transforms" / "hw2"
        _write_sidecar(ml_dir, page=1, confidence=0.85)
        _write_sidecar(ml_dir, page=2, confidence=0.65)
        _write_sidecar(fou_dir, page=1, confidence=0.55, needs_review=True)

        rc = main(["status", "--data-dir", str(tmp_path)])
        out = capsys.readouterr().out
        assert rc == 0
        assert "machine-learning" in out
        assert "fourier-transforms" in out

    def test_status_loads_per_course_threshold_from_config(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # ocr-config.json sets machine-learning to 0.6.
        config = {
            "global": {"low_confidence_threshold": 0.7},
            "per_course": {"machine-learning": {"low_confidence_threshold": 0.6}},
        }
        (tmp_path / "ocr-config.json").write_text(json.dumps(config))

        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        # confidence 0.65: low under global 0.7, NOT low under ml 0.6.
        _write_sidecar(ml_dir, page=1, confidence=0.65)

        rc = main(["status", "--data-dir", str(tmp_path)])
        out = capsys.readouterr().out
        assert rc == 0
        assert "0.60" in out  # threshold for ml row

    def test_status_skips_invalid_sidecars_with_warning(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        ml_dir.mkdir(parents=True)
        # Valid sidecar.
        _write_sidecar(ml_dir, page=1, confidence=0.9)
        # Invalid sidecar — missing 'source'.
        (ml_dir / "page-2.json").write_text(json.dumps({"oops": True}))
        # Non-JSON file (ignored — not a .json).
        (ml_dir / "README.txt").write_text("not a sidecar")

        rc = main(["status", "--data-dir", str(tmp_path)])
        captured = capsys.readouterr()
        out = captured.out + captured.err
        # Status should still succeed.
        assert rc == 0
        # And surface a warning about the bad file.
        assert "page-2.json" in out or "skipped" in out.lower() or "warn" in out.lower()

    def test_status_default_data_dir_is_repo_data(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Run from tmp_path so we don't pick up the real repo's data dir.
        monkeypatch.chdir(tmp_path)
        rc = main(["status"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "ocr-vault status" in out


# ───────────────── add command ─────────────────────────────────────────────


class TestAddCommand:
    def test_add_requires_mock_pages_until_real_loader_lands(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        rc = main(
            [
                "add",
                str(tmp_path / "hw1.pdf"),
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path / "data"),
            ]
        )
        captured = capsys.readouterr()
        assert rc != 0
        assert "mock-pages" in (captured.out + captured.err).lower()

    def test_add_with_mock_pages_writes_sidecars(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        data_dir = tmp_path / "data"
        rc = main(
            [
                "add",
                str(tmp_path / "hw1.pdf"),
                "--course",
                "machine-learning",
                "--provider",
                "mock",
                "--data-dir",
                str(data_dir),
                "--mock-pages",
                "2",
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "pages processed : 2" in out
        sidecar_dir = data_dir / "sidecars" / "machine-learning" / "hw1"
        assert (sidecar_dir / "page-1.json").exists()
        assert (sidecar_dir / "page-2.json").exists()
        assert (data_dir / "index.sqlite").exists()

    def test_add_invalid_course_slug_returns_nonzero(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        rc = main(
            [
                "add",
                str(tmp_path / "hw1.pdf"),
                "--course",
                "Machine Learning!",
                "--provider",
                "mock",
                "--data-dir",
                str(tmp_path / "data"),
                "--mock-pages",
                "1",
            ]
        )
        assert rc != 0

    def test_add_re_run_uses_cache(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        data_dir = tmp_path / "data"
        argv = [
            "add",
            str(tmp_path / "hw1.pdf"),
            "--course",
            "ml",
            "--provider",
            "mock",
            "--data-dir",
            str(data_dir),
            "--mock-pages",
            "2",
        ]
        rc1 = main(argv)
        capsys.readouterr()  # discard
        rc2 = main(argv)
        out = capsys.readouterr().out
        assert rc1 == 0
        assert rc2 == 0
        assert "pages cached    : 2" in out
        assert "pages processed : 0" in out


class TestSearchCommand:
    """Behavior of the `ocr-vault search` subcommand."""

    def _ingest(self, tmp_path: Path) -> Path:
        """Run a mock `add` to populate the index, return the data dir."""
        data_dir = tmp_path / "data"
        rc = main(
            [
                "add",
                str(tmp_path / "hw1.pdf"),
                "--course",
                "ml",
                "--provider",
                "mock",
                "--data-dir",
                str(data_dir),
                "--mock-pages",
                "2",
            ]
        )
        assert rc == 0
        return data_dir

    def test_search_finds_indexed_content(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        data_dir = self._ingest(tmp_path)
        capsys.readouterr()
        # MockProvider deterministic prose contains "mock OCR".
        rc = main(
            ["search", "mock", "--data-dir", str(data_dir)]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "ml" in out
        assert "mock" in out

    def test_search_returns_zero_for_no_matches(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        data_dir = self._ingest(tmp_path)
        capsys.readouterr()
        rc = main(
            [
                "search",
                "thisspecificwordwillneverappear",
                "--data-dir",
                str(data_dir),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "no matches" in out

    def test_search_errors_when_no_index(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        rc = main(
            ["search", "anything", "--data-dir", str(tmp_path / "missing")]
        )
        err = capsys.readouterr().err
        assert rc == 1
        assert "no index" in err

    def test_search_invalid_query_returns_nonzero(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        data_dir = self._ingest(tmp_path)
        capsys.readouterr()
        rc = main(
            ["search", '"unmatched', "--data-dir", str(data_dir)]
        )
        assert rc == 1


# ───────────────── list-problems / list-pii / list-candidates (#39) ────────


def _write_rich_sidecar(
    dir_: Path,
    *,
    page: int,
    blocks: list[dict[str, str]] | None = None,
    confidence: float = 0.9,
    pii_names: list[str] | None = None,
    needs_redaction: bool = False,
    akwasi_present: bool = False,
) -> Path:
    """Write a sidecar JSON with custom blocks + PII (unique page_hash per page)."""
    dir_.mkdir(parents=True, exist_ok=True)
    page_hash = "sha256:" + (f"{page:x}".rjust(64, "0"))
    data = {
        "source": {"pdf": "hw1.pdf", "page": page, "page_hash": page_hash},
        "extracted": {
            "blocks": blocks or [],
            "topics": [],
            "confidence": confidence,
            "needs_review": False,
        },
        "pii": {
            "names_detected": pii_names or [],
            "akwasi_present": akwasi_present,
            "needs_redaction_review": needs_redaction,
        },
        "model": {
            "provider": "mock",
            "model_id": "m1",
            "ocr_version": "1.0.0",
        },
    }
    path = dir_ / f"page-{page}.json"
    path.write_text(json.dumps(data))
    return path


class TestListProblemsCommand:
    def test_prints_problem_rows_for_course(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        _write_rich_sidecar(
            ml_dir,
            page=1,
            blocks=[
                {
                    "type": "problem_statement",
                    "problem_id": "1a",
                    "prose": "Compute gradient of f(x).",
                    "latex": "",
                }
            ],
        )
        _write_rich_sidecar(
            ml_dir,
            page=2,
            blocks=[
                {"type": "prose", "problem_id": "", "prose": "intro", "latex": ""}
            ],
        )
        rc = main(
            [
                "list-problems",
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "1a" in out
        assert "gradient" in out

    def test_no_problems_prints_friendly_message(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        rc = main(
            [
                "list-problems",
                "--course",
                "missing",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "no problem statements" in out


class TestListPiiCommand:
    def test_prints_only_flagged_pages(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        _write_rich_sidecar(
            ml_dir,
            page=1,
            pii_names=["Alice"],
            needs_redaction=True,
            akwasi_present=True,
        )
        _write_rich_sidecar(
            ml_dir,
            page=2,
            pii_names=["Bob"],
            needs_redaction=False,
        )
        rc = main(
            [
                "list-pii",
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "Alice" in out
        assert "Bob" not in out

    def test_no_pii_prints_friendly_message(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        rc = main(
            [
                "list-pii",
                "--course",
                "missing",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "no pages flagged" in out


class TestListCandidatesCommand:
    def test_ranks_pages_with_score_breakdown(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        _write_rich_sidecar(
            ml_dir,
            page=1,
            blocks=[
                {"type": "prose", "problem_id": "", "prose": "x" * 500, "latex": ""}
            ],
            confidence=0.9,
        )
        _write_rich_sidecar(
            ml_dir,
            page=2,
            blocks=[
                {"type": "prose", "problem_id": "", "prose": "x" * 50, "latex": ""}
            ],
            confidence=0.6,
        )
        rc = main(
            [
                "list-candidates",
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        # Header columns from _print_table.
        assert "score" in out
        assert "density" in out
        assert "pii_penalty" in out

    def test_respects_limit_flag(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ml_dir = tmp_path / "sidecars" / "machine-learning" / "hw1"
        for i in range(1, 6):
            _write_rich_sidecar(
                ml_dir,
                page=i,
                blocks=[
                    {
                        "type": "prose",
                        "problem_id": "",
                        "prose": "x" * (50 * i),
                        "latex": "",
                    }
                ],
                confidence=0.9,
            )

        # Default limit (10) → all 5 ranked.
        rc_full = main(
            [
                "list-candidates",
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out_full = capsys.readouterr().out
        assert rc_full == 0

        # --limit 2 → strictly fewer rows.
        rc_lim = main(
            [
                "list-candidates",
                "--course",
                "machine-learning",
                "--data-dir",
                str(tmp_path),
                "--limit",
                "2",
            ]
        )
        out_lim = capsys.readouterr().out
        assert rc_lim == 0
        assert len(out_lim) < len(out_full)


    def test_no_candidates_prints_friendly_message(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        rc = main(
            [
                "list-candidates",
                "--course",
                "missing",
                "--data-dir",
                str(tmp_path),
            ]
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "no favorite-page candidates" in out

