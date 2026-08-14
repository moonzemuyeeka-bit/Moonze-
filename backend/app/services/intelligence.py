"""Intelligence layer.

Turns raw loan data into the portfolio insight a lending business runs on:

* **Portfolio KPIs** — outstanding book, on-time payment rate, PAR (portfolio at
  risk), default rate.
* **Segment performance** — the same KPIs sliced by risk band, MNO and region so
  the team can see which customer segments perform best and steer acquisition
  toward them ("a pipeline of good loan customers").
* **Due-date nudges** — detects loans a configurable number of days before their
  due date and generates repayment reminders, plus flags loans already overdue.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.loan import Loan, LoanStatus
from app.models.nudge import Nudge, NudgeChannel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime | None) -> datetime | None:
    """SQLite can return naive datetimes; normalise to UTC-aware for math."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


_CLOSED = (LoanStatus.REPAID, LoanStatus.DEFAULTED)
_LIVE = (LoanStatus.DISBURSED, LoanStatus.OVERDUE)


def _kpis_for(loans: list[Loan]) -> dict:
    """Compute KPIs for a bag of loans."""
    disbursed = [l for l in loans if l.status in _LIVE or l.status in _CLOSED]
    outstanding = round(sum(l.outstanding for l in loans if l.status in _LIVE), 2)
    principal_out = round(sum(l.principal for l in disbursed), 2)

    at_risk = [l for l in loans if l.status in (LoanStatus.OVERDUE, LoanStatus.DEFAULTED)]
    par_amount = round(sum(l.outstanding for l in at_risk), 2)
    par_ratio = round(par_amount / outstanding, 4) if outstanding else 0.0

    settled = [l for l in loans if l.status in _CLOSED]
    repaid = [l for l in settled if l.status == LoanStatus.REPAID]
    payment_rate = round(len(repaid) / len(settled), 4) if settled else 0.0

    defaulted = [l for l in disbursed if l.status == LoanStatus.DEFAULTED]
    default_rate = round(len(defaulted) / len(disbursed), 4) if disbursed else 0.0

    return {
        "loan_count": len(loans),
        "disbursed_count": len(disbursed),
        "principal_disbursed": principal_out,
        "outstanding": outstanding,
        "par_amount": par_amount,
        "par_ratio": par_ratio,          # portfolio at risk
        "payment_rate": payment_rate,    # share of closed loans fully repaid
        "default_rate": default_rate,
    }


def portfolio_overview(db: Session) -> dict:
    loans = db.scalars(select(Loan)).all()
    return _kpis_for(loans)


def segment_performance(db: Session, dimension: str = "risk_band") -> list[dict]:
    """KPIs grouped by a customer/loan dimension.

    Supported dimensions: ``risk_band`` (on the loan) and ``mno`` / ``region``
    (on the customer).
    """
    loans = db.scalars(select(Loan)).all()
    customers = {c.id: c for c in db.scalars(select(Customer)).all()}

    buckets: dict[str, list[Loan]] = defaultdict(list)
    for loan in loans:
        if dimension == "risk_band":
            key = loan.risk_band or "unscored"
        elif dimension == "mno":
            key = (customers.get(loan.customer_id).mno if customers.get(loan.customer_id) else None) or "unknown"
        elif dimension == "region":
            key = (customers.get(loan.customer_id).region if customers.get(loan.customer_id) else None) or "unknown"
        else:
            raise ValueError(f"Unsupported dimension: {dimension}")
        buckets[key].append(loan)

    rows = [{"segment": key, **_kpis_for(group)} for key, group in buckets.items()]
    # Best performers first: highest payment rate, then lowest PAR.
    rows.sort(key=lambda r: (-r["payment_rate"], r["par_ratio"]))
    return rows


def _nudge_message(customer: Customer, loan: Loan, days_to_due: int) -> str:
    if days_to_due < 0:
        return (
            f"Hi {customer.full_name.split()[0]}, your Zatu loan of "
            f"ZMW {loan.outstanding:,.0f} is {abs(days_to_due)} day(s) overdue. "
            f"Please repay today to protect your credit standing."
        )
    if days_to_due == 0:
        return (
            f"Hi {customer.full_name.split()[0]}, your Zatu loan of "
            f"ZMW {loan.outstanding:,.0f} is due today. Repay now to stay on track."
        )
    return (
        f"Hi {customer.full_name.split()[0]}, a friendly reminder: your Zatu loan of "
        f"ZMW {loan.outstanding:,.0f} is due in {days_to_due} day(s). "
        f"Top up your wallet to repay on time and unlock a bigger next loan."
    )


def upcoming_due(db: Session, lead_days: int | None = None) -> list[dict]:
    """Loans due within ``lead_days`` (default: config) or already overdue."""
    lead_days = lead_days if lead_days is not None else settings.reminder_lead_days
    now = _utcnow()
    live = db.scalars(select(Loan).where(Loan.status.in_(_LIVE))).all()

    result = []
    for loan in live:
        due = _as_aware(loan.due_date)
        if due is None:
            continue
        days_to_due = (due.date() - now.date()).days
        if days_to_due <= lead_days:
            result.append(
                {
                    "loan_id": loan.id,
                    "customer_id": loan.customer_id,
                    "customer_name": loan.customer.full_name,
                    "mobile_number": loan.customer.mobile_number,
                    "outstanding": loan.outstanding,
                    "due_date": due.isoformat(),
                    "days_to_due": days_to_due,
                    "overdue": days_to_due < 0,
                }
            )
    result.sort(key=lambda r: r["days_to_due"])
    return result


def generate_nudges(db: Session, lead_days: int | None = None) -> list[Nudge]:
    """Create reminder nudges for loans approaching or past their due date.

    Idempotent per (loan, days_to_due): re-running the same day won't duplicate
    a reminder that already exists for that lead time.
    """
    due_soon = upcoming_due(db, lead_days=lead_days)
    created: list[Nudge] = []
    for item in due_soon:
        exists = db.scalar(
            select(Nudge).where(
                Nudge.loan_id == item["loan_id"],
                Nudge.days_to_due == item["days_to_due"],
            )
        )
        if exists:
            continue
        loan = db.get(Loan, item["loan_id"])
        customer = loan.customer
        nudge = Nudge(
            loan_id=loan.id,
            customer_id=customer.id,
            channel=NudgeChannel.SMS,
            message=_nudge_message(customer, loan, item["days_to_due"]),
            days_to_due=item["days_to_due"],
        )
        db.add(nudge)
        created.append(nudge)

    if created:
        db.commit()
        for n in created:
            db.refresh(n)
    return created
