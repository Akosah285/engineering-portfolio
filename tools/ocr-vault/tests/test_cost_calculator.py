"""TDD: cost-calculator deep module.

Central to the OCR pipeline's $50 hard cap / $10 soft warn behavior.
Given a model + token counts, returns USD cost. Pure, deterministic, no I/O.

The pricing table is loaded from a constant in the module (matched to
public list prices); when prices change, the constant is updated, and a
golden test catches drift.
"""

from decimal import Decimal

import pytest

from ocr_vault.cost_calculator import (
    CostBreakdown,
    UnknownModelError,
    cost_for_call,
    list_supported_models,
)


def test_returns_a_cost_breakdown_with_input_output_total() -> None:
    """The result decomposes input vs output cost so audit logs are readable."""
    result = cost_for_call(
        model="claude-sonnet-4.5",
        input_tokens=1000,
        output_tokens=500,
    )
    assert isinstance(result, CostBreakdown)
    assert result.input_usd >= Decimal(0)
    assert result.output_usd >= Decimal(0)
    assert result.total_usd == result.input_usd + result.output_usd


def test_zero_tokens_yields_zero_cost() -> None:
    result = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=0, output_tokens=0
    )
    assert result.total_usd == Decimal("0")


def test_cost_scales_linearly_with_tokens() -> None:
    """Doubling input doubles input cost, output unchanged."""
    a = cost_for_call(model="claude-sonnet-4.5", input_tokens=1000, output_tokens=0)
    b = cost_for_call(model="claude-sonnet-4.5", input_tokens=2000, output_tokens=0)
    assert b.input_usd == a.input_usd * 2


def test_input_and_output_priced_separately() -> None:
    """Input and output have different rates per million tokens."""
    just_input = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1_000_000, output_tokens=0
    )
    just_output = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=0, output_tokens=1_000_000
    )
    assert just_input.input_usd > Decimal(0)
    assert just_output.output_usd > Decimal(0)
    # Output is normally more expensive than input
    assert just_output.output_usd > just_input.input_usd


def test_unknown_model_raises_with_helpful_message() -> None:
    """Unknown models raise — silent zero would mask spend."""
    with pytest.raises(UnknownModelError) as exc_info:
        cost_for_call(model="not-a-real-model", input_tokens=100, output_tokens=100)
    assert "not-a-real-model" in str(exc_info.value)


def test_lists_supported_models() -> None:
    """list_supported_models returns the keys we can price."""
    models = list_supported_models()
    assert isinstance(models, list)
    assert len(models) > 0
    assert "claude-sonnet-4.5" in models


def test_negative_tokens_raises() -> None:
    """Defensive: negative token counts indicate an upstream bug."""
    with pytest.raises(ValueError):
        cost_for_call(model="claude-sonnet-4.5", input_tokens=-1, output_tokens=0)
    with pytest.raises(ValueError):
        cost_for_call(model="claude-sonnet-4.5", input_tokens=0, output_tokens=-1)


@pytest.mark.parametrize(
    "model,input_tokens,output_tokens,expected_total",
    [
        # Golden values pinned to the pricing table in cost_calculator.py.
        # When prices change, update both the table and these expected values.
        ("claude-sonnet-4.5", 1_000_000, 0, Decimal("3.00")),
        ("claude-sonnet-4.5", 0, 1_000_000, Decimal("15.00")),
        ("claude-haiku-4.5", 1_000_000, 0, Decimal("1.00")),
        ("gpt-4o", 1_000_000, 0, Decimal("2.50")),
        ("gemini-flash", 1_000_000, 0, Decimal("0.075")),
    ],
)
def test_golden_prices_per_million_tokens(
    model: str,
    input_tokens: int,
    output_tokens: int,
    expected_total: Decimal,
) -> None:
    """Golden table for per-million-token rates. Updates when pricing drifts."""
    result = cost_for_call(
        model=model, input_tokens=input_tokens, output_tokens=output_tokens
    )
    assert result.total_usd == expected_total


def test_cost_uses_decimal_not_float() -> None:
    """Decimal avoids float drift in summed-many-times audit totals."""
    result = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1000, output_tokens=1000
    )
    assert isinstance(result.input_usd, Decimal)
    assert isinstance(result.output_usd, Decimal)
    assert isinstance(result.total_usd, Decimal)


def test_cost_breakdown_is_immutable() -> None:
    """Audit data should not be mutated after creation."""
    result = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=100, output_tokens=100
    )
    with pytest.raises((AttributeError, Exception)):
        result.total_usd = Decimal("999.99")  # type: ignore[misc]
