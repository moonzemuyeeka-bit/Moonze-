"""Small helpers to build model instances in tests."""

from __future__ import annotations

from app.models.customer import Customer, KycStatus
from app.models.mobile_money import MobileMoneyProfile

_MM_DEFAULTS = dict(
    account_age_months=36,
    avg_monthly_inflow=6000,
    avg_monthly_outflow=4000,
    monthly_txn_count=40,
    avg_wallet_balance=1500,
    cashout_ratio=0.4,
    bill_payments_per_month=3,
    airtime_topups_per_month=4,
    days_since_sim_swap=500,
)


def make_customer(db, *, verified: bool = True, mm: bool = True, **overrides) -> Customer:
    mm_overrides = {k: overrides.pop(k) for k in list(overrides) if k in _MM_DEFAULTS}
    defaults = dict(
        full_name="Test Customer",
        mobile_number="260970000999",
        nrc_number="999999/99/9",
        tpin="1000000999",
        region="Lusaka",
        mno="Airtel",
    )
    defaults.update(overrides)

    customer = Customer(**defaults)
    if verified:
        customer.kyc_status = KycStatus.VERIFIED
        customer.id_front_captured = True
        customer.id_back_captured = True
        customer.selfie_captured = True
        customer.face_match_score = 0.95
    db.add(customer)
    db.flush()

    if mm:
        profile_fields = {**_MM_DEFAULTS, **mm_overrides}
        db.add(MobileMoneyProfile(customer_id=customer.id, **profile_fields))
        db.flush()

    db.commit()
    db.refresh(customer)
    return customer
