"""Fraud & credit-risk framework.

This runs a battery of rules against a customer and returns a consolidated
verdict. It captures the kinds of controls modern digital lenders (FairMoney,
Branch, Tala, etc.) rely on to keep first-party and synthetic-identity fraud in
check:

* Identity integrity — KYC completeness and biometric (face) match strength.
* Duplication — the same NRC, mobile number or device attached to many accounts.
* Velocity — bursts of loan applications in a short window.
* Account takeover — a recent SIM swap on the funding wallet.
* Behavioural — pass-through wallets that only cash money straight out.
* Credit history — existing delinquency / over-indebtedness.

Each rule emits a :class:`RiskSignal` with a severity. Any ``CRITICAL`` signal
blocks lending outright; the aggregate score drives softer decisions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.loan import Loan, LoanStatus
from app.models.risk import RiskSeverity


@dataclass
class RiskSignal:
    code: str
    message: str
    severity: RiskSeverity


@dataclass
class RiskReport:
    signals: list[RiskSignal] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        """A single critical signal blocks lending."""
        return any(s.severity == RiskSeverity.CRITICAL for s in self.signals)

    @property
    def score(self) -> int:
        """0 (clean) .. 100 (severe). Used for soft, tunable decisions."""
        weights = {
            RiskSeverity.INFO: 0,
            RiskSeverity.LOW: 5,
            RiskSeverity.MEDIUM: 15,
            RiskSeverity.HIGH: 30,
            RiskSeverity.CRITICAL: 60,
        }
        return min(100, sum(weights[s.severity] for s in self.signals))

    def as_dict(self) -> dict:
        return {
            "blocked": self.blocked,
            "score": self.score,
            "signals": [
                {"code": s.code, "message": s.message, "severity": s.severity.value}
                for s in self.signals
            ],
        }


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def evaluate(db: Session, customer: Customer) -> RiskReport:
    """Run all fraud / risk rules for ``customer`` and return a report."""
    report = RiskReport()

    # --- Identity integrity -------------------------------------------------
    if not customer.kyc_complete:
        report.signals.append(
            RiskSignal(
                "KYC_INCOMPLETE",
                "KYC is not complete (missing NRC, T-PIN, ID photos or selfie).",
                RiskSeverity.CRITICAL,
            )
        )

    if customer.face_match_score is not None and customer.face_match_score < 0.75:
        sev = RiskSeverity.CRITICAL if customer.face_match_score < 0.5 else RiskSeverity.HIGH
        report.signals.append(
            RiskSignal(
                "FACE_MATCH_LOW",
                f"Selfie/ID face match is weak ({customer.face_match_score:.0%}).",
                sev,
            )
        )

    # --- Duplication --------------------------------------------------------
    dup_nrc = db.scalar(
        select(func.count(Customer.id)).where(
            Customer.nrc_number == customer.nrc_number, Customer.id != customer.id
        )
    )
    if dup_nrc:
        report.signals.append(
            RiskSignal(
                "DUPLICATE_NRC",
                f"NRC is linked to {dup_nrc} other account(s).",
                RiskSeverity.CRITICAL,
            )
        )

    if customer.device_fingerprint:
        dup_device = db.scalar(
            select(func.count(Customer.id)).where(
                Customer.device_fingerprint == customer.device_fingerprint,
                Customer.id != customer.id,
            )
        )
        if dup_device and dup_device >= 2:
            report.signals.append(
                RiskSignal(
                    "DEVICE_SHARED",
                    f"Device is shared by {dup_device + 1} accounts (possible fraud ring).",
                    RiskSeverity.HIGH,
                )
            )

    # --- Account takeover ---------------------------------------------------
    mm = customer.mobile_money
    if mm is not None and mm.days_since_sim_swap <= 7:
        report.signals.append(
            RiskSignal(
                "RECENT_SIM_SWAP",
                f"SIM swapped {mm.days_since_sim_swap} day(s) ago — account-takeover risk.",
                RiskSeverity.HIGH,
            )
        )

    # --- Behavioural --------------------------------------------------------
    if mm is not None and mm.cashout_ratio >= 0.95 and mm.account_age_months < 6:
        report.signals.append(
            RiskSignal(
                "PASS_THROUGH_WALLET",
                "New wallet cashes out almost all inflow — thin, high-risk profile.",
                RiskSeverity.MEDIUM,
            )
        )

    # --- Velocity -----------------------------------------------------------
    since = _utcnow() - timedelta(days=1)
    recent_apps = db.scalar(
        select(func.count(Loan.id)).where(
            Loan.customer_id == customer.id, Loan.created_at >= since
        )
    )
    if recent_apps and recent_apps >= settings.max_applications_per_day:
        report.signals.append(
            RiskSignal(
                "APPLICATION_VELOCITY",
                f"{recent_apps} loan applications in the last 24h.",
                RiskSeverity.HIGH,
            )
        )

    # --- Credit history -----------------------------------------------------
    delinquent = db.scalar(
        select(func.count(Loan.id)).where(
            Loan.customer_id == customer.id,
            Loan.status.in_([LoanStatus.OVERDUE, LoanStatus.DEFAULTED]),
        )
    )
    if delinquent:
        report.signals.append(
            RiskSignal(
                "ACTIVE_DELINQUENCY",
                f"{delinquent} overdue/defaulted loan(s) on file.",
                RiskSeverity.CRITICAL,
            )
        )

    return report
