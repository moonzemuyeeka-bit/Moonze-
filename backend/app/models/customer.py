"""Customer and KYC models.

KYC in the Zambian context typically requires:
- Mobile number (linked to a mobile-money wallet)
- NRC (National Registration Card) number
- T-PIN (ZRA Taxpayer PIN)
- Face-ID / liveness plus front and back photos of the NRC
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KycStatus(str, enum.Enum):
    PENDING = "pending"          # created, KYC not yet complete
    SUBMITTED = "submitted"      # all documents captured, awaiting verification
    VERIFIED = "verified"        # identity + documents verified
    REJECTED = "rejected"        # failed verification / fraud


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    mobile_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    nrc_number: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    tpin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Simple segmentation attributes used by the intelligence layer.
    region: Mapped[str | None] = mapped_column(String(60), nullable=True)
    mno: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Airtel / MTN / Zamtel

    # KYC capture markers. In production these would reference secure object
    # storage keys; here we only record whether artefacts were captured and the
    # outcome of automated checks.
    kyc_status: Mapped[KycStatus] = mapped_column(Enum(KycStatus), default=KycStatus.PENDING)
    id_front_captured: Mapped[bool] = mapped_column(default=False)
    id_back_captured: Mapped[bool] = mapped_column(default=False)
    selfie_captured: Mapped[bool] = mapped_column(default=False)
    face_match_score: Mapped[float | None] = mapped_column(nullable=True)  # 0..1 liveness/match
    device_fingerprint: Mapped[str | None] = mapped_column(String(80), index=True, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    mobile_money = relationship(
        "MobileMoneyProfile", back_populates="customer", uselist=False, cascade="all, delete-orphan"
    )
    loans = relationship("Loan", back_populates="customer", cascade="all, delete-orphan")
    risk_flags = relationship("RiskFlag", back_populates="customer", cascade="all, delete-orphan")

    @property
    def kyc_complete(self) -> bool:
        """True when every KYC artefact has been captured."""
        return all(
            [
                bool(self.nrc_number),
                bool(self.tpin),
                self.id_front_captured,
                self.id_back_captured,
                self.selfie_captured,
            ]
        )
