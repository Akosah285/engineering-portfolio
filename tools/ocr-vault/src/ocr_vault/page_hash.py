"""SHA-256 cache key for OCR pipeline pages.

The page hash is the cache key that lets `ocr-vault add` be idempotent.
Same image bytes → same hash → cache hit → no API call.

Format: `sha256:<64-hex-lowercase>` so consumers can detect the algorithm
and migrate to a future hash without breaking the contract.
"""

from __future__ import annotations

import hashlib

_PREFIX = "sha256:"


def page_hash(image_bytes: bytes) -> str:
    """Return the cache key for a page's image bytes.

    Pure function. No I/O. Deterministic across platforms (uses the standard
    library's SHA-256 implementation).

    Args:
        image_bytes: The raw bytes of a page's rendered PNG (or any bytes).

    Returns:
        A string of the form `sha256:<64-hex-lowercase>`.
    """
    digest = hashlib.sha256(image_bytes).hexdigest()
    return f"{_PREFIX}{digest}"
