"""TDD: cost ledger — aggregates per-call costs and enforces caps.

Wraps the cost_calculator with stateful tracking + cap enforcement.

Plan section 2.3: $50 hard cap / $10 soft warn (overridable). The ledger
records every API call with timestamp + course + model + tokens + cost,
exposes per-course totals, and is the gate that decides whether the next
call may proceed (under_hard_cap) or only with --confirm (over_soft_warn).
"""

from datetime import datetime
from decimal import Decimal

import pytest

from ocr_vault.cost_calculator import cost_for_call
from ocr_vault.cost_ledger import (
    BudgetExceededError,
    CostLedger,
    LedgerEntry,
)


def test_empty_ledger_has_zero_total() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    assert ledger.total_usd() == Decimal("0")
    assert ledger.entries() == []


def test_record_a_call_increases_total() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1000, output_tokens=500
    )
    ledger.record(
        course="machine-learning",
        model="claude-sonnet-4.5",
        input_tokens=1000,
        output_tokens=500,
        cost=cost,
        is_re_ocr=False,
    )
    assert ledger.total_usd() == cost.total_usd
    assert len(ledger.entries()) == 1
    entry = ledger.entries()[0]
    assert isinstance(entry, LedgerEntry)
    assert entry.course == "machine-learning"
    assert entry.cost_usd == cost.total_usd


def test_total_aggregates_multiple_calls() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    for _ in range(3):
        cost = cost_for_call(
            model="claude-sonnet-4.5", input_tokens=1_000_000, output_tokens=0
        )
        ledger.record(
            course="ml", model="claude-sonnet-4.5",
            input_tokens=1_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
        )
    assert ledger.total_usd() == Decimal("9.00")


def test_per_course_totals() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost1 = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1_000_000, output_tokens=0
    )
    cost2 = cost_for_call(
        model="claude-haiku-4.5", input_tokens=1_000_000, output_tokens=0
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=1_000_000, output_tokens=0, cost=cost1, is_re_ocr=False,
    )
    ledger.record(
        course="fourier", model="claude-haiku-4.5",
        input_tokens=1_000_000, output_tokens=0, cost=cost2, is_re_ocr=False,
    )
    by_course = ledger.totals_by_course()
    assert by_course["ml"] == Decimal("3.00")
    assert by_course["fourier"] == Decimal("1.00")


def test_re_ocr_calls_tracked_separately() -> None:
    """Per plan: re-ocr invocations are separately tagged for audit."""
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1_000_000, output_tokens=0
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=1_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=1_000_000, output_tokens=0, cost=cost, is_re_ocr=True,
    )
    re_ocr = ledger.re_ocr_total_usd()
    initial = ledger.initial_total_usd()
    assert re_ocr == Decimal("3.00")
    assert initial == Decimal("3.00")
    assert ledger.total_usd() == Decimal("6.00")


# ----- cap & warn semantics -----


def test_under_hard_cap_returns_true_when_under_cap() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    assert ledger.under_hard_cap(estimated_next_usd=Decimal("5")) is True


def test_under_hard_cap_returns_false_when_at_or_over_cap() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=10_000_000, output_tokens=0
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=10_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
    )
    # at $30 spent + $25 next = $55 > $50
    assert ledger.under_hard_cap(estimated_next_usd=Decimal("25")) is False


def test_over_soft_warn_signals_yellow_zone() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=3_000_000, output_tokens=0
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=3_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
    )
    # $9 spent. Next $2 takes us to $11 > $10 warn.
    assert ledger.over_soft_warn(estimated_next_usd=Decimal("2")) is True
    assert ledger.over_soft_warn(estimated_next_usd=Decimal("0.50")) is False


def test_record_rejects_call_that_would_breach_hard_cap() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("10"), soft_warn_usd=Decimal("5"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=2_000_000, output_tokens=0
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=2_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
    )
    # $6 in. Next $5 would push to $11 > $10.
    huge = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=2_000_000, output_tokens=0
    )
    with pytest.raises(BudgetExceededError) as exc:
        ledger.record(
            course="ml", model="claude-sonnet-4.5",
            input_tokens=2_000_000, output_tokens=0, cost=huge, is_re_ocr=False,
        )
    msg = str(exc.value)
    assert "10" in msg or "cap" in msg.lower()


def test_record_does_not_persist_when_breaching_cap() -> None:
    """Failed record() calls leave the ledger state unchanged."""
    ledger = CostLedger(hard_cap_usd=Decimal("1"), soft_warn_usd=Decimal("0.5"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=1_000_000, output_tokens=0
    )
    with pytest.raises(BudgetExceededError):
        ledger.record(
            course="ml", model="claude-sonnet-4.5",
            input_tokens=1_000_000, output_tokens=0, cost=cost, is_re_ocr=False,
        )
    assert ledger.total_usd() == Decimal("0")
    assert ledger.entries() == []


# ----- entry shape -----


def test_entries_are_immutable_snapshots() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("50"), soft_warn_usd=Decimal("10"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=100, output_tokens=100
    )
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=100, output_tokens=100, cost=cost, is_re_ocr=False,
    )
    snapshot = ledger.entries()
    snapshot.append(LedgerEntry(
        timestamp=datetime.now(), course="x", model="x",
        input_tokens=0, output_tokens=0, cost_usd=Decimal("0"), is_re_ocr=False,
    ))
    assert len(ledger.entries()) == 1


# ----- hard_cap == 0 means unlimited -----


def test_hard_cap_zero_means_no_cap() -> None:
    ledger = CostLedger(hard_cap_usd=Decimal("0"), soft_warn_usd=Decimal("0"))
    cost = cost_for_call(
        model="claude-sonnet-4.5", input_tokens=10_000_000, output_tokens=10_000_000
    )
    # Should not raise even at $180.
    ledger.record(
        course="ml", model="claude-sonnet-4.5",
        input_tokens=10_000_000, output_tokens=10_000_000,
        cost=cost, is_re_ocr=False,
    )
    assert ledger.total_usd() > Decimal("100")
