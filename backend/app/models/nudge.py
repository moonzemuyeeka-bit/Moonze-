"""Repayment nudge / reminder model.

The intelligence layer generates nudges when a loan is approaching its due date
so the collections engine can send SMS / push reminders.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NudgeChannel(str, enum.Enum):
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"


class Nudge(Base):
    __tablename__ = "nudges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)

    channel: Mapped[NudgeChannel] = mapped_column(Enum(NudgeChannel), default=NudgeChannel.SMS)
    message: Mapped[str] = mapped_column(String(320), nullable=False)
    days_to_due: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    sent: Mapped[bool] = mapped_column(default=False)

    loan = relationship("Loan")
    customer = relationship("Customer")
