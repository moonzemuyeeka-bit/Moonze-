"""Onboarding, KYC and mobile-money capture endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer, KycStatus
from app.models.mobile_money import MobileMoneyProfile
from app.schemas.schemas import (
    CustomerCreate,
    CustomerOut,
    KycSubmit,
    MobileMoneyIn,
)

router = APIRouter(prefix="/customers", tags=["onboarding"])


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)) -> Customer:
    """Register a customer using mobile number + NRC (KYC starts as pending)."""
    existing = db.scalar(select(Customer).where(Customer.mobile_number == payload.mobile_number))
    if existing:
        raise HTTPException(status_code=409, detail="Mobile number already registered.")

    customer = Customer(
        full_name=payload.full_name,
        mobile_number=payload.mobile_number,
        nrc_number=payload.nrc_number,
        tpin=payload.tpin,
        region=payload.region,
        mno=payload.mno,
        device_fingerprint=payload.device_fingerprint,
        kyc_status=KycStatus.PENDING,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return list(db.scalars(select(Customer).order_by(Customer.id)).all())


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return customer


@router.post("/{customer_id}/kyc", response_model=CustomerOut)
def submit_kyc(customer_id: int, payload: KycSubmit, db: Session = Depends(get_db)) -> Customer:
    """Capture NRC front/back photos, selfie/face-ID and T-PIN, then verify.

    The face-match score simulates a liveness + ID-photo comparison. A strong
    match auto-verifies; a weak one is rejected pending manual review.
    """
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if payload.tpin:
        customer.tpin = payload.tpin
    customer.id_front_captured = payload.id_front_captured
    customer.id_back_captured = payload.id_back_captured
    customer.selfie_captured = payload.selfie_captured
    customer.face_match_score = payload.face_match_score

    if customer.kyc_complete and payload.face_match_score >= 0.75:
        customer.kyc_status = KycStatus.VERIFIED
    elif customer.kyc_complete:
        customer.kyc_status = KycStatus.REJECTED
    else:
        customer.kyc_status = KycStatus.SUBMITTED

    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}/mobile-money", response_model=CustomerOut)
def upsert_mobile_money(
    customer_id: int, payload: MobileMoneyIn, db: Session = Depends(get_db)
) -> Customer:
    """Attach or update the customer's mobile-money behavioural profile."""
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    profile = customer.mobile_money or MobileMoneyProfile(customer_id=customer.id)
    for field_name, value in payload.model_dump().items():
        setattr(profile, field_name, value)
    if customer.mobile_money is None:
        db.add(profile)
    db.commit()
    db.refresh(customer)
    return customer
