"""Cost ledger — aggregates per-call costs and enforces caps.

State that wraps the cost_calculator. Records every API call (timestamp,
course, model, tokens, cost, is_re_ocr flag) and gates the next call against
the hard cap.

Plan section 2.3:
- Hard cap: default $50/run, configurable via --max-cost
- Soft warn: default $10/run, configurable via --warn-cost
- Re-OCR calls tagged separately for audit so per-course spend is tractable
- Hard cap of 0 means unlimited
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from ocr_vault.cost_calculator import CostBreakdown


class BudgetExceededError(RuntimeError):
    """Raised by record() when a call would push spend over the hard cap."""


@dataclass(frozen=True, slots=True)
class LedgerEntry:
    """An immutable record of a single API call."""

    timestamp: datetime
    course: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    is_re_ocr: bool


class CostLedger:
    """In-memory append-only log + cap-enforcement.

    Wire to SQLite at the persistence layer; this class is the in-memory
    decision-maker and keeps the cap logic pure and easily testable.

    A hard_cap_usd of 0 means 'no cap' (matches `--max-cost 0` semantics).
    """

    def __init__(self, *, hard_cap_usd: Decimal, soft_warn_usd: Decimal) -> None:
        if hard_cap_usd < 0:
            raise ValueError(f"hard_cap_usd must be >= 0, got {hard_cap_usd}")
        if soft_warn_usd < 0:
            raise ValueError(f"soft_warn_usd must be >= 0, got {soft_warn_usd}")
        self._hard_cap = hard_cap_usd
        self._soft_warn = soft_warn_usd
        self._entries: list[LedgerEntry] = []

    # ----- queries -----

    def total_usd(self) -> Decimal:
        """Sum of every call's cost (initial + re-ocr)."""
        return sum((e.cost_usd for e in self._entries), Decimal(0))

    def initial_total_usd(self) -> Decimal:
        """Sum of cost from non-re-ocr calls."""
        return sum(
            (e.cost_usd for e in self._entries if not e.is_re_ocr), Decimal(0)
        )

    def re_ocr_total_usd(self) -> Decimal:
        """Sum of cost from re-ocr calls."""
        return sum(
            (e.cost_usd for e in self._entries if e.is_re_ocr), Decimal(0)
        )

    def totals_by_course(self) -> dict[str, Decimal]:
        """Per-course total spend."""
        out: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
        for e in self._entries:
            out[e.course] += e.cost_usd
        return dict(out)

    def entries(self) -> list[LedgerEntry]:
        """Return a SHALLOW COPY of the entries log (mutation-safe)."""
        return list(self._entries)

    def under_hard_cap(self, *, estimated_next_usd: Decimal) -> bool:
        """True iff total + next call would not exceed the hard cap."""
        if self._hard_cap == 0:
            return True
        return self.total_usd() + estimated_next_usd <= self._hard_cap

    def over_soft_warn(self, *, estimated_next_usd: Decimal) -> bool:
        """True iff total + next call would cross the soft-warn line."""
        if self._soft_warn == 0:
            return False
        return self.total_usd() + estimated_next_usd > self._soft_warn

    # ----- mutation -----

    def record(
        self,
        *,
        course: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost: CostBreakdown,
        is_re_ocr: bool,
        when: datetime | None = None,
    ) -> LedgerEntry:
        """Record a single API call after enforcing the hard cap.

        Raises:
            BudgetExceededError: If recording this call would push total
                spend above the hard cap. The ledger is unchanged in that case.
        """
        if not self.under_hard_cap(estimated_next_usd=cost.total_usd):
            raise BudgetExceededError(
                f"Recording ${cost.total_usd} call on {course!r} would push "
                f"spend over the ${self._hard_cap} hard cap "
                f"(current total: ${self.total_usd()})."
            )
        entry = LedgerEntry(
            timestamp=when or datetime.now(),
            course=course,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost.total_usd,
            is_re_ocr=is_re_ocr,
        )
        self._entries.append(entry)
        return entry
