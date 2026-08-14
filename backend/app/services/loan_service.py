"""Loan eligibility engine and loan lifecycle operations.

This ties the credit score, the risk framework and the customer's existing debt
together into a single, explainable eligibility decision, then handles the loan
lifecycle: apply -> approve/reject -> disburse -> repay.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.loan import Loan, LoanStatus, Repayment
from app.services import credit_scoring, risk_engine
from app.services.payments import get_provider


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


ACTIVE_STATUSES = (LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.OVERDUE)


@dataclass
class EligibilityResult:
    eligible: bool
    reasons: list[str] = field(default_factory=list)
    max_amount: float = 0.0
    credit: dict | None = None
    risk: dict | None = None
    existing_exposure: float = 0.0

    def as_dict(self) -> dict:
        return {
            "eligible": self.eligible,
            "reasons": self.reasons,
            "max_amount": self.max_amount,
            "credit": self.credit,
            "risk": self.risk,
            "existing_exposure": self.existing_exposure,
        }


def existing_exposure(db: Session, customer: Customer) -> float:
    """Total outstanding balance across the customer's active loans."""
    loans = db.scalars(
        select(Loan).where(
            Loan.customer_id == customer.id, Loan.status.in_(ACTIVE_STATUSES)
        )
    ).all()
    return round(sum(l.outstanding for l in loans), 2)


def check_eligibility(db: Session, customer: Customer) -> EligibilityResult:
    """Decide whether a customer qualifies for a loan and for how much."""
    reasons: list[str] = []

    # 1) Risk / fraud gate first — a critical flag stops everything.
    risk = risk_engine.evaluate(db, customer)
    if risk.blocked:
        reasons.extend(s.message for s in risk.signals if s.severity.value == "critical")
        return EligibilityResult(
            eligible=False,
            reasons=reasons or ["Blocked by risk controls."],
            max_amount=0.0,
            risk=risk.as_dict(),
            existing_exposure=existing_exposure(db, customer),
        )

    # 2) Need a mobile-money profile to score against.
    if customer.mobile_money is None:
        return EligibilityResult(
            eligible=False,
            reasons=["No mobile-money history available to assess."],
            risk=risk.as_dict(),
        )

    credit = credit_scoring.assess(customer.mobile_money)

    # 3) Minimum score policy.
    if credit.score < settings.min_credit_score:
        reasons.append(
            f"Credit score {credit.score} is below the minimum of {settings.min_credit_score}."
        )

    # 4) Affordability / over-indebtedness. New repayment must keep total debt
    #    service within the debt-to-income ceiling.
    exposure = existing_exposure(db, customer)
    monthly_income = max(customer.mobile_money.avg_monthly_inflow, 1.0)
    headroom = settings.max_debt_to_income * monthly_income - exposure
    if headroom <= 0:
        reasons.append(
            f"Existing debt (ZMW {exposure:,.0f}) already exceeds the affordability ceiling."
        )

    # 5) Compute the offer: the smaller of the score-based limit and affordability
    #    headroom, net of what they already owe.
    score_limit = credit.recommended_limit
    max_amount = max(min(score_limit, headroom) if headroom > 0 else 0.0, 0.0)
    max_amount = (int(max_amount) // 50) * 50  # round down to clean 50s

    if max_amount < 50 and not reasons:
        reasons.append("Affordability headroom is too small for a viable loan.")

    eligible = not reasons and max_amount >= 50

    return EligibilityResult(
        eligible=eligible,
        reasons=reasons if not eligible else ["Approved within policy limits."],
        max_amount=float(max_amount),
        credit=credit.as_dict(),
        risk=risk.as_dict(),
        existing_exposure=exposure,
    )


def apply_for_loan(db: Session, customer: Customer, amount: float, term_days: int | None = None) -> Loan:
    """Create a loan application and auto-decision it against policy."""
    term_days = term_days or settings.default_term_days
    eligibility = check_eligibility(db, customer)

    credit = eligibility.credit or {}
    loan = Loan(
        customer_id=customer.id,
        principal=round(amount, 2),
        interest_rate=settings.base_interest_rate,
        term_days=term_days,
        credit_score=credit.get("score"),
        risk_band=credit.get("risk_band"),
    )

    if eligibility.eligible and amount <= eligibility.max_amount and amount >= 50:
        loan.status = LoanStatus.APPROVED
    else:
        loan.status = LoanStatus.REJECTED

    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


def disburse_loan(db: Session, loan: Loan) -> Loan:
    """Push an approved loan to the customer's wallet and start the clock."""
    if loan.status != LoanStatus.APPROVED:
        raise ValueError("Only approved loans can be disbursed.")

    provider = get_provider()
    result = provider.disburse(
        loan.customer.mobile_number, loan.principal, narrative=f"Zatu loan #{loan.id}"
    )
    if not result.success:
        raise RuntimeError(f"Disbursement failed: {result.message}")

    now = _utcnow()
    loan.status = LoanStatus.DISBURSED
    loan.disbursed_at = now
    loan.due_date = now + timedelta(days=loan.term_days)
    loan.disbursement_ref = result.reference
    db.commit()
    db.refresh(loan)
    return loan


def record_repayment(db: Session, loan: Loan, amount: float) -> Repayment:
    """Collect a repayment from the customer's wallet and update loan state."""
    if loan.status not in (LoanStatus.DISBURSED, LoanStatus.OVERDUE):
        raise ValueError("Only disbursed/overdue loans can be repaid.")

    provider = get_provider()
    result = provider.collect(
        loan.customer.mobile_number, amount, narrative=f"Repayment loan #{loan.id}"
    )
    if not result.success:
        raise RuntimeError(f"Collection failed: {result.message}")

    repayment = Repayment(loan_id=loan.id, amount=round(amount, 2), reference=result.reference)
    db.add(repayment)
    db.flush()  # so loan.outstanding sees the new repayment

    if loan.outstanding <= 0:
        loan.status = LoanStatus.REPAID

    db.commit()
    db.refresh(repayment)
    return repayment


def refresh_overdue(db: Session) -> int:
    """Mark disbursed loans past their due date as overdue. Returns count changed."""
    now = _utcnow()
    loans = db.scalars(
        select(Loan).where(Loan.status == LoanStatus.DISBURSED, Loan.due_date < now)
    ).all()
    changed = 0
    for loan in loans:
        if loan.outstanding > 0:
            loan.status = LoanStatus.OVERDUE
            changed += 1
    if changed:
        db.commit()
    return changed
