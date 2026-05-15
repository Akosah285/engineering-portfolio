"""SQLite index for OCR data.

Two tables:
    pages       — one row per OCR'd page (keyed by page_hash). Idempotent
                  upserts so re-OCR overwrites the record.
    api_calls   — append-only audit log of every provider call, with cost.

Plan §2.3 mandates this committed alongside sidecars; SQLite is the
queryable cache, sidecars on disk remain canonical.

This module is intentionally bare — no schema-migration framework, no
ORM. The schema is small and changes are rare; just ALTER TABLE in a
follow-up if we need to evolve it.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from ocr_vault.search_index import (
    SearchHit,
    init_search_table,
)
from ocr_vault.search_index import (
    index_sidecar as _fts_index_sidecar,
)
from ocr_vault.search_index import (
    search as _fts_search,
)
from ocr_vault.sidecar_schema import Sidecar


class SqliteIndexError(RuntimeError):
    """Raised on operations against a closed or unhealthy index."""


_SCHEMA = """
CREATE TABLE IF NOT EXISTS pages (
    page_hash TEXT PRIMARY KEY,
    course TEXT NOT NULL,
    pdf TEXT NOT NULL,
    page INTEGER NOT NULL,
    confidence REAL NOT NULL,
    needs_review INTEGER NOT NULL,
    needs_redaction_review INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pages_course ON pages(course);
CREATE INDEX IF NOT EXISTS idx_pages_pdf ON pages(pdf);

CREATE TABLE IF NOT EXISTS api_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    course TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd TEXT NOT NULL,
    is_re_ocr INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_course ON api_calls(course);
CREATE INDEX IF NOT EXISTS idx_calls_re_ocr ON api_calls(is_re_ocr);
"""


class SqliteIndex:
    """Thin wrapper around a sqlite3.Connection with typed methods.

    Use :py:meth:`open` to construct; never instantiate directly.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn: sqlite3.Connection | None = conn

    @classmethod
    def open(cls, path: str | Path) -> SqliteIndex:
        """Open a SQLite index at ``path`` (use ``":memory:"`` for tests)."""
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        conn.executescript(_SCHEMA)
        init_search_table(conn)
        conn.commit()
        return cls(conn)

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # ─── helpers ────────────────────────────────────────────────────────

    def _check_open(self) -> sqlite3.Connection:
        if self._conn is None:
            raise SqliteIndexError("operation on a closed SqliteIndex")
        return self._conn

    def list_tables(self) -> list[str]:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        return [r["name"] for r in rows]

    # ─── pages ──────────────────────────────────────────────────────────

    def upsert_page(
        self,
        *,
        page_hash: str,
        course: str,
        pdf: str,
        page: int,
        confidence: float,
        needs_review: bool,
        needs_redaction_review: bool,
    ) -> None:
        if not (0.0 <= confidence <= 1.0):
            raise ValueError(
                f"confidence must be in [0, 1], got {confidence}"
            )
        conn = self._check_open()
        conn.execute(
            """
            INSERT INTO pages (
                page_hash, course, pdf, page, confidence,
                needs_review, needs_redaction_review, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(page_hash) DO UPDATE SET
                course = excluded.course,
                pdf = excluded.pdf,
                page = excluded.page,
                confidence = excluded.confidence,
                needs_review = excluded.needs_review,
                needs_redaction_review = excluded.needs_redaction_review,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                page_hash,
                course,
                pdf,
                page,
                confidence,
                int(needs_review),
                int(needs_redaction_review),
            ),
        )
        conn.commit()

    def get_page(self, page_hash: str) -> dict[str, Any] | None:
        conn = self._check_open()
        row = conn.execute(
            "SELECT * FROM pages WHERE page_hash = ?", (page_hash,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_page(row)

    def has_page(self, page_hash: str) -> bool:
        conn = self._check_open()
        row = conn.execute(
            "SELECT 1 FROM pages WHERE page_hash = ? LIMIT 1", (page_hash,)
        ).fetchone()
        return row is not None

    def count_pages(self) -> int:
        conn = self._check_open()
        row = conn.execute("SELECT COUNT(*) AS n FROM pages").fetchone()
        return int(row["n"])

    def pages_by_course(self, course: str) -> list[dict[str, Any]]:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT * FROM pages WHERE course = ? ORDER BY pdf, page",
            (course,),
        ).fetchall()
        return [_row_to_page(r) for r in rows]

    def low_confidence_pages(
        self, course: str, *, threshold: float
    ) -> list[dict[str, Any]]:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT * FROM pages WHERE course = ? AND confidence < ? "
            "ORDER BY confidence ASC, pdf, page",
            (course, threshold),
        ).fetchall()
        return [_row_to_page(r) for r in rows]

    # ─── search (FTS5 — see search_index module) ────────────────────────

    def index_sidecar(self, *, course: str, sidecar: Sidecar) -> None:
        """Index a sidecar's prose + latex + topics for full-text search."""
        conn = self._check_open()
        _fts_index_sidecar(conn, course=course, sidecar=sidecar)

    def search(
        self,
        query: str,
        *,
        course: str | None = None,
        limit: int = 10,
    ) -> list[SearchHit]:
        """Run an FTS5 MATCH query. See :func:`search_index.search`."""
        conn = self._check_open()
        return _fts_search(conn, query, course=course, limit=limit)

    # ─── api_calls ──────────────────────────────────────────────────────

    def log_call(
        self,
        *,
        timestamp: datetime,
        course: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal,
        is_re_ocr: bool,
    ) -> None:
        conn = self._check_open()
        conn.execute(
            """
            INSERT INTO api_calls (
                timestamp, course, model, input_tokens, output_tokens,
                cost_usd, is_re_ocr
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp.isoformat(),
                course,
                model,
                input_tokens,
                output_tokens,
                str(cost_usd),
                int(is_re_ocr),
            ),
        )
        conn.commit()

    def count_calls(self) -> int:
        conn = self._check_open()
        row = conn.execute("SELECT COUNT(*) AS n FROM api_calls").fetchone()
        return int(row["n"])

    def total_cost_usd(self) -> Decimal:
        conn = self._check_open()
        rows = conn.execute("SELECT cost_usd FROM api_calls").fetchall()
        return sum((Decimal(r["cost_usd"]) for r in rows), Decimal(0))

    def total_re_ocr_cost_usd(self) -> Decimal:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT cost_usd FROM api_calls WHERE is_re_ocr = 1"
        ).fetchall()
        return sum((Decimal(r["cost_usd"]) for r in rows), Decimal(0))

    def total_initial_cost_usd(self) -> Decimal:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT cost_usd FROM api_calls WHERE is_re_ocr = 0"
        ).fetchall()
        return sum((Decimal(r["cost_usd"]) for r in rows), Decimal(0))

    def cost_by_course(self) -> dict[str, Decimal]:
        conn = self._check_open()
        rows = conn.execute(
            "SELECT course, cost_usd FROM api_calls"
        ).fetchall()
        out: dict[str, Decimal] = {}
        for r in rows:
            out[r["course"]] = out.get(r["course"], Decimal(0)) + Decimal(
                r["cost_usd"]
            )
        return out


def _row_to_page(row: sqlite3.Row) -> dict[str, Any]:
    """Convert a sqlite3.Row from the pages table to a typed dict."""
    return {
        "page_hash": row["page_hash"],
        "course": row["course"],
        "pdf": row["pdf"],
        "page": row["page"],
        "confidence": row["confidence"],
        "needs_review": bool(row["needs_review"]),
        "needs_redaction_review": bool(row["needs_redaction_review"]),
        "updated_at": row["updated_at"],
    }
