"""Tests for the provider abstraction.

The provider abstraction is the boundary every higher-level command (add,
re-ocr) must call through. By mocking at this boundary, the entire test
suite never hits a real API in CI.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from ocr_vault.provider import (
    AnthropicProvider,
    GeminiProvider,
    MockProvider,
    OCRProvider,
    OpenAIProvider,
    ProviderError,
    ProviderResponse,
    get_provider,
)


class TestProviderResponse:
    def test_construct_with_all_fields(self) -> None:
        r = ProviderResponse(
            raw_text="hello",
            input_tokens=10,
            output_tokens=20,
            cost_usd=Decimal("0.0123"),
            model_id="claude-sonnet-4.5",
        )
        assert r.raw_text == "hello"
        assert r.input_tokens == 10
        assert r.output_tokens == 20
        assert r.cost_usd == Decimal("0.0123")
        assert r.model_id == "claude-sonnet-4.5"

    def test_is_frozen(self) -> None:
        r = ProviderResponse("x", 1, 1, Decimal("0"), "claude-sonnet-4.5")
        with pytest.raises((AttributeError, Exception)):
            r.raw_text = "y"  # type: ignore[misc]

    def test_negative_tokens_rejected(self) -> None:
        with pytest.raises(ValueError):
            ProviderResponse("x", -1, 0, Decimal("0"), "claude-sonnet-4.5")
        with pytest.raises(ValueError):
            ProviderResponse("x", 0, -1, Decimal("0"), "claude-sonnet-4.5")

    def test_negative_cost_rejected(self) -> None:
        with pytest.raises(ValueError):
            ProviderResponse("x", 0, 0, Decimal("-0.01"), "claude-sonnet-4.5")

    def test_empty_model_id_rejected(self) -> None:
        with pytest.raises(ValueError):
            ProviderResponse("x", 0, 0, Decimal("0"), "")


class TestMockProvider:
    def test_call_returns_provider_response(self) -> None:
        p = MockProvider()
        r = p.call(b"\x89PNG fake", "transcribe this page")
        assert isinstance(r, ProviderResponse)

    def test_deterministic_for_same_input(self) -> None:
        p = MockProvider()
        r1 = p.call(b"abc", "p1")
        r2 = p.call(b"abc", "p1")
        assert r1.raw_text == r2.raw_text
        assert r1.input_tokens == r2.input_tokens
        assert r1.output_tokens == r2.output_tokens
        assert r1.cost_usd == r2.cost_usd

    def test_different_image_yields_different_output(self) -> None:
        p = MockProvider()
        r1 = p.call(b"image1", "p")
        r2 = p.call(b"image2", "p")
        assert r1.raw_text != r2.raw_text

    def test_model_id_is_mock(self) -> None:
        p = MockProvider()
        r = p.call(b"x", "p")
        assert "mock" in r.model_id.lower()

    def test_tokens_are_positive(self) -> None:
        p = MockProvider()
        r = p.call(b"some image bytes", "prompt")
        assert r.input_tokens > 0
        assert r.output_tokens > 0

    def test_cost_is_non_negative_decimal(self) -> None:
        p = MockProvider()
        r = p.call(b"x", "p")
        assert isinstance(r.cost_usd, Decimal)
        assert r.cost_usd >= Decimal("0")

    def test_seeded_response(self) -> None:
        """Tests can inject a deterministic canned response."""
        p = MockProvider(
            canned_response=ProviderResponse(
                raw_text="A canned answer",
                input_tokens=42,
                output_tokens=7,
                cost_usd=Decimal("0.001"),
                model_id="mock-canned",
            )
        )
        r = p.call(b"any", "any")
        assert r.raw_text == "A canned answer"
        assert r.model_id == "mock-canned"

    def test_call_counter_visible_for_inspection(self) -> None:
        p = MockProvider()
        assert p.call_count == 0
        p.call(b"a", "p")
        p.call(b"b", "p")
        assert p.call_count == 2

    def test_implements_ocrprovider_protocol(self) -> None:
        p = MockProvider()
        assert isinstance(p, OCRProvider)


class TestAnthropicProvider:
    def test_implements_ocrprovider_protocol(self) -> None:
        p = AnthropicProvider(api_key="fake-key")
        assert isinstance(p, OCRProvider)

    def test_requires_api_key(self) -> None:
        with pytest.raises(ProviderError):
            AnthropicProvider(api_key="")

    def test_reads_default_model(self) -> None:
        p = AnthropicProvider(api_key="fake")
        assert p.model_id.startswith("claude-")

    def test_custom_model_accepted(self) -> None:
        p = AnthropicProvider(api_key="fake", model_id="claude-opus-4.5")
        assert p.model_id == "claude-opus-4.5"

    def test_unknown_model_rejected(self) -> None:
        with pytest.raises(ProviderError):
            AnthropicProvider(api_key="fake", model_id="not-a-real-model")

    def test_call_is_callable(self) -> None:
        """The .call attribute must exist (a real call would hit the network)."""
        p = AnthropicProvider(api_key="fake")
        assert callable(p.call)


class TestOpenAIProvider:
    def test_implements_ocrprovider_protocol(self) -> None:
        p = OpenAIProvider(api_key="fake-key")
        assert isinstance(p, OCRProvider)

    def test_requires_api_key(self) -> None:
        with pytest.raises(ProviderError):
            OpenAIProvider(api_key="")

    def test_default_model_starts_with_gpt(self) -> None:
        p = OpenAIProvider(api_key="fake")
        assert p.model_id.startswith("gpt-")

    def test_custom_model_accepted(self) -> None:
        p = OpenAIProvider(api_key="fake", model_id="gpt-4o-mini")
        assert p.model_id == "gpt-4o-mini"


class TestGeminiProvider:
    def test_implements_ocrprovider_protocol(self) -> None:
        p = GeminiProvider(api_key="fake-key")
        assert isinstance(p, OCRProvider)

    def test_requires_api_key(self) -> None:
        with pytest.raises(ProviderError):
            GeminiProvider(api_key="")

    def test_default_model_starts_with_gemini(self) -> None:
        p = GeminiProvider(api_key="fake")
        assert p.model_id.startswith("gemini-")


class TestGetProvider:
    def test_returns_anthropic_by_name(self) -> None:
        p = get_provider("anthropic", api_key="fake")
        assert isinstance(p, AnthropicProvider)

    def test_returns_openai_by_name(self) -> None:
        p = get_provider("openai", api_key="fake")
        assert isinstance(p, OpenAIProvider)

    def test_returns_gpt_4o_alias(self) -> None:
        """The CLI uses --provider gpt-4o; route to OpenAI."""
        p = get_provider("gpt-4o", api_key="fake")
        assert isinstance(p, OpenAIProvider)
        assert p.model_id == "gpt-4o"

    def test_returns_gemini_by_name(self) -> None:
        p = get_provider("gemini", api_key="fake")
        assert isinstance(p, GeminiProvider)

    def test_returns_gemini_flash_alias(self) -> None:
        p = get_provider("gemini-flash", api_key="fake")
        assert isinstance(p, GeminiProvider)
        assert p.model_id == "gemini-flash"

    def test_returns_mock_by_name(self) -> None:
        p = get_provider("mock")
        assert isinstance(p, MockProvider)

    def test_mock_does_not_require_api_key(self) -> None:
        p = get_provider("mock")
        assert isinstance(p, MockProvider)

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(ProviderError):
            get_provider("magic-llm", api_key="fake")

    def test_anthropic_reads_env_if_no_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ANTHROPIC_API_KEY", "env-key")
        p = get_provider("anthropic")
        assert isinstance(p, AnthropicProvider)

    def test_openai_reads_env_if_no_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "env-key")
        p = get_provider("openai")
        assert isinstance(p, OpenAIProvider)

    def test_gemini_reads_env_if_no_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "env-key")
        p = get_provider("gemini")
        assert isinstance(p, GeminiProvider)

    def test_missing_env_raises_provider_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        with pytest.raises(ProviderError):
            get_provider("anthropic")

    def test_case_insensitive_name(self) -> None:
        p = get_provider("Anthropic", api_key="fake")
        assert isinstance(p, AnthropicProvider)
        p2 = get_provider("GEMINI", api_key="fake")
        assert isinstance(p2, GeminiProvider)


class TestProviderError:
    def test_is_an_exception(self) -> None:
        assert issubclass(ProviderError, Exception)

    def test_carries_message(self) -> None:
        e = ProviderError("the model failed")
        assert "the model failed" in str(e)
