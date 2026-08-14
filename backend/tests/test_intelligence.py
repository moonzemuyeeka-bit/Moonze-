"""Tests for the intelligence layer (KPIs, segments, nudges)."""

from __future__ import annotations

from datetime import timedelta

from app.services import intelligence, loan_service
from app.services.loan_service import _utcnow
from tests.factories import make_customer


def _disbursed_loan(db, customer, amount=500):
    loan = loan_service.apply_for_loan(db, customer, amount)
    return loan_service.disburse_loan(db, loan)


def test_overview_counts_outstanding(db):
    c = make_customer(db)
    _disbursed_loan(db, c)
    ov = intelligence.portfolio_overview(db)
    assert ov["disbursed_count"] == 1
    assert ov["outstanding"] > 0


def test_payment_rate_reflects_repaid_loans(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan_service.record_repayment(db, loan, loan.total_due)
    ov = intelligence.portfolio_overview(db)
    assert ov["payment_rate"] == 1.0


def test_par_ratio_reflects_overdue(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan.due_date = _utcnow() - timedelta(days=2)
    db.commit()
    loan_service.refresh_overdue(db)
    ov = intelligence.portfolio_overview(db)
    assert ov["par_ratio"] > 0


def test_segment_performance_groups_by_mno(db):
    a = make_customer(db, mobile_number="260970000001", nrc_number="a/1/1", mno="Airtel")
    m = make_customer(db, mobile_number="260960000002", nrc_number="b/2/2", mno="MTN")
    _disbursed_loan(db, a)
    _disbursed_loan(db, m)
    rows = intelligence.segment_performance(db, "mno")
    segments = {r["segment"] for r in rows}
    assert {"Airtel", "MTN"} <= segments


def test_upcoming_due_within_window(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan.due_date = _utcnow() + timedelta(days=5)
    db.commit()
    due = intelligence.upcoming_due(db, lead_days=7)
    assert len(due) == 1
    assert due[0]["days_to_due"] == 5


def test_loan_outside_window_not_returned(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan.due_date = _utcnow() + timedelta(days=20)
    db.commit()
    assert intelligence.upcoming_due(db, lead_days=7) == []


def test_generate_nudges_is_idempotent(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan.due_date = _utcnow() + timedelta(days=6)
    db.commit()
    first = intelligence.generate_nudges(db, lead_days=7)
    second = intelligence.generate_nudges(db, lead_days=7)
    assert len(first) == 1
    assert len(second) == 0  # no duplicate for the same days_to_due


def test_overdue_nudge_message(db):
    c = make_customer(db)
    loan = _disbursed_loan(db, c)
    loan.due_date = _utcnow() - timedelta(days=2)
    db.commit()
    loan_service.refresh_overdue(db)
    nudges = intelligence.generate_nudges(db, lead_days=7)
    assert len(nudges) == 1
    assert "overdue" in nudges[0].message.lower()
