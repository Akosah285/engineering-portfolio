"""TDD: page-hash deep module — SHA-256 cache key for OCR pipeline.

The page hash is the cache key for every OCR call. Same image bytes must
always produce the same hash, across platforms, and across runs.

Format: `sha256:<64-hex>` so the prefix lets us migrate algorithms later
without breaking the contract.
"""

import pytest

from ocr_vault.page_hash import page_hash


def test_returns_sha256_prefixed_64_hex_string() -> None:
    """The output shape is `sha256:<64-hex>` so consumers can detect algorithm."""
    h = page_hash(b"any bytes")
    assert h.startswith("sha256:")
    rest = h[len("sha256:") :]
    assert len(rest) == 64
    assert all(c in "0123456789abcdef" for c in rest)


def test_same_bytes_produce_same_hash() -> None:
    """Idempotency: same input → same hash."""
    bs = b"the quick brown fox jumps over the lazy dog"
    assert page_hash(bs) == page_hash(bs)


def test_different_bytes_produce_different_hash() -> None:
    """One byte different → different hash."""
    a = b"the quick brown fox"
    b = b"the quick brown fox."
    assert page_hash(a) != page_hash(b)


def test_empty_bytes_have_defined_hash() -> None:
    """Empty input is well-defined (canonical empty SHA-256)."""
    assert (
        page_hash(b"")
        == "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


def test_known_golden_value() -> None:
    """Cross-platform determinism: golden hash for a known input."""
    # SHA-256 of "engineering portfolio"
    assert (
        page_hash(b"engineering portfolio")
        == "sha256:3314ddc49ddd22bf802b55e42028e78a62cdb8be0e052a2ff7e6ed81fa87211c"
    )


@pytest.mark.parametrize(
    "input_bytes",
    [
        b"\x00\x01\x02\x03",
        b"\xff" * 1024,
        b"mixed bytes \x00 with \xff binary content",
        bytes(range(256)),
    ],
)
def test_handles_arbitrary_binary_input(input_bytes: bytes) -> None:
    """Binary edge cases (nulls, high bytes, full byte range) all work."""
    h = page_hash(input_bytes)
    assert h.startswith("sha256:")
    assert len(h) == len("sha256:") + 64
