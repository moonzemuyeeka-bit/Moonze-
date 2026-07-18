"""Payment gateway abstraction.

Real disbursement/collection happens through a "pay way" — a payment aggregator
that fans out to the mobile-money rails (Airtel Money, MTN MoMo, Zamtel Kwacha)
and cards. The rest of the app only talks to the :class:`PaymentProvider`
interface, so swapping the mock for a real provider (e.g. Flutterwave, Lenco,
Broadpay, or a direct MNO integration) is a one-file change.

Two flows are supported:
* ``disburse`` — push money OUT to a customer wallet (loan payout).
* ``collect``  — pull money IN from a customer wallet (repayment).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.config import settings


@dataclass
class PaymentResult:
    success: bool
    reference: str
    provider: str
    message: str = ""

    def as_dict(self) -> dict:
        return {
            "success": self.success,
            "reference": self.reference,
            "provider": self.provider,
            "message": self.message,
        }


class PaymentProvider(Protocol):
    name: str

    def disburse(self, mobile_number: str, amount: float, narrative: str) -> PaymentResult: ...

    def collect(self, mobile_number: str, amount: float, narrative: str) -> PaymentResult: ...


class MockPaymentProvider:
    """Deterministic in-memory provider for local dev, demos and tests.

    It records every transaction so tests can assert the money movement, and it
    fails cleanly on obviously invalid inputs (non-positive amount) so callers
    exercise the failure path.
    """

    name = "mock"

    def __init__(self) -> None:
        self.ledger: list[dict] = []

    def _record(self, kind: str, mobile_number: str, amount: float, narrative: str) -> PaymentResult:
        if amount <= 0:
            return PaymentResult(False, "", self.name, "Amount must be positive")
        ref = f"{kind.upper()}-{uuid.uuid4().hex[:12]}"
        self.ledger.append(
            {
                "kind": kind,
                "mobile_number": mobile_number,
                "amount": round(amount, 2),
                "narrative": narrative,
                "reference": ref,
            }
        )
        return PaymentResult(True, ref, self.name, f"{kind} of ZMW {amount:,.2f} accepted")

    def disburse(self, mobile_number: str, amount: float, narrative: str) -> PaymentResult:
        return self._record("disburse", mobile_number, amount, narrative)

    def collect(self, mobile_number: str, amount: float, narrative: str) -> PaymentResult:
        return self._record("collect", mobile_number, amount, narrative)


_provider: PaymentProvider | None = None


def get_provider() -> PaymentProvider:
    """Return the configured payment provider (singleton)."""
    global _provider
    if _provider is None:
        if settings.payment_provider == "mock":
            _provider = MockPaymentProvider()
        else:  # pragma: no cover - real providers wired in per-deployment
            raise RuntimeError(f"Unknown payment provider: {settings.payment_provider}")
    return _provider
