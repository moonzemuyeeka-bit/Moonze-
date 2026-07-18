"""Tests for the fraud / risk framework."""

from __future__ import annotations

from app.models.customer import KycStatus
from app.models.loan import Loan, LoanStatus
from app.services import risk_engine
from tests.factories import make_customer


def test_clean_customer_not_blocked(db):
    c = make_customer(db)
    report = risk_engine.evaluate(db, c)
    assert not report.blocked
    assert report.score == 0


def test_incomplete_kyc_is_critical(db):
    c = make_customer(db, verified=False)
    c.kyc_status = KycStatus.PENDING
    db.commit()
    report = risk_engine.evaluate(db, c)
    assert report.blocked
    assert any(s.code == "KYC_INCOMPLETE" for s in report.signals)


def test_duplicate_nrc_blocks(db):
    make_customer(db, mobile_number="260970000001", nrc_number="dup/1/1")
    c2 = make_customer(db, mobile_number="260970000002", nrc_number="dup/1/1")
    report = risk_engine.evaluate(db, c2)
    assert report.blocked
    assert any(s.code == "DUPLICATE_NRC" for s in report.signals)


def test_recent_sim_swap_flagged(db):
    c = make_customer(db, days_since_sim_swap=2)
    report = risk_engine.evaluate(db, c)
    assert any(s.code == "RECENT_SIM_SWAP" for s in report.signals)
    assert not report.blocked  # high, but not blocking on its own


def test_weak_face_match_blocks(db):
    c = make_customer(db)
    c.face_match_score = 0.4
    db.commit()
    report = risk_engine.evaluate(db, c)
    assert report.blocked
    assert any(s.code == "FACE_MATCH_LOW" for s in report.signals)


def test_active_delinquency_blocks(db):
    c = make_customer(db)
    db.add(Loan(customer_id=c.id, principal=500, status=LoanStatus.OVERDUE))
    db.commit()
    report = risk_engine.evaluate(db, c)
    assert report.blocked
    assert any(s.code == "ACTIVE_DELINQUENCY" for s in report.signals)
