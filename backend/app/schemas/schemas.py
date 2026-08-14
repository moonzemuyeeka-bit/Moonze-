"""Request/response models for the API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Onboarding / KYC
# --------------------------------------------------------------------------- #
class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    mobile_number: str = Field(min_length=8, max_length=20)
    nrc_number: str = Field(min_length=6, max_length=20)
    tpin: str | None = Field(default=None, max_length=20)
    region: str | None = None
    mno: str | None = Field(default=None, description="Airtel / MTN / Zamtel")
    device_fingerprint: str | None = None


class KycSubmit(BaseModel):
    """Marks KYC artefacts as captured. In production these would be secure
    upload references; here booleans + a simulated face-match score suffice."""

    tpin: str | None = None
    id_front_captured: bool = True
    id_back_captured: bool = True
    selfie_captured: bool = True
    face_match_score: float = Field(default=0.95, ge=0.0, le=1.0)


class MobileMoneyIn(BaseModel):
    account_age_months: int = Field(ge=0)
    avg_monthly_inflow: float = Field(ge=0)
    avg_monthly_outflow: float = Field(ge=0)
    monthly_txn_count: int = Field(ge=0)
    avg_wallet_balance: float = Field(ge=0)
    cashout_ratio: float = Field(ge=0, le=1)
    bill_payments_per_month: int = Field(ge=0)
    airtime_topups_per_month: int = Field(ge=0)
    days_since_sim_swap: int = Field(default=9999, ge=0)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    mobile_number: str
    nrc_number: str
    tpin: str | None
    region: str | None
    mno: str | None
    kyc_status: str
    face_match_score: float | None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Loans
# --------------------------------------------------------------------------- #
class LoanApply(BaseModel):
    amount: float = Field(gt=0)
    term_days: int | None = Field(default=None, gt=0, le=365)


class RepaymentIn(BaseModel):
    amount: float = Field(gt=0)


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    principal: float
    interest_rate: float
    term_days: int
    status: str
    credit_score: int | None
    risk_band: str | None
    total_due: float
    amount_repaid: float
    outstanding: float
    created_at: datetime
    disbursed_at: datetime | None
    due_date: datetime | None
