"""Risk / fraud flag model."""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RiskSeverity(str, enum.Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"  # blocks lending outright


class RiskFlag(Base):
    __tablename__ = "risk_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)

    code: Mapped[str] = mapped_column(String(60), nullable=False)  # machine-readable rule id
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[RiskSeverity] = mapped_column(Enum(RiskSeverity), default=RiskSeverity.LOW)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    customer = relationship("Customer", back_populates="risk_flags")
