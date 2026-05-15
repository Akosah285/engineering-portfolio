"""Tests for the FTS5 search index over OCR'd sidecars (closes #38).

Behavior under test (NOT implementation):
    1. ``init_search_table`` creates the FTS5 virtual table once;
       calling it again is a no-op.
    2. ``index_sidecar`` indexes prose + latex + topics for every
       sidecar block, keyed by page_hash. Re-indexing the same
       page_hash overwrites the prior content.
    3. ``search`` returns SearchHit objects with course, pdf, page,
       page_hash, score, and a snippet of the matching context.
    4. ``search`` supports phrase queries ("..."), boolean OR, and
       NOT operators (passed straight through to FTS5).
    5. ``search`` accepts an optional ``course`` filter.
"""

from __future__ import annotations

import sqlite3

import pytest

from ocr_vault.search_index import (
    SearchError,
    index_sidecar,
    init_search_table,
    search,
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
    page_hash: str = "sha256:abc",
    pdf: str = "hw1.pdf",
    page: int = 1,
    prose_blocks: tuple[str, ...] = (),
    latex_blocks: tuple[str, ...] = (),
    topics: tuple[str, ...] = (),
) -> Sidecar:
    blocks: list[Block] = []
    for p in prose_blocks:
        blocks.append(Block(type="prose", prose=p))
    for ltx in latex_blocks:
        blocks.append(Block(type="solution_step", latex=ltx))
    return Sidecar(
        source=Source(pdf=pdf, page=page, page_hash=page_hash),
        extracted=Extracted(blocks=blocks, topics=list(topics), confidence=0.9),
        pii=Pii(),
        model=Model(provider="mock", model_id="mock-1", ocr_version="1.0.0"),
    )


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    init_search_table(c)
    return c


# ---------- init ----------


def test_init_creates_fts_table(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='pages_fts'"
    ).fetchall()
    assert len(rows) == 1


def test_init_is_idempotent(conn: sqlite3.Connection) -> None:
    init_search_table(conn)
    init_search_table(conn)
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE name='pages_fts'"
    ).fetchall()
    assert len(rows) == 1


# ---------- index ----------


def test_index_sidecar_inserts_one_row_per_page(conn: sqlite3.Connection) -> None:
    sc = _make_sidecar(prose_blocks=("Fourier series converge in mean square.",))
    index_sidecar(conn, course="fourier-transforms", sidecar=sc)
    count = conn.execute("SELECT COUNT(*) FROM pages_fts").fetchone()[0]
    assert count == 1


def test_index_sidecar_concatenates_all_blocks(conn: sqlite3.Connection) -> None:
    sc = _make_sidecar(
        prose_blocks=("First sentence about gradients.", "Second about Hessians."),
        latex_blocks=(r"\nabla f(x) = 0", r"H_{ij} = \partial^2 f / \partial x_i \partial x_j"),
        topics=("optimization", "calculus"),
    )
    index_sidecar(conn, course="machine-learning", sidecar=sc)
    row = conn.execute("SELECT prose, latex, topics FROM pages_fts").fetchone()
    assert "First sentence" in row["prose"]
    assert "Hessians" in row["prose"]
    assert "nabla" in row["latex"]
    assert "partial" in row["latex"]
    assert "optimization" in row["topics"]
    assert "calculus" in row["topics"]


def test_index_sidecar_is_idempotent(conn: sqlite3.Connection) -> None:
    sc = _make_sidecar(prose_blocks=("hello world",))
    index_sidecar(conn, course="ml", sidecar=sc)
    index_sidecar(conn, course="ml", sidecar=sc)
    count = conn.execute("SELECT COUNT(*) FROM pages_fts").fetchone()[0]
    assert count == 1


def test_re_indexing_same_hash_overwrites_content(conn: sqlite3.Connection) -> None:
    sc1 = _make_sidecar(
        page_hash="sha256:same",
        prose_blocks=("original content",),
    )
    sc2 = _make_sidecar(
        page_hash="sha256:same",
        prose_blocks=("revised content",),
    )
    index_sidecar(conn, course="ml", sidecar=sc1)
    index_sidecar(conn, course="ml", sidecar=sc2)
    rows = conn.execute("SELECT prose FROM pages_fts").fetchall()
    assert len(rows) == 1
    assert "revised" in rows[0]["prose"]
    assert "original" not in rows[0]["prose"]


# ---------- search ----------


def test_search_finds_matching_page(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="fourier-transforms",
        sidecar=_make_sidecar(
            pdf="hw3.pdf",
            page=4,
            prose_blocks=("Fourier series converge in the mean.",),
        ),
    )
    hits = search(conn, "Fourier")
    assert len(hits) == 1
    assert hits[0].course == "fourier-transforms"
    assert hits[0].pdf == "hw3.pdf"
    assert hits[0].page == 4


def test_search_returns_snippet_around_match(conn: sqlite3.Connection) -> None:
    long_prose = (
        "lorem ipsum " * 20 + "the keyword TARGET appears here " + "dolor sit " * 20
    )
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(prose_blocks=(long_prose,)),
    )
    hits = search(conn, "TARGET")
    assert len(hits) == 1
    assert "TARGET" in hits[0].snippet
    # Snippet should not include the entire haystack
    assert len(hits[0].snippet) < len(long_prose)


def test_search_returns_empty_for_no_match(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(prose_blocks=("only this content",)),
    )
    hits = search(conn, "missing")
    assert hits == []


def test_search_supports_phrase_query(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            pdf="a.pdf",
            page=1,
            prose_blocks=("gradient descent converges quickly",),
        ),
    )
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:b",
            pdf="b.pdf",
            page=2,
            prose_blocks=("the gradient of f. then descent goes nowhere.",),
        ),
    )
    hits = search(conn, '"gradient descent"')
    assert {h.pdf for h in hits} == {"a.pdf"}


def test_search_supports_or(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:1",
            pdf="a.pdf",
            prose_blocks=("learning rate matters",),
        ),
    )
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:2",
            pdf="b.pdf",
            prose_blocks=("step size matters",),
        ),
    )
    hits = search(conn, "learning OR step")
    assert {h.pdf for h in hits} == {"a.pdf", "b.pdf"}


def test_search_supports_not(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:1",
            pdf="a.pdf",
            prose_blocks=("supervised learning is easier",),
        ),
    )
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:2",
            pdf="b.pdf",
            prose_blocks=("unsupervised learning is harder",),
        ),
    )
    hits = search(conn, "learning NOT supervised")
    assert {h.pdf for h in hits} == {"b.pdf"}


def test_search_filters_by_course(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:1",
            pdf="ml.pdf",
            prose_blocks=("Markov chain convergence",),
        ),
    )
    index_sidecar(
        conn,
        course="discrete-probability",
        sidecar=_make_sidecar(
            page_hash="sha256:2",
            pdf="dp.pdf",
            prose_blocks=("Markov chain stationary distribution",),
        ),
    )
    hits = search(conn, "Markov", course="discrete-probability")
    assert {h.course for h in hits} == {"discrete-probability"}


def test_search_respects_limit(conn: sqlite3.Connection) -> None:
    for i in range(20):
        index_sidecar(
            conn,
            course="ml",
            sidecar=_make_sidecar(
                page_hash=f"sha256:{i}",
                pdf=f"hw{i}.pdf",
                page=i + 1,
                prose_blocks=("matching keyword here",),
            ),
        )
    hits = search(conn, "keyword", limit=5)
    assert len(hits) == 5


def test_search_indexes_latex_content(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            pdf="hw.pdf",
            latex_blocks=(r"\hat{y} = \beta_0 + \beta_1 x",),
        ),
    )
    hits = search(conn, "beta")
    assert len(hits) == 1
    assert hits[0].pdf == "hw.pdf"


def test_search_indexes_topics(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            pdf="hw.pdf",
            topics=("regularization",),
        ),
    )
    hits = search(conn, "regularization")
    assert len(hits) == 1


def test_invalid_query_raises_search_error(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(prose_blocks=("hello",)),
    )
    # An unmatched double quote is invalid FTS5 syntax
    with pytest.raises(SearchError):
        search(conn, '"unmatched')


def test_empty_query_raises_search_error(conn: sqlite3.Connection) -> None:
    with pytest.raises(SearchError):
        search(conn, "")


def test_search_returns_results_ordered_by_relevance(conn: sqlite3.Connection) -> None:
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:rare",
            pdf="rare.pdf",
            prose_blocks=("kalman kalman kalman kalman",),
        ),
    )
    index_sidecar(
        conn,
        course="ml",
        sidecar=_make_sidecar(
            page_hash="sha256:common",
            pdf="common.pdf",
            prose_blocks=("kalman appears once among lots of other text " * 10,),
        ),
    )
    hits = search(conn, "kalman")
    assert len(hits) == 2
    # Higher score = more relevant; the rare-dense doc should rank first.
    assert hits[0].pdf == "rare.pdf"
