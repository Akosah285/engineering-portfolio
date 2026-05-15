"""Provider abstraction for OCR API calls.

Defines a small protocol every concrete provider (Anthropic / OpenAI /
Gemini / Mock) implements. The rest of the toolchain calls only this
interface; tests mock at this boundary so no real API calls happen in CI.

A future PR will add the actual SDK call inside each concrete provider's
``call`` method. Today they raise ``NotImplementedError`` so that
construction + selection logic remains testable without hitting any
network.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Final, Protocol, runtime_checkable

from ocr_vault.cost_calculator import PRICING


class ProviderError(Exception):
    """Raised on provider construction or call failure."""


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    """Structured response from a single provider call."""

    raw_text: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    model_id: str

    def __post_init__(self) -> None:
        if self.input_tokens < 0:
            raise ValueError(f"input_tokens must be >= 0, got {self.input_tokens}")
        if self.output_tokens < 0:
            raise ValueError(f"output_tokens must be >= 0, got {self.output_tokens}")
        if self.cost_usd < Decimal("0"):
            raise ValueError(f"cost_usd must be >= 0, got {self.cost_usd}")
        if not self.model_id:
            raise ValueError("model_id must not be empty")


@runtime_checkable
class OCRProvider(Protocol):
    """Protocol every concrete provider implements."""

    model_id: str

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse: ...


# ────────────────────────────── concrete providers ─────────────────────────


_ANTHROPIC_MODELS: Final[set[str]] = {
    m for m in PRICING if m.startswith("claude-")
}
_OPENAI_MODELS: Final[set[str]] = {m for m in PRICING if m.startswith("gpt-")}
_GEMINI_MODELS: Final[set[str]] = {m for m in PRICING if m.startswith("gemini-")}


class AnthropicProvider:
    """Anthropic Claude vision provider (default in v0/v2)."""

    def __init__(
        self,
        api_key: str,
        model_id: str = "claude-sonnet-4.5",
    ) -> None:
        if not api_key:
            raise ProviderError("AnthropicProvider requires a non-empty api_key")
        if model_id not in _ANTHROPIC_MODELS:
            raise ProviderError(
                f"Unknown Anthropic model {model_id!r}. "
                f"Known: {sorted(_ANTHROPIC_MODELS)}"
            )
        self._api_key = api_key
        self.model_id = model_id

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse:
        raise NotImplementedError(
            "AnthropicProvider.call: real SDK wiring lands in a follow-up. "
            "Tests must mock at the provider boundary."
        )


class OpenAIProvider:
    """OpenAI GPT-4o vision provider."""

    def __init__(self, api_key: str, model_id: str = "gpt-4o") -> None:
        if not api_key:
            raise ProviderError("OpenAIProvider requires a non-empty api_key")
        if model_id not in _OPENAI_MODELS:
            raise ProviderError(
                f"Unknown OpenAI model {model_id!r}. "
                f"Known: {sorted(_OPENAI_MODELS)}"
            )
        self._api_key = api_key
        self.model_id = model_id

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse:
        raise NotImplementedError(
            "OpenAIProvider.call: real SDK wiring lands in a follow-up."
        )


class GeminiProvider:
    """Google Gemini vision provider."""

    def __init__(self, api_key: str, model_id: str = "gemini-flash") -> None:
        if not api_key:
            raise ProviderError("GeminiProvider requires a non-empty api_key")
        if model_id not in _GEMINI_MODELS:
            raise ProviderError(
                f"Unknown Gemini model {model_id!r}. "
                f"Known: {sorted(_GEMINI_MODELS)}"
            )
        self._api_key = api_key
        self.model_id = model_id

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse:
        raise NotImplementedError(
            "GeminiProvider.call: real SDK wiring lands in a follow-up."
        )


class MockProvider:
    """Deterministic mock used in tests + dry-runs.

    Hashes the input image bytes to produce stable synthetic output, so the
    same inputs always yield the same response (essential for cache-hit
    tests in ``ocr-vault add``).
    """

    model_id = "mock-vision-v1"

    def __init__(self, canned_response: ProviderResponse | None = None) -> None:
        self._canned = canned_response
        self.call_count = 0

    def call(self, image_bytes: bytes, prompt: str) -> ProviderResponse:
        self.call_count += 1
        if self._canned is not None:
            return self._canned

        digest = hashlib.sha256(image_bytes + prompt.encode("utf-8")).hexdigest()
        # Deterministic token counts derived from the digest, so cost is
        # also stable.
        input_tokens = 100 + (int(digest[:4], 16) % 400)
        output_tokens = 50 + (int(digest[4:8], 16) % 200)
        # Tiny synthetic cost — not the real pricing path.
        cost = Decimal("0.00001") * Decimal(input_tokens + output_tokens)
        return ProviderResponse(
            raw_text=f"[mock OCR for image digest {digest[:12]}]",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            model_id=self.model_id,
        )


# ────────────────────────────── factory / selection ────────────────────────


_PROVIDER_ALIASES: Final[dict[str, tuple[str, str | None]]] = {
    "anthropic": ("anthropic", None),
    "claude": ("anthropic", None),
    "openai": ("openai", None),
    "gpt-4o": ("openai", "gpt-4o"),
    "gpt-4o-mini": ("openai", "gpt-4o-mini"),
    "gemini": ("gemini", None),
    "gemini-flash": ("gemini", "gemini-flash"),
    "gemini-pro": ("gemini", "gemini-pro"),
    "mock": ("mock", None),
}

_ENV_KEYS: Final[dict[str, str]] = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


def get_provider(name: str, api_key: str | None = None) -> OCRProvider:
    """Resolve a provider by name (case-insensitive) with optional model alias.

    Examples
    --------
    >>> get_provider("anthropic", api_key="sk-...")
    >>> get_provider("gpt-4o", api_key=os.environ["OPENAI_API_KEY"])
    >>> get_provider("mock")

    API keys may also come from environment variables (``ANTHROPIC_API_KEY``,
    ``OPENAI_API_KEY``, ``GEMINI_API_KEY``) if ``api_key`` is not provided.
    The ``mock`` provider never needs a key.
    """
    key = name.lower()
    if key not in _PROVIDER_ALIASES:
        raise ProviderError(
            f"Unknown provider {name!r}. Known: {sorted(_PROVIDER_ALIASES)}"
        )

    family, model_override = _PROVIDER_ALIASES[key]

    if family == "mock":
        return MockProvider()

    resolved_key = api_key or os.environ.get(_ENV_KEYS[family])
    if not resolved_key:
        raise ProviderError(
            f"No api_key provided and {_ENV_KEYS[family]} not set in environment"
        )

    if family == "anthropic":
        return (
            AnthropicProvider(api_key=resolved_key, model_id=model_override)
            if model_override
            else AnthropicProvider(api_key=resolved_key)
        )
    if family == "openai":
        return (
            OpenAIProvider(api_key=resolved_key, model_id=model_override)
            if model_override
            else OpenAIProvider(api_key=resolved_key)
        )
    if family == "gemini":
        return (
            GeminiProvider(api_key=resolved_key, model_id=model_override)
            if model_override
            else GeminiProvider(api_key=resolved_key)
        )
    raise ProviderError(f"Unhandled provider family {family!r}")  # pragma: no cover
