"""Tests for eligibility and the loan lifecycle."""

from __future__ import annotations

from datetime import timedelta

from app.models.loan import LoanStatus
from app.services import loan_service
from app.services.loan_service import _utcnow
from tests.factories import make_customer


def test_eligible_customer_gets_offer(db):
    c = make_customer(db)
    result = loan_service.check_eligibility(db, c)
    assert result.eligible
    assert result.max_amount >= 50


def test_ineligible_when_blocked_by_risk(db):
    c = make_customer(db, verified=False)
    result = loan_service.check_eligibility(db, c)
    assert not result.eligible
    assert result.max_amount == 0.0


def test_apply_within_limit_is_approved(db):
    c = make_customer(db)
    offer = loan_service.check_eligibility(db, c).max_amount
    loan = loan_service.apply_for_loan(db, c, min(offer, 500))
    assert loan.status == LoanStatus.APPROVED
    assert loan.credit_score is not None


def test_apply_above_limit_is_rejected(db):
    c = make_customer(db)
    offer = loan_service.check_eligibility(db, c).max_amount
    loan = loan_service.apply_for_loan(db, c, offer + 100000)
    assert loan.status == LoanStatus.REJECTED


def test_full_lifecycle_disburse_and_repay(db):
    c = make_customer(db)
    loan = loan_service.apply_for_loan(db, c, 500)
    assert loan.status == LoanStatus.APPROVED

    loan = loan_service.disburse_loan(db, loan)
    assert loan.status == LoanStatus.DISBURSED
    assert loan.due_date is not None
    assert loan.disbursement_ref

    # Interest is applied on top of principal.
    assert loan.total_due > loan.principal

    loan_service.record_repayment(db, loan, loan.total_due)
    db.refresh(loan)
    assert loan.status == LoanStatus.REPAID
    assert loan.outstanding == 0.0


def test_partial_repayment_keeps_loan_open(db):
    c = make_customer(db)
    loan = loan_service.apply_for_loan(db, c, 500)
    loan_service.disburse_loan(db, loan)
    loan_service.record_repayment(db, loan, 100)
    db.refresh(loan)
    assert loan.status == LoanStatus.DISBURSED
    assert loan.outstanding > 0


def test_cannot_disburse_rejected_loan(db):
    c = make_customer(db)
    loan = loan_service.apply_for_loan(db, c, 999999)
    assert loan.status == LoanStatus.REJECTED
    try:
        loan_service.disburse_loan(db, loan)
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_refresh_overdue_marks_past_due(db):
    c = make_customer(db)
    loan = loan_service.apply_for_loan(db, c, 500)
    loan_service.disburse_loan(db, loan)
    loan.due_date = _utcnow() - timedelta(days=1)
    db.commit()
    changed = loan_service.refresh_overdue(db)
    db.refresh(loan)
    assert changed == 1
    assert loan.status == LoanStatus.OVERDUE


def test_existing_exposure_reduces_new_offer(db):
    c = make_customer(db)
    first_offer = loan_service.check_eligibility(db, c).max_amount
    loan = loan_service.apply_for_loan(db, c, min(first_offer, 500))
    loan_service.disburse_loan(db, loan)
    second_offer = loan_service.check_eligibility(db, c).max_amount
    assert second_offer < first_offer
