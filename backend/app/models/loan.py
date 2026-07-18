"""Loan and repayment models."""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LoanStatus(str, enum.Enum):
    PENDING = "pending"        # application created, not yet decisioned
    APPROVED = "approved"      # decisioned yes, awaiting disbursement
    REJECTED = "rejected"      # decisioned no
    DISBURSED = "disbursed"    # money sent to customer wallet
    REPAID = "repaid"          # fully settled
    OVERDUE = "overdue"        # past due date with outstanding balance
    DEFAULTED = "defaulted"    # written off / severely delinquent


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)

    principal: Mapped[float] = mapped_column(Float, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Float, default=0.0)  # flat rate for the term
    term_days: Mapped[int] = mapped_column(Integer, default=30)

    status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus), default=LoanStatus.PENDING)

    # Snapshot of the decision so we can audit why a loan was granted.
    credit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_band: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    disbursed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # External payment references for reconciliation.
    disbursement_ref: Mapped[str | None] = mapped_column(String(80), nullable=True)

    customer = relationship("Customer", back_populates="loans")
    repayments = relationship("Repayment", back_populates="loan", cascade="all, delete-orphan")

    @property
    def total_due(self) -> float:
        """Principal plus flat interest for the term."""
        return round(self.principal * (1 + self.interest_rate), 2)

    @property
    def amount_repaid(self) -> float:
        return round(sum(r.amount for r in self.repayments), 2)

    @property
    def outstanding(self) -> float:
        return round(max(self.total_due - self.amount_repaid, 0.0), 2)


class Repayment(Base):
    __tablename__ = "repayments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"), index=True)

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    reference: Mapped[str | None] = mapped_column(String(80), nullable=True)

    loan = relationship("Loan", back_populates="repayments")
