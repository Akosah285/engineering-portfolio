"""FTS5 search index over OCR'd sidecars (closes #38).

One row per page in a single FTS5 virtual table ``pages_fts`` with
columns:

    course      filter facet (UNINDEXED — we filter via WHERE)
    pdf         filename of the source PDF
    page        display page number (UNINDEXED — for output only)
    page_hash   sha256:... primary key for upsert (UNINDEXED)
    prose       concatenated prose from every block on the page
    latex       concatenated raw LaTeX from every block
    topics      space-joined topic tags

Searches are FTS5 MATCH queries — phrase queries (``"..."``), boolean
``OR``/``AND``/``NOT``, and column-restricted (``prose:gradient``) all
work because they are passed straight through to FTS5.

The module is a deep, side-effect-free toolkit — it owns no connection,
no path. The CLI hands it a ``sqlite3.Connection`` and consumes the
returned ``SearchHit`` records.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from ocr_vault.sidecar_schema import Sidecar


class SearchError(ValueError):
    """Raised on invalid query syntax or empty query."""


@dataclass(frozen=True, slots=True)
class SearchHit:
    """One matching page returned by :func:`search`."""

    course: str
    pdf: str
    page: int
    page_hash: str
    snippet: str
    score: float


_FTS_DDL = """
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    course UNINDEXED,
    pdf UNINDEXED,
    page UNINDEXED,
    page_hash UNINDEXED,
    prose,
    latex,
    topics,
    tokenize = 'unicode61 remove_diacritics 2'
);
"""


def init_search_table(conn: sqlite3.Connection) -> None:
    """Create the FTS5 virtual table if it does not exist. Idempotent."""
    conn.executescript(_FTS_DDL)
    conn.commit()


def _concat_prose(sidecar: Sidecar) -> str:
    parts = [b.prose for b in sidecar.extracted.blocks if b.prose]
    return "\n".join(parts)


def _concat_latex(sidecar: Sidecar) -> str:
    parts = [b.latex for b in sidecar.extracted.blocks if b.latex]
    return "\n".join(parts)


def _concat_topics(sidecar: Sidecar) -> str:
    return " ".join(sidecar.extracted.topics)


def index_sidecar(
    conn: sqlite3.Connection,
    *,
    course: str,
    sidecar: Sidecar,
) -> None:
    """Insert/replace the FTS row for ``sidecar.source.page_hash``.

    Idempotent — calling twice with the same sidecar leaves exactly one
    row. Re-indexing the same page_hash with new content overwrites the
    prior row's text columns.
    """
    page_hash = sidecar.source.page_hash
    conn.execute("DELETE FROM pages_fts WHERE page_hash = ?", (page_hash,))
    conn.execute(
        """
        INSERT INTO pages_fts (course, pdf, page, page_hash, prose, latex, topics)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            course,
            sidecar.source.pdf,
            sidecar.source.page,
            page_hash,
            _concat_prose(sidecar),
            _concat_latex(sidecar),
            _concat_topics(sidecar),
        ),
    )
    conn.commit()


def search(
    conn: sqlite3.Connection,
    query: str,
    *,
    course: str | None = None,
    limit: int = 10,
) -> list[SearchHit]:
    """Run an FTS5 MATCH query against ``pages_fts``.

    Parameters
    ----------
    query:
        FTS5 query string. Supports phrase queries ("..."), boolean
        OR/AND/NOT, and column filters (``prose:gradient``).
    course:
        Optional course slug to restrict results to.
    limit:
        Maximum hits to return. Default 10. Results are ordered by
        ``bm25`` rank (lower = more relevant; we negate to give a
        positive ``score`` where higher = better).

    Returns
    -------
    list[SearchHit]
        Empty list when the query has no matches.

    Raises
    ------
    SearchError
        If the query is empty or has malformed FTS5 syntax.
    """
    if not query or not query.strip():
        raise SearchError("query must be non-empty")

    sql_parts = [
        "SELECT course, pdf, page, page_hash, ",
        "snippet(pages_fts, -1, '[', ']', '…', 16) AS snippet, ",
        "rank AS bm25 ",
        "FROM pages_fts WHERE pages_fts MATCH ?",
    ]
    params: list[str | int] = [query]
    if course is not None:
        sql_parts.append(" AND course = ?")
        params.append(course)
    sql_parts.append(" ORDER BY rank LIMIT ?")
    params.append(int(limit))

    try:
        cursor = conn.execute("".join(sql_parts), params)
        rows = cursor.fetchall()
    except sqlite3.OperationalError as e:
        raise SearchError(f"invalid FTS5 query: {e}") from e

    hits: list[SearchHit] = []
    for row in rows:
        bm25 = row["bm25"] if isinstance(row, sqlite3.Row) else row[5]
        # bm25 returns a non-positive float (lower = more relevant).
        # Negate so higher score = more relevant for the public API.
        score = -float(bm25)
        hits.append(
            SearchHit(
                course=row["course"] if isinstance(row, sqlite3.Row) else row[0],
                pdf=row["pdf"] if isinstance(row, sqlite3.Row) else row[1],
                page=int(row["page"] if isinstance(row, sqlite3.Row) else row[2]),
                page_hash=row["page_hash"]
                if isinstance(row, sqlite3.Row)
                else row[3],
                snippet=str(
                    row["snippet"] if isinstance(row, sqlite3.Row) else row[4]
                ),
                score=score,
            )
        )
    return hits
