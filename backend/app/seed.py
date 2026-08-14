"""Seed the database with realistic demo data.

Run with:  ``python -m app.seed``

Creates a spread of customers across risk bands, MNOs and regions, drives a few
through the full loan lifecycle (disburse, repay, go overdue) and generates
nudges so the dashboard has something meaningful to show.
"""

from __future__ import annotations

from datetime import timedelta

from app.core.database import SessionLocal, init_db
from app.models.customer import Customer, KycStatus
from app.models.loan import LoanStatus
from app.models.mobile_money import MobileMoneyProfile
from app.services import intelligence, loan_service
from app.services.loan_service import _utcnow


def _customer(db, **kw) -> Customer:
    mm_fields = {
        "account_age_months",
        "avg_monthly_inflow",
        "avg_monthly_outflow",
        "monthly_txn_count",
        "avg_wallet_balance",
        "cashout_ratio",
        "bill_payments_per_month",
        "airtime_topups_per_month",
        "days_since_sim_swap",
    }
    mm = {k: kw.pop(k) for k in list(kw) if k in mm_fields}
    c = Customer(
        kyc_status=KycStatus.VERIFIED,
        id_front_captured=True,
        id_back_captured=True,
        selfie_captured=True,
        face_match_score=0.96,
        **kw,
    )
    db.add(c)
    db.flush()
    profile = MobileMoneyProfile(customer_id=c.id, **mm)
    db.add(profile)
    db.flush()
    db.refresh(c)
    return c


def run() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(Customer).count() > 0:
            print("Database already seeded; skipping.")
            return

        # Prime, near-prime, acceptable, sub-prime and a decline.
        alice = _customer(
            db, full_name="Alice Banda", mobile_number="260970000001", nrc_number="111111/11/1",
            tpin="1000000001", region="Lusaka", mno="Airtel",
            account_age_months=48, avg_monthly_inflow=9000, avg_monthly_outflow=6000,
            monthly_txn_count=55, avg_wallet_balance=2200, cashout_ratio=0.35,
            bill_payments_per_month=4, airtime_topups_per_month=5, days_since_sim_swap=800,
        )
        brian = _customer(
            db, full_name="Brian Phiri", mobile_number="260960000002", nrc_number="222222/22/2",
            tpin="1000000002", region="Copperbelt", mno="MTN",
            account_age_months=26, avg_monthly_inflow=4500, avg_monthly_outflow=3200,
            monthly_txn_count=30, avg_wallet_balance=700, cashout_ratio=0.55,
            bill_payments_per_month=2, airtime_topups_per_month=3, days_since_sim_swap=400,
        )
        chanda = _customer(
            db, full_name="Chanda Mwale", mobile_number="260950000003", nrc_number="333333/33/3",
            tpin="1000000003", region="Lusaka", mno="Zamtel",
            account_age_months=14, avg_monthly_inflow=2400, avg_monthly_outflow=1900,
            monthly_txn_count=18, avg_wallet_balance=300, cashout_ratio=0.7,
            bill_payments_per_month=1, airtime_topups_per_month=2, days_since_sim_swap=200,
        )
        diana = _customer(
            db, full_name="Diana Zulu", mobile_number="260970000004", nrc_number="444444/44/4",
            tpin="1000000004", region="Southern", mno="Airtel",
            account_age_months=7, avg_monthly_inflow=1200, avg_monthly_outflow=1050,
            monthly_txn_count=10, avg_wallet_balance=120, cashout_ratio=0.82,
            bill_payments_per_month=0, airtime_topups_per_month=1, days_since_sim_swap=120,
        )
        # High-risk: brand-new pass-through wallet + recent SIM swap.
        _customer(
            db, full_name="Emmanuel Tembo", mobile_number="260960000005", nrc_number="555555/55/5",
            tpin="1000000005", region="Copperbelt", mno="MTN",
            account_age_months=2, avg_monthly_inflow=600, avg_monthly_outflow=580,
            monthly_txn_count=6, avg_wallet_balance=30, cashout_ratio=0.97,
            bill_payments_per_month=0, airtime_topups_per_month=0, days_since_sim_swap=3,
        )
        db.commit()

        # Drive a few loans through the lifecycle.
        # Alice: repaid in full (great customer).
        la = loan_service.apply_for_loan(db, alice, 3000)
        if la.status == LoanStatus.APPROVED:
            loan_service.disburse_loan(db, la)
            loan_service.record_repayment(db, la, la.total_due)

        # Brian: disbursed, due soon (drives nudges).
        lb = loan_service.apply_for_loan(db, brian, 1500)
        if lb.status == LoanStatus.APPROVED:
            loan_service.disburse_loan(db, lb)
            lb.due_date = _utcnow() + timedelta(days=5)  # inside the reminder window
            db.commit()

        # Chanda: disbursed and already overdue.
        lc = loan_service.apply_for_loan(db, chanda, 500)
        if lc.status == LoanStatus.APPROVED:
            loan_service.disburse_loan(db, lc)
            lc.due_date = _utcnow() - timedelta(days=3)
            db.commit()

        loan_service.refresh_overdue(db)
        nudges = intelligence.generate_nudges(db)

        print(f"Seeded {db.query(Customer).count()} customers.")
        print(f"Generated {len(nudges)} repayment nudges.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
