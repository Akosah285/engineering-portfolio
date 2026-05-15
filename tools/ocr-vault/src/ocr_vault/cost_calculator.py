"""Cost calculator for OCR API calls.

Pure function: model + token counts -> USD cost. Backbone of the $50 hard
cap / $10 soft warn behavior. Uses Decimal to avoid float drift in
summed-many-times audit totals.

Pricing source: public list prices per million tokens. When prices change,
update PRICING and the golden tests in test_cost_calculator.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Final

_MILLION = Decimal(1_000_000)


@dataclass(frozen=True, slots=True)
class _ModelPrice:
    """USD per 1M tokens for a single model."""

    input_per_million: Decimal
    output_per_million: Decimal


# Pricing table - USD per 1M tokens. Update when public prices change.
PRICING: Final[dict[str, _ModelPrice]] = {
    "claude-sonnet-4.5": _ModelPrice(Decimal("3.00"), Decimal("15.00")),
    "claude-haiku-4.5": _ModelPrice(Decimal("1.00"), Decimal("5.00")),
    "claude-opus-4.5": _ModelPrice(Decimal("15.00"), Decimal("75.00")),
    "gpt-4o": _ModelPrice(Decimal("2.50"), Decimal("10.00")),
    "gpt-4o-mini": _ModelPrice(Decimal("0.15"), Decimal("0.60")),
    "gemini-flash": _ModelPrice(Decimal("0.075"), Decimal("0.30")),
    "gemini-pro": _ModelPrice(Decimal("1.25"), Decimal("5.00")),
}


@dataclass(frozen=True, slots=True)
class CostBreakdown:
    """Decomposed cost so audit logs can reason about input vs output spend."""

    input_usd: Decimal
    output_usd: Decimal
    total_usd: Decimal


class UnknownModelError(ValueError):
    """Raised when a model id is not in the pricing table.

    Silent zero-cost would mask spend; we fail loud instead.
    """


def list_supported_models() -> list[str]:
    """Return the list of model ids we can price."""
    return list(PRICING.keys())


def cost_for_call(
    *, model: str, input_tokens: int, output_tokens: int
) -> CostBreakdown:
    """Compute the USD cost of a single API call.

    Args:
        model: Model id (must be in PRICING).
        input_tokens: Non-negative input/prompt token count.
        output_tokens: Non-negative output/completion token count.

    Returns:
        CostBreakdown with input/output/total in Decimal USD.

    Raises:
        UnknownModelError: If `model` is not in PRICING.
        ValueError: If either token count is negative.
    """
    if input_tokens < 0:
        raise ValueError(f"input_tokens must be >= 0, got {input_tokens}")
    if output_tokens < 0:
        raise ValueError(f"output_tokens must be >= 0, got {output_tokens}")

    price = PRICING.get(model)
    if price is None:
        raise UnknownModelError(
            f"Unknown model {model!r}. Supported: {sorted(PRICING.keys())}"
        )

    input_usd = (Decimal(input_tokens) * price.input_per_million) / _MILLION
    output_usd = (Decimal(output_tokens) * price.output_per_million) / _MILLION
    return CostBreakdown(
        input_usd=input_usd,
        output_usd=output_usd,
        total_usd=input_usd + output_usd,
    )
